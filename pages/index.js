import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';

const CATEGORIES = ['All', 'Booster Box', 'ETB', 'Tin', 'Blister Pack', 'Bundle', 'Other'];
const CONDITIONS  = ['All', 'New', 'Damaged'];

function formatPrice(p) {
  if (p == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);
}

// Deterministic unique gradient per product (for placeholder cards)
function placeholderGradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg,hsl(${hue},35%,10%) 0%,hsl(${(hue+55)%360},45%,17%) 100%)`;
}

function SkeletonCard({ delay }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02]"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="skeleton w-full aspect-video" />
      <div className="p-4 flex flex-col gap-3">
        <div className="skeleton h-3 rounded-md w-4/5" />
        <div className="skeleton h-3 rounded-md w-2/5" />
        <div className="flex justify-between mt-1">
          <div className="skeleton h-4 rounded-md w-1/3" />
          <div className="skeleton h-3 rounded-md w-1/4" />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ item, index }) {
  const ref = useRef(null);
  const [imgErr, setImgErr] = useState(false);
  const inStock = item.quantity > 0;
  const low = inStock && item.quantity <= 3;

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`card-enter card-border group relative flex flex-col rounded-2xl overflow-hidden
        ${inStock ? 'hover:-translate-y-1' : 'opacity-30 grayscale-[50%] pointer-events-none'}`}
      style={{ animationDelay: `${Math.min(index, 15) * 0.04}s` }}
    >
      {/* Mouse spotlight */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0 rounded-2xl"
        style={{ background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.05) 0%, transparent 60%)' }}
      />

      {/* Image / placeholder */}
      <div
        className="relative w-full aspect-video flex items-center justify-center overflow-hidden border-b border-white/[0.05]"
        style={{ background: item.image && !imgErr ? 'rgba(255,255,255,0.03)' : placeholderGradient(item.name) }}
      >
        {item.image && !imgErr ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-contain p-2"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
            <circle cx="12" cy="12" r="3" strokeWidth={1} />
          </svg>
        )}

        {/* Category chip floating on image */}
        <span className="absolute bottom-2 left-2 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 text-white/40 backdrop-blur-sm border border-white/[0.07]">
          {item.category}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 flex-1 z-10">
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold text-white/90 leading-snug flex-1 tracking-tight">
            {item.name}
          </span>
          {item.condition === 'Damaged' ? (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300" style={{ boxShadow: '0 0 8px rgba(249,115,22,0.15)' }}>
              Damaged
            </span>
          ) : (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.15)' }}>
              New
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.05]">
          <span className="text-base font-extrabold price-gradient">{formatPrice(item.price)}</span>
          {inStock ? (
            <span className={`text-xs font-medium ${low ? 'text-orange-300 animate-pulse' : 'text-white/35'}`}>
              {low ? `Only ${item.quantity} left!` : `${item.quantity} in stock`}
            </span>
          ) : (
            <span className="text-xs text-white/20 italic">Out of stock</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [cat, setCat]         = useState('All');
  const [cond, setCond]       = useState('All');

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => { if (!r.ok) throw new Error('Failed to load inventory'); return r.json(); })
      .then(d => { setItems(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => items.filter(item => {
    if (cat  !== 'All' && item.category  !== cat)  return false;
    if (cond !== 'All' && item.condition !== cond) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, cat, cond, search]);

  const inStock    = filtered.filter(i => i.quantity > 0);
  const outOfStock = filtered.filter(i => i.quantity === 0);

  return (
    <>
      <Head>
        <title>Pokemon Sealed Inventory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen dot-grid text-white">

        {/* ── Header ── */}
        <header className="relative overflow-hidden border-b border-white/[0.06] pt-16 pb-12 px-6 text-center">
          {/* Purple gradient orb */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[260px] rounded-full bg-indigo-600/[0.18] blur-[100px]" />
          </div>
          {/* Second orb for depth */}
          <div className="absolute bottom-0 left-1/3 w-[300px] h-[150px] rounded-full bg-purple-600/[0.1] blur-[80px] pointer-events-none" />

          <div className="relative z-10 max-w-lg mx-auto">
            {/* Live pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs font-medium mb-5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              Live inventory
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight gradient-text leading-[1.1] mb-3">
              Pokemon Sealed
            </h1>
            <p className="text-white/35 text-sm">
              Browse available stock · Prices per unit
            </p>
          </div>
        </header>

        {/* ── Sticky controls ── */}
        <div className="sticky top-0 z-30 flex flex-wrap gap-2 px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* Category */}
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/60 focus:outline-none focus:border-indigo-500/50 cursor-pointer hover:bg-white/[0.08] transition-all">
            {CATEGORIES.map(c => <option key={c} className="bg-[#0c0c14]">{c === 'All' ? 'All Categories' : c}</option>)}
          </select>

          {/* Condition */}
          <select value={cond} onChange={e => setCond(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/60 focus:outline-none focus:border-indigo-500/50 cursor-pointer hover:bg-white/[0.08] transition-all">
            {CONDITIONS.map(c => <option key={c} className="bg-[#0c0c14]">{c === 'All' ? 'All Conditions' : c}</option>)}
          </select>
        </div>

        {/* ── Stats ── */}
        {!loading && !error && (
          <div className="flex gap-5 px-6 py-2.5 text-xs text-white/25 border-b border-white/[0.04]">
            <span><span className="text-indigo-400 font-semibold">{inStock.length}</span> in stock</span>
            {outOfStock.length > 0 && <span><span className="text-white/35 font-semibold">{outOfStock.length}</span> out of stock</span>}
            <span><span className="text-white/35 font-semibold">{items.length}</span> products</span>
          </div>
        )}

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6 pb-24">

          {loading && Array.from({ length: 10 }).map((_, i) =>
            <SkeletonCard key={i} delay={i * 0.06} />
          )}

          {error && (
            <div className="col-span-full text-center py-24">
              <p className="text-white/50 font-medium mb-1">Could not load inventory</p>
              <p className="text-sm text-white/25">{error}</p>
            </div>
          )}

          {!loading && !error && inStock.length === 0 && outOfStock.length === 0 && (
            <div className="col-span-full text-center py-24">
              <p className="text-white/50 font-medium mb-1">No results</p>
              <p className="text-sm text-white/25">Try adjusting your search or filters</p>
            </div>
          )}

          {inStock.map((item, i) => <ProductCard key={item.id} item={item} index={i} />)}

          {outOfStock.length > 0 && inStock.length > 0 && (
            <div className="col-span-full flex items-center gap-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Out of stock</span>
              <div className="flex-1 h-px bg-white/[0.05]" />
            </div>
          )}

          {outOfStock.map((item, i) =>
            <ProductCard key={item.id} item={item} index={inStock.length + i} />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pb-8 text-[11px] text-white/15 tracking-wider uppercase">
          Updated every 60s
        </div>
      </div>
    </>
  );
}
