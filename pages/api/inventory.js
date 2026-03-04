const INVENTORY_TTL = 60 * 1000;
const SETS_TTL      = 60 * 60 * 1000;
const IMG_TTL       = 24 * 60 * 60 * 1000;

let inventoryCache = { data: null, timestamp: 0 };
let setsCache      = { data: null, timestamp: 0 };
let imgCache       = {}; // productName -> { url, ts }

// ── Fetch all Pokemon TCG sets ──────────────────────────────────────────────
async function getSets() {
  if (setsCache.data && Date.now() - setsCache.timestamp < SETS_TTL) return setsCache.data;
  try {
    const r = await fetch('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate');
    const j = await r.json();
    setsCache = { data: j.data || [], timestamp: Date.now() };
    return setsCache.data;
  } catch {
    return setsCache.data || [];
  }
}

// ── Best set match by longest contained name ────────────────────────────────
function findBestSet(sets, productName) {
  const name = productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  let best = null, bestScore = 0;
  for (const set of sets) {
    const sn = set.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (name.includes(sn) && sn.length > bestScore) { best = set; bestScore = sn.length; }
  }
  return best;
}

// ── Cascade image search: TCG logo → TCG card → TCGPlayer search → null ────
async function getProductImage(sets, name) {
  if (imgCache[name] && Date.now() - imgCache[name].ts < IMG_TTL) return imgCache[name].url;

  const set = findBestSet(sets, name);

  // 1. Official set logo from Pokemon TCG API
  if (set?.images?.logo) {
    imgCache[name] = { url: set.images.logo, ts: Date.now() };
    return set.images.logo;
  }

  // 2. Card artwork from matching set
  if (set) {
    try {
      const r = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${set.id}&pageSize=1&select=images`,
        { signal: AbortSignal.timeout(3000) }
      );
      const d = await r.json();
      const img = d.data?.[0]?.images?.large;
      if (img) { imgCache[name] = { url: img, ts: Date.now() }; return img; }
    } catch { /* timeout ok */ }
  }

  // 3. TCGPlayer CDN search via their public autocomplete endpoint
  try {
    const q = encodeURIComponent(name.replace(/booster box|etb|tin|blister|bundle/gi, '').trim());
    const r = await fetch(
      `https://mp-search-api.tcgplayer.com/v1/search/request?q=${q}&isFuzzy=false&size=1&from=0&filters=[]&listingType=All&context=product`,
      {
        headers: { 'Content-Type': 'application/json', 'x-tcg-client-info': 'tcgplayer-next' },
        signal: AbortSignal.timeout(3000),
      }
    );
    const d = await r.json();
    const img = d.results?.[0]?.results?.[0]?.imageUrl;
    if (img) { imgCache[name] = { url: img, ts: Date.now() }; return img; }
  } catch { /* fine */ }

  imgCache[name] = { url: null, ts: Date.now() };
  return null;
}

// ── Days until a date ───────────────────────────────────────────────────────
function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

// ── Main handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (inventoryCache.data && Date.now() - inventoryCache.timestamp < INVENTORY_TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(inventoryCache.data);
  }

  const token     = process.env.AIRTABLE_TOKEN;
  const baseId    = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Inventory';

  if (!token || !baseId) return res.status(500).json({ error: 'Airtable credentials not configured' });

  try {
    const fields = [
      'Name', 'Price', 'Quantity', 'Condition', 'Category',
      'COMING_SOON', 'COMING_SOON_STOCK_COUNT', 'COMING_SOON_DATE',
    ].map(f => `fields[]=${encodeURIComponent(f)}`).join('&');

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${fields}&pageSize=100`;
    const airtableRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error('Airtable error:', airtableRes.status, err);
      return res.status(502).json({ error: `Airtable ${airtableRes.status}: ${err}` });
    }

    const json = await airtableRes.json();
    const sets = await getSets();

    const items = await Promise.all(
      (json.records || []).map(async (r) => {
        const name       = r.fields.Name || '';
        const comingSoon = !!r.fields.COMING_SOON;
        const csDate     = r.fields.COMING_SOON_DATE || null; // ISO string from Airtable
        return {
          id:             r.id,
          name,
          price:          r.fields.Price ?? null,
          quantity:       r.fields.Quantity ?? 0,
          condition:      r.fields.Condition || 'New',
          category:       r.fields.Category || 'Other',
          image:          await getProductImage(sets, name),
          comingSoon,
          comingSoonStock: r.fields.COMING_SOON_STOCK_COUNT ?? null,
          comingSoonDate:  csDate,
          daysUntil:       comingSoon ? daysUntil(csDate) : null,
        };
      })
    );

    // Sort: in-stock → coming soon (soonest first) → out-of-stock
    items.sort((a, b) => {
      const aIn = a.quantity > 0 && !a.comingSoon;
      const bIn = b.quantity > 0 && !b.comingSoon;
      if (aIn !== bIn) return aIn ? -1 : 1;
      if (a.comingSoon !== b.comingSoon) return a.comingSoon ? -1 : 1;
      if (a.comingSoon && b.comingSoon) return (a.daysUntil ?? 999) - (b.daysUntil ?? 999);
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
