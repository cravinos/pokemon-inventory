import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';

const CATEGORIES = ['All', 'Booster Box', 'ETB', 'Tin', 'Blister Pack', 'Bundle', 'Other'];
const CONDITIONS  = ['All', 'New', 'Damaged'];

function formatPrice(p) {
  if (p == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);
}

function formatDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLabel(days) {
  if (days == null)  return null;
  if (days <= 0)     return 'Arriving soon';
  if (days === 1)    return 'Tomorrow';
  return `${days} days away`;
}

function placeholderGradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg,hsl(${hue},35%,10%) 0%,hsl(${(hue+55)%360},45%,17%) 100%)`;
}

function SkeletonCard({ delay }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02]" style={{ animationDelay: `${delay}s` }}>
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

function CardImage({ item }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="relative w-full aspect-video flex items-center justify-center overflow-hidden border-b border-white/[0.05]"
      style={{ background: item.image && !err ? '#ffffff' : placeholderGradient(item.name) }}
    >
      {item.image && !err ? (
        <img src={item.image} alt={item.name} className="w-full h-full object-contain p-3" loading="lazy" onError={() => setErr(true)} />
      ) : (
        <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="2" y="7" width="20" height="14" rx="2" strokeWidth={1} />
          <circle cx="12" cy="14" r="3" strokeWidth={1} />
        </svg>
      )}
      <span className="absolute bottom-2 left-2 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 text-white/40 backdrop-blur-sm border border-white/[0.07]">
        {item.category}
      </span>
    </div>
  );
}

function ProductCard({ item, index }) {
  const ref = useRef(null);
  const inStock = item.quantity > 0;
  const low     = inStock && item.quantity <= 3;

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref} onMouseMove={onMouseMove}
      className={`card-enter card-border group relative flex flex-col rounded-2xl overflow-hidden
        ${inStock ? 'hover:-translate-y-1' : 'opacity-30 grayscale-[50%] pointer-events-none'}`}
      style={{ animationDelay: `${Math.min(index, 15) * 0.04}s` }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0 rounded-2xl"
        style={{ background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <CardImage item={item} />

      <div className="flex flex-col gap-2 p-4 flex-1 z-10">
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold text-white/90 leading-snug flex-1 tracking-tight">{item.name}</span>
          {item.condition === 'Damaged' ? (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300" style={{ boxShadow: '0 0 8px rgba(249,115,22,0.15)' }}>Damaged</span>
          ) : (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.15)' }}>New</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-white/[0.05]">
          {/* Bulk price + stock */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-extrabold price-gradient">
              {item.bulkPrice ? `${formatPrice(item.bulkPrice)}/unit` : '—'}
            </span>
            {inStock ? (
              <span className={`text-xs font-medium flex-shrink-0 ${low ? 'text-orange-300 animate-pulse' : 'text-white/35'}`}>
                {low ? `Only ${item.quantity} left!` : `${item.quantity} units`}
              </span>
            ) : (
              <span className="text-xs text-white/20 italic">Out of stock</span>
            )}
          </div>
          {/* Market reference + bulk % */}
          {item.marketPrice && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/30">
              {item.bulkPercentage && (
                <span className="font-semibold text-indigo-400/70">{item.bulkPercentage}%</span>
              )}
              <span>of {formatPrice(item.marketPrice)} market</span>
            </div>
          )}
          {/* Total for all units */}
          {item.totalValue && inStock && (
            <div className="text-[11px] font-semibold text-white/50">
              {formatPrice(item.totalValue)} for all {item.quantity} units
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoonCard({ item, index }) {
  const ref = useRef(null);
  const days = item.daysUntil;

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref} onMouseMove={onMouseMove}
      className="card-enter group relative flex flex-col rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300"
      style={{
        animationDelay: `${Math.min(index, 15) * 0.04}s`,
        background: 'linear-gradient(#080812, #080812) padding-box, linear-gradient(145deg, rgba(99,102,241,0.45) 0%, rgba(168,85,247,0.2) 50%, rgba(255,255,255,0.05) 100%) border-box',
        border: '1px solid transparent',
      }}
    >
      {/* Spotlight */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0 rounded-2xl"
        style={{ background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.08) 0%, transparent 60%)' }} />

      {/* Top glow bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

      {/* Image with overlay */}
      <div className="relative w-full aspect-video overflow-hidden border-b border-indigo-500/10">
        {(() => {
          const [err, setErr] = useState(false);
          return item.image && !err ? (
            <img src={item.image} alt={item.name}
              className="w-full h-full object-contain p-3 opacity-60 saturate-50"
              style={{ background: '#ffffff' }}
              loading="lazy" onError={() => setErr(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: placeholderGradient(item.name), opacity: 0.5 }}>
              <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="2" y="7" width="20" height="14" rx="2" strokeWidth={1} /><circle cx="12" cy="14" r="3" strokeWidth={1} />
              </svg>
            </div>
          );
        })()}

        {/* Coming soon overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080812]/90 via-[#080812]/40 to-transparent" />

        {/* COMING SOON badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.4)',
            boxShadow: '0 0 12px rgba(99,102,241,0.25)',
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(129,140,248,0.8)' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Coming Soon</span>
        </div>

        <span className="absolute bottom-2 left-2 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 text-white/30 backdrop-blur-sm border border-white/[0.07]">
          {item.category}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4 flex-1 z-10">
        <span className="text-sm font-semibold text-white/80 leading-snug tracking-tight">{item.name}</span>

        {/* Days countdown */}
        {days != null && (
          <div className="flex items-baseline gap-2">
            {days > 0 ? (
              <>
                <span className="text-3xl font-black tabular-nums" style={{
                  background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{days}</span>
                <span className="text-xs text-white/30 font-medium">days away</span>
              </>
            ) : (
              <span className="text-sm font-bold text-indigo-300 animate-pulse">Arriving soon</span>
            )}
          </div>
        )}

        {/* Date + stock row */}
        <div className="flex items-center justify-between pt-2 border-t border-indigo-500/10 mt-auto">
          <div className="flex flex-col gap-0.5">
            {item.comingSoonDate && (
              <span className="text-[11px] text-white/40 font-medium">{formatDate(item.comingSoonDate)}</span>
            )}
            {item.bulkPrice && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold price-gradient">{formatPrice(item.bulkPrice)}/unit</span>
                {item.bulkPercentage && <span className="text-[10px] text-indigo-400/60">{item.bulkPercentage}%</span>}
              </div>
            )}
          </div>
          {item.comingSoonStock && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-white/25 uppercase tracking-wide">Expected</span>
              <span className="text-sm font-bold text-indigo-300">~{item.comingSoonStock} units</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const POWERED_BY = ['shikari.tech', 'refractbot.com', 'bartproxies.com'];

export default function Home() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [cat, setCat]           = useState('All');
  const [cond, setCond]         = useState('All');
  const [discordIcon, setDiscordIcon] = useState(null);

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => { if (!r.ok) throw new Error('Failed to load inventory'); return r.json(); })
      .then(d => { setItems(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch('https://discord.com/api/v10/invites/2qpMW6yrSh')
      .then(r => r.json())
      .then(d => {
        if (d.guild?.icon)
          setDiscordIcon(`https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.png?size=128`);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => items.filter(item => {
    if (cat  !== 'All' && item.category  !== cat)  return false;
    if (cond !== 'All' && item.condition !== cond) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, cat, cond, search]);

  const inStock    = filtered.filter(i => i.quantity > 0 && !i.comingSoon);
  const comingSoon = filtered.filter(i => i.comingSoon);
  const outOfStock = filtered.filter(i => i.quantity === 0 && !i.comingSoon);

  return (
    <>
      <Head>
        <title>Santis Sealed Product</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen dot-grid text-white">

        {/* Header */}
        <header className="relative overflow-hidden border-b border-white/[0.06] pt-16 pb-12 px-4 text-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[260px] rounded-full bg-indigo-600/[0.18] blur-[100px]" />
          </div>
          <div className="absolute bottom-0 left-1/3 w-[300px] h-[150px] rounded-full bg-purple-600/[0.1] blur-[80px] pointer-events-none" />

          {/* Top-left: Powered by */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-white/20">Powered by</span>
            {POWERED_BY.map(domain => (
              <div key={domain} title={domain}
                className="w-5 h-5 rounded overflow-hidden ring-1 ring-white/10 opacity-50 hover:opacity-80 transition-opacity">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt={domain}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Top-right: Discord ACO */}
          <a
            href="https://discord.gg/2qpMW6yrSh"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-4 z-20 group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/40 transition-all"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0 bg-[#5865F2]/20 flex items-center justify-center">
              {discordIcon ? (
                <img src={discordIcon} alt="Discord" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.909 19.909 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[11px] font-bold text-white/80 leading-tight">Join Discord</div>
              <div className="text-[9px] text-white/35 leading-tight">ACO Service</div>
            </div>
            <svg className="w-3 h-3 text-white/25 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <div className="relative z-10 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs font-medium mb-5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              Live inventory
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight gradient-text leading-[1.1] mb-3">Santis Sealed Product</h1>
            <p className="text-white/35 text-sm">Browse available stock · Prices per unit</p>
          </div>
        </header>

        {/* Controls */}
        <div className="sticky top-0 z-30 flex flex-wrap gap-2 px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/60 focus:outline-none focus:border-indigo-500/50 cursor-pointer hover:bg-white/[0.08] transition-all">
            {CATEGORIES.map(c => <option key={c} className="bg-[#0c0c14]">{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <select value={cond} onChange={e => setCond(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/60 focus:outline-none focus:border-indigo-500/50 cursor-pointer hover:bg-white/[0.08] transition-all">
            {CONDITIONS.map(c => <option key={c} className="bg-[#0c0c14]">{c === 'All' ? 'All Conditions' : c}</option>)}
          </select>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="flex gap-5 px-6 py-2.5 text-xs text-white/25 border-b border-white/[0.04]">
            <span><span className="text-indigo-400 font-semibold">{inStock.length}</span> in stock</span>
            {comingSoon.length > 0 && <span><span className="text-indigo-300 font-semibold">{comingSoon.length}</span> coming soon</span>}
            {outOfStock.length > 0 && <span><span className="text-white/35 font-semibold">{outOfStock.length}</span> out of stock</span>}
            <span><span className="text-white/35 font-semibold">{items.length}</span> products</span>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6 pb-24">

          {loading && Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} delay={i * 0.06} />)}

          {error && (
            <div className="col-span-full text-center py-24">
              <p className="text-white/50 font-medium mb-1">Could not load inventory</p>
              <p className="text-sm text-white/25">{error}</p>
            </div>
          )}

          {!loading && !error && inStock.length === 0 && comingSoon.length === 0 && outOfStock.length === 0 && (
            <div className="col-span-full text-center py-24">
              <p className="text-white/50 font-medium mb-1">No results</p>
              <p className="text-sm text-white/25">Try adjusting your search or filters</p>
            </div>
          )}

          {/* In stock */}
          {inStock.map((item, i) => <ProductCard key={item.id} item={item} index={i} />)}

          {/* Coming soon section */}
          {comingSoon.length > 0 && (
            <div className="col-span-full flex items-center gap-3 py-1 mt-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(129,140,248,0.8)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">Coming Soon</span>
              </div>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.3), transparent)' }} />
            </div>
          )}
          {comingSoon.map((item, i) => <ComingSoonCard key={item.id} item={item} index={inStock.length + i} />)}

          {/* Out of stock section */}
          {outOfStock.length > 0 && (inStock.length > 0 || comingSoon.length > 0) && (
            <div className="col-span-full flex items-center gap-3 py-1 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Out of Stock</span>
              <div className="flex-1 h-px bg-white/[0.05]" />
            </div>
          )}
          {outOfStock.map((item, i) => <ProductCard key={item.id} item={item} index={inStock.length + comingSoon.length + i} />)}
        </div>

        <div className="text-center pb-8 text-[11px] text-white/15 tracking-wider uppercase">Updated every 60s</div>
      </div>
    </>
  );
}
