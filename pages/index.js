import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';

const CATEGORIES = ['All Categories', 'Booster Box', 'ETB', 'Tin', 'Blister Pack', 'Bundle', 'Other'];
const CONDITIONS = ['All Conditions', 'New', 'Damaged'];

function formatPrice(price) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function ConditionBadge({ condition }) {
  const cls = condition === 'Damaged' ? 'badge badge-damaged' : 'badge badge-new';
  return <span className={cls}>{condition || 'New'}</span>;
}

function ProductCard({ item }) {
  const inStock = item.quantity > 0;
  const low = inStock && item.quantity <= 3;

  return (
    <div className={`card${inStock ? '' : ' out-of-stock'}`}>
      <div className="card-header">
        <span className="card-name">{item.name}</span>
        <ConditionBadge condition={item.condition} />
      </div>
      <div className="card-category">{item.category}</div>
      <div className="card-footer">
        <span className="card-price">{formatPrice(item.price)}</span>
        {inStock ? (
          <span className={`card-qty${low ? ' low' : ''}`}>
            {low ? `Only ${item.quantity} left` : `${item.quantity} in stock`}
          </span>
        ) : (
          <span className="out-of-stock-label">Out of stock</span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All Categories');
  const [condition, setCondition] = useState('All Conditions');

  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load inventory');
        return r.json();
      })
      .then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== 'All Categories' && item.category !== category) return false;
      if (condition !== 'All Conditions' && item.condition !== condition) return false;
      return true;
    });
  }, [items, category, condition]);

  const inStock = filtered.filter((i) => i.quantity > 0);
  const outOfStock = filtered.filter((i) => i.quantity === 0);

  return (
    <>
      <Head>
        <title>Pokemon Sealed Inventory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Browse available sealed Pokemon product inventory." />
      </Head>

      <header className="header">
        <h1>Pokemon Sealed Inventory</h1>
        <p>Browse available stock — prices per unit</p>
      </header>

      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading && <div className="state"><p>Loading inventory...</p></div>}
      {error   && <div className="state"><h2>Could not load inventory</h2><p>{error}</p></div>}

      {!loading && !error && (
        <>
          <div className="result-count">
            {inStock.length} item{inStock.length !== 1 ? 's' : ''} in stock
            {outOfStock.length > 0 && ` · ${outOfStock.length} out of stock`}
          </div>
          <div className="grid">
            {inStock.length === 0 && outOfStock.length === 0 && (
              <div className="state" style={{ gridColumn: '1/-1' }}>
                <h2>No items match</h2>
                <p>Try adjusting the filters above.</p>
              </div>
            )}

            {inStock.map((item) => <ProductCard key={item.id} item={item} />)}

            {outOfStock.length > 0 && inStock.length > 0 && (
              <div className="section-divider">Out of Stock</div>
            )}

            {outOfStock.map((item) => <ProductCard key={item.id} item={item} />)}
          </div>
        </>
      )}
    </>
  );
}
