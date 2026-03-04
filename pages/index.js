import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';

const CATEGORIES = ['All', 'Booster Box', 'ETB', 'Tin', 'Blister Pack', 'Bundle', 'Other'];
const CONDITIONS = ['All', 'New', 'Damaged'];

// Deterministic gradient per product name
function getPlaceholderGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,15%) 0%, hsl(${(hue+60)%360},70%,20%) 100%)`;
}

function formatPrice(price) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function SkeletonCards() {
  return Array.from({ length: 8 }).map((_, i) => (
    <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.05}s` }}>
      <div className="skeleton skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line" style={{ width: '80%' }} />
        <div className="skeleton skeleton-line" style={{ width: '50%' }} />
        <div className="skeleton skeleton-line" style={{ width: '65%', marginTop: 8 }} />
      </div>
    </div>
  ));
}

function ProductCard({ item, index }) {
  const cardRef = useRef(null);
  const inStock = item.quantity > 0;
  const low = inStock && item.quantity <= 3;

  // Mouse-tracking holographic effect
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', `${x}%`);
    card.style.setProperty('--my', `${y}%`);
  };

  return (
    <div
      ref={cardRef}
      className={`card${inStock ? '' : ' out-of-stock'}`}
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
      onMouseMove={handleMouseMove}
    >
      {item.image ? (
        <img
          className="card-image"
          src={item.image}
          alt={item.name}
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
          }}
        />
      ) : null}
      <div
        className="card-image-placeholder"
        style={{
          display: item.image ? 'none' : 'flex',
          '--placeholder-bg': getPlaceholderGradient(item.name),
        }}
      >
        ⬡
      </div>

      <div className="card-body">
        <div className="card-top">
          <span className="card-name">{item.name}</span>
          <span className={`badge badge-${item.condition === 'Damaged' ? 'damaged' : 'new'}`}>
            {item.condition || 'New'}
          </span>
        </div>
        <div className="card-category">{item.category}</div>
        <div className="card-footer">
          <span className="card-price">{formatPrice(item.price)}</span>
          {inStock ? (
            <span className={`card-qty${low ? ' low' : ''}`}>
              {low ? `Only ${item.quantity} left!` : `${item.quantity} in stock`}
            </span>
          ) : (
            <span className="out-of-stock-label">Out of stock</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [condition, setCondition] = useState('All');

  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => { if (!r.ok) throw new Error('Failed to load inventory'); return r.json(); })
      .then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (condition !== 'All' && item.condition !== condition) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, category, condition, search]);

  const inStock = filtered.filter((i) => i.quantity > 0);
  const outOfStock = filtered.filter((i) => i.quantity === 0);

  return (
    <>
      <Head>
        <title>Pokemon Sealed Inventory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#07070f" />
      </Head>

      <header className="header">
        <div className="header-inner">
          <svg className="pokeball" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
            <path d="M2 50 Q2 2 50 2 Q98 2 98 50" fill="rgba(99,102,241,0.25)"/>
            <path d="M2 50 Q2 98 50 98 Q98 98 98 50" fill="rgba(30,30,60,0.4)"/>
            <rect x="2" y="47" width="96" height="6" fill="rgba(255,255,255,0.12)"/>
            <circle cx="50" cy="50" r="12" fill="#07070f" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
            <circle cx="50" cy="50" r="7" fill="rgba(129,140,248,0.6)"/>
          </svg>
          <h1>Sealed Pokemon Inventory</h1>
          <p>Live stock — updated in real time</p>
        </div>
      </header>

      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {CONDITIONS.map((c) => <option key={c}>{c === 'All' ? 'All Conditions' : c}</option>)}
        </select>
      </div>

      {!loading && !error && (
        <div className="stats">
          <span><strong>{inStock.length}</strong> in stock</span>
          {outOfStock.length > 0 && <span><strong>{outOfStock.length}</strong> out of stock</span>}
          {items.length > 0 && <span><strong>{items.length}</strong> total products</span>}
        </div>
      )}

      <div className="grid">
        {loading && <SkeletonCards />}
        {error && (
          <div className="state">
            <h2>Could not load inventory</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && inStock.length === 0 && outOfStock.length === 0 && (
          <div className="state">
            <h2>No results</h2>
            <p>Try a different search or filter.</p>
          </div>
        )}

        {inStock.map((item, i) => <ProductCard key={item.id} item={item} index={i} />)}

        {outOfStock.length > 0 && inStock.length > 0 && (
          <div className="section-divider">Out of Stock</div>
        )}

        {outOfStock.map((item, i) => (
          <ProductCard key={item.id} item={item} index={inStock.length + i} />
        ))}
      </div>
    </>
  );
}
