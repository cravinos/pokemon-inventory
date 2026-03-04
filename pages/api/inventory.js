const INVENTORY_TTL = 60 * 1000;
const SETS_TTL = 60 * 60 * 1000;

let inventoryCache = { data: null, timestamp: 0 };
let setsCache = { data: null, timestamp: 0 };

async function getSets() {
  if (setsCache.data && Date.now() - setsCache.timestamp < SETS_TTL) {
    return setsCache.data;
  }
  try {
    const r = await fetch('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate');
    const json = await r.json();
    setsCache = { data: json.data || [], timestamp: Date.now() };
    return setsCache.data;
  } catch {
    return setsCache.data || [];
  }
}

function findSetLogo(sets, productName) {
  const name = productName.toLowerCase();
  // Try to match any set name contained in the product name
  const match = sets.find((s) => {
    const setName = s.name.toLowerCase();
    return name.includes(setName) || setName.includes(name.split(' ').slice(0, 3).join(' '));
  });
  return match?.images?.logo || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (inventoryCache.data && Date.now() - inventoryCache.timestamp < INVENTORY_TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(inventoryCache.data);
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Inventory';

  if (!token || !baseId) {
    return res.status(500).json({ error: 'Airtable credentials not configured' });
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?fields[]=Name&fields[]=Price&fields[]=Quantity&fields[]=Condition&fields[]=Category&pageSize=100`;

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error('Airtable error:', airtableRes.status, err);
      return res.status(502).json({ error: `Airtable ${airtableRes.status}: ${err}` });
    }

    const json = await airtableRes.json();
    const sets = await getSets();

    const items = (json.records || []).map((r) => {
      const attachmentUrl = r.fields.Image?.[0]?.url || null;
      const name = r.fields.Name || '';
      const autoImage = attachmentUrl || findSetLogo(sets, name);
      return {
        id: r.id,
        name,
        price: r.fields.Price ?? null,
        quantity: r.fields.Quantity ?? 0,
        condition: r.fields.Condition || 'New',
        category: r.fields.Category || 'Other',
        image: autoImage,
      };
    });

    items.sort((a, b) => {
      if ((a.quantity > 0) !== (b.quantity > 0)) return a.quantity > 0 ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    inventoryCache = { data: items, timestamp: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json(items);
  } catch (err) {
    console.error('Inventory API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
