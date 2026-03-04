const CACHE_TTL = 60 * 1000; // 60 seconds
let cache = { data: null, timestamp: 0 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Serve from cache if fresh
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
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
      console.error('Airtable error:', err);
      return res.status(502).json({ error: 'Failed to fetch from Airtable' });
    }

    const json = await airtableRes.json();

    const items = (json.records || []).map((r) => ({
      id: r.id,
      name: r.fields.Name || '',
      price: r.fields.Price ?? null,
      quantity: r.fields.Quantity ?? 0,
      condition: r.fields.Condition || 'New',
      category: r.fields.Category || 'Other',
    }));

    // Sort: in-stock first, then alphabetical within each group
    items.sort((a, b) => {
      if ((a.quantity > 0) !== (b.quantity > 0)) {
        return a.quantity > 0 ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    cache = { data: items, timestamp: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(items);
  } catch (err) {
    console.error('Inventory API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
