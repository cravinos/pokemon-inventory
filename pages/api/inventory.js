const INVENTORY_TTL = 60  * 1000;
const SETS_TTL      = 60  * 60 * 1000;
const IMG_TTL       = 24  * 60 * 60 * 1000;
const TCG_TTL       = 24  * 60 * 60 * 1000;

let inventoryCache = { data: null, timestamp: 0, lastChangedAt: null, snapshot: null };
let setsCache      = { data: null, timestamp: 0 };
let imgCache       = {};   // name  → { url, ts }
let tcgCache       = {};   // url   → { image, marketPrice, ts }

// ── Pokemon TCG API sets ────────────────────────────────────────────────────
async function getSets() {
  if (setsCache.data && Date.now() - setsCache.timestamp < SETS_TTL) return setsCache.data;
  try {
    const r = await fetch('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate');
    const j = await r.json();
    setsCache = { data: j.data || [], timestamp: Date.now() };
    return setsCache.data;
  } catch { return setsCache.data || []; }
}

function findBestSet(sets, productName) {
  const name = productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  let best = null, bestScore = 0;
  for (const set of sets) {
    const sn = set.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (name.includes(sn) && sn.length > bestScore) { best = set; bestScore = sn.length; }
  }
  return best;
}

// ── TCGPlayer: image CDN + market price scrape ──────────────────────────────
function extractTCGProductId(url) {
  const m = (url || '').match(/\/product\/(\d+)\//);
  return m ? m[1] : null;
}

async function fetchTCGPlayerData(rawUrl) {
  if (!rawUrl) return { image: null, marketPrice: null };

  const cached = tcgCache[rawUrl];
  // Use shorter TTL for failed fetches so we retry sooner
  const ttl = cached?.marketPrice ? TCG_TTL : 5 * 60 * 1000;
  if (cached && Date.now() - cached.ts < ttl) {
    return { image: cached.image, marketPrice: cached.marketPrice };
  }

  const productId = extractTCGProductId(rawUrl);
  const image = productId
    ? `https://product-images.tcgplayer.com/fit-in/437x437/${productId}.jpg`
    : null;

  let marketPrice = null;

  // Method 1: TCGPlayer internal price API (no auth needed for reads)
  if (productId) {
    try {
      const r = await fetch(
        `https://mpapi.tcgplayer.com/v2/product/${productId}/pricepoints`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.tcgplayer.com/',
            'Origin': 'https://www.tcgplayer.com',
          },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (r.ok) {
        const d = await r.json();
        // Grab the lowest market price across all printings/conditions
        const prices = (d?.results ?? []).flatMap(p => p?.marketPrice ?? []);
        const found = prices.find(p => p > 0);
        if (found) marketPrice = found;
        // Also try nested structure
        if (!marketPrice) {
          const flat = JSON.stringify(d).match(/"marketPrice":([\d.]+)/);
          if (flat) marketPrice = parseFloat(flat[1]);
        }
      }
    } catch (e) {
      console.error('TCGPlayer price API error:', e.message);
    }
  }

  // Method 2: Parse __NEXT_DATA__ from the product page HTML (SSR JSON blob)
  if (!marketPrice) {
    try {
      const cleanUrl = rawUrl.split('?')[0];
      const r = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });
      const html = await r.text();

      // Primary: __NEXT_DATA__ contains full SSR page state
      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
        const blob = nextMatch[1];
        const m = blob.match(/"marketPrice":([\d.]+)/);
        if (m) marketPrice = parseFloat(m[1]);
      }

      // Fallback regex patterns on full HTML
      if (!marketPrice) {
        for (const pat of [
          /"marketPrice":\s*([\d.]+)/,
          /"market":\s*\{[^}]*?"value":\s*([\d.]+)/,
          /Market Price[\s\S]{0,80}\$([\d,]+\.?\d*)/i,
        ]) {
          const m = html.match(pat);
          if (m) { marketPrice = parseFloat(m[1].replace(/,/g, '')); break; }
        }
      }
    } catch (e) {
      console.error('TCGPlayer HTML scrape error:', e.message);
    }
  }

  console.log(`TCGPlayer [${productId}] marketPrice=${marketPrice}`);
  tcgCache[rawUrl] = { image, marketPrice, ts: Date.now() };
  return { image, marketPrice };
}

// ── Bulk price calculation ──────────────────────────────────────────────────
function calcBulkPrice(marketPrice, bulkPct) {
  if (!marketPrice || !bulkPct) return null;
  return Math.round(marketPrice * (bulkPct / 100) * 100) / 100;
}

// ── Fallback image search (TCG card art) ────────────────────────────────────
async function getSetImage(sets, name) {
  const set = findBestSet(sets, name);
  if (set?.images?.logo) return set.images.logo;
  if (set) {
    try {
      const r = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${set.id}&pageSize=1&select=images`,
        { signal: AbortSignal.timeout(3000) }
      );
      const d = await r.json();
      const img = d.data?.[0]?.images?.large;
      if (img) return img;
    } catch { /* fine */ }
  }
  return null;
}

// ── Days until ──────────────────────────────────────────────────────────────
function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (inventoryCache.data && Date.now() - inventoryCache.timestamp < INVENTORY_TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    return res.status(200).json({ items: inventoryCache.data, lastUpdated: inventoryCache.lastChangedAt });
  }

  const token     = process.env.AIRTABLE_TOKEN;
  const baseId    = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Inventory';
  if (!token || !baseId) return res.status(500).json({ error: 'Airtable credentials not configured' });

  try {
    const fieldNames = [
      'Name', 'Quantity', 'Condition', 'Category',
      'COMING_SOON', 'COMING_SOON_STOCK_COUNT', 'COMING_SOON_DATE',
      'TCG_PLAYER_LINK', 'BULK_PERCENTAGE',
    ];
    const fields = fieldNames.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');
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
        const name          = r.fields.Name || '';
        const quantity      = r.fields.Quantity ?? 0;
        const bulkPct       = r.fields.BULK_PERCENTAGE ?? null;
        const tcgUrl        = r.fields.TCG_PLAYER_LINK || null;
        const comingSoon    = !!r.fields.COMING_SOON;
        const csDate        = r.fields.COMING_SOON_DATE || null;

        const { image: tcgImage, marketPrice } = await fetchTCGPlayerData(tcgUrl);
        const image      = tcgImage || await getSetImage(sets, name);
        const bulkPrice  = calcBulkPrice(marketPrice, bulkPct);
        const totalValue = bulkPrice && quantity > 0
          ? Math.round(bulkPrice * quantity * 100) / 100
          : null;

        return {
          id:              r.id,
          name,
          quantity,
          condition:       r.fields.Condition || 'New',
          category:        r.fields.Category || 'Other',
          image,
          marketPrice,
          bulkPercentage:  bulkPct,
          bulkPrice,
          totalValue,
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

    // Detect if inventory actually changed to track real last-updated time
    const snapshot = JSON.stringify(items.map(i => ({ id: i.id, quantity: i.quantity, name: i.name, condition: i.condition, category: i.category, comingSoon: i.comingSoon })));
    const changed  = snapshot !== inventoryCache.snapshot;
    const lastChangedAt = changed ? new Date().toISOString() : (inventoryCache.lastChangedAt ?? new Date().toISOString());

    inventoryCache = { data: items, timestamp: Date.now(), lastChangedAt, snapshot };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    res.status(200).json({ items, lastUpdated: lastChangedAt });
  } catch (err) {
    console.error('Inventory API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
