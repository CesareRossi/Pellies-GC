import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { motion } from 'framer-motion';
import { Share, Download, X, Trophy } from '@phosphor-icons/react';

// Render the recap card visually (re-used both for the on-screen preview and the image capture)
const RecapCard = React.forwardRef(({ season }, ref) => {
  const s = season?.summary_json || {};
  const champ = s.champion;
  const team = s.champion_team;
  const awards = s.awards?.season || {};
  const perRound = s.awards?.per_round || [];
  const beerRounds = perRound.filter(r => r.has_scores && r.beer_hole_winner);
  const endDate = season?.ended_at ? new Date(season.ended_at) : null;

  const fmtBeer = (r) => {
    const names = r.beer_hole_winner?.names || [];
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(' & ');
    return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
  };

  return (
    <div
      ref={ref}
      // Fixed width 1080x1350 (Instagram / WhatsApp friendly 4:5)
      style={{ width: 1080, minHeight: 1350, fontFamily: "'DM Sans', system-ui, sans-serif" }}
      className="relative overflow-hidden bg-[#051A10] text-white"
    >
      {/* Layered textured background */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(1200px 800px at 50% -20%, rgba(212,175,55,0.25), transparent 60%), radial-gradient(800px 600px at 100% 100%, rgba(22,58,39,0.9), transparent 70%), linear-gradient(180deg, #0A2618 0%, #051A10 100%)',
      }} />
      {/* Subtle top gold stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />

      <div className="relative z-10 px-16 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="uppercase tracking-[0.4em] text-[#D4AF37] text-sm mb-3">Season Recap</p>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-6xl text-[#F1D67E] leading-tight mb-3">
            {season?.name || 'Pellies Golf League'}
          </h1>
          {endDate && (
            <p className="text-[#A9C5B4] text-lg">
              Final standings · {endDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Champion hero */}
        <div
          className="rounded-3xl p-10 mb-8 border border-[#D4AF37]/40 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.05) 50%, transparent 100%)' }}
        >
          <div className="absolute -right-16 -top-16 text-[280px] leading-none opacity-10">🏆</div>
          <div className="relative">
            <p className="uppercase tracking-[0.3em] text-[#D4AF37] text-xs mb-3 font-semibold">League Champion</p>
            <p style={{ fontFamily: "'Fraunces', serif" }} className="text-7xl text-white font-bold mb-2">
              {champ?.player || '—'}
            </p>
            <p className="text-3xl text-[#D4AF37] font-bold">{champ?.total ?? 0} points</p>
          </div>
        </div>

        {/* Top Team */}
        {team && (
          <div className="rounded-2xl p-8 mb-8 bg-[#0F2C1D]/80 border border-emerald-500/25">
            <div className="flex items-center gap-4">
              <div className="text-5xl">👥</div>
              <div className="flex-1 min-w-0">
                <p className="uppercase tracking-[0.2em] text-emerald-300 text-xs mb-1 font-semibold">Top Team</p>
                <p style={{ fontFamily: "'Fraunces', serif" }} className="text-4xl text-white font-semibold">{team.player || '—'}</p>
              </div>
              <p className="text-3xl text-emerald-300 font-bold whitespace-nowrap">{team.total ?? 0} pts</p>
            </div>
          </div>
        )}

        {/* Awards grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl p-6 bg-amber-500/10 border border-amber-500/30">
            <div className="text-4xl mb-2">🥄</div>
            <p className="uppercase tracking-wider text-amber-300 text-xs mb-1 font-semibold">Wooden Spoon Leader</p>
            <p className="text-3xl text-white font-bold leading-tight">{awards.wooden_spoon_leader?.player || '—'}</p>
            {awards.wooden_spoon_leader?.count > 0 && (
              <p className="text-sm text-amber-200/80 mt-1">{awards.wooden_spoon_leader.count}× worst round</p>
            )}
          </div>
          <div className="rounded-2xl p-6 bg-purple-500/10 border border-purple-500/30">
            <div className="text-4xl mb-2">🎭</div>
            <p className="uppercase tracking-wider text-purple-300 text-xs mb-1 font-semibold">Joker King</p>
            <p className="text-3xl text-white font-bold leading-tight">{awards.joker_king?.player || '—'}</p>
            {awards.joker_king?.bonus > 0 && (
              <p className="text-sm text-purple-200/80 mt-1">+{awards.joker_king.bonus} bonus pts</p>
            )}
          </div>
        </div>

        {/* Drinks watch */}
        {beerRounds.length > 0 && (
          <div className="rounded-2xl p-6 bg-rose-500/10 border border-rose-500/30 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">🍺</div>
              <div>
                <p className="uppercase tracking-wider text-rose-300 text-xs font-semibold">Drinks Watch</p>
                <p className="text-sm text-rose-200/70">Beer-hole winners across the season</p>
              </div>
            </div>
            <div className="space-y-2">
              {beerRounds.slice(0, 6).map(r => (
                <div key={r.round_number} className="flex items-center justify-between bg-[#051A10]/50 rounded-lg px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-rose-200/70 uppercase tracking-wider">R{r.round_number} · {r.course}</p>
                    <p className="text-white text-lg font-semibold">{fmtBeer(r)}</p>
                  </div>
                  <p className="text-rose-300 font-bold text-xl">H{r.beer_hole}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-[#D4AF37]/20 text-center">
          <p style={{ fontFamily: "'Fraunces', serif" }} className="text-[#D4AF37] text-2xl tracking-wide">Pellies GC</p>
          <p className="text-[#A9C5B4]/70 text-sm mt-1 tracking-widest uppercase">League Recap · Fairway Glory</p>
        </div>
      </div>
    </div>
  );
});
RecapCard.displayName = 'RecapCard';

async function generatePng(node) {
  // html-to-image: scale up for crisp social-media quality
  return await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#051A10',
  });
}

async function tryShare(dataUrl, filename) {
  // Convert to Blob → File for Web Share Level 2
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Pellies GC — Season Recap',
      text: 'Season recap — Pellies Golf League 🏆',
    });
    return true;
  }
  return false;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Modal that renders the recap card, offers Share / Download
export default function SeasonRecapModal({ season, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const safeName = (season?.name || 'season').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const filename = `pellies-recap-${safeName}.png`;

  const handleShare = async () => {
    if (!cardRef.current) return;
    setBusy(true); setMsg('');
    try {
      const dataUrl = await generatePng(cardRef.current);
      const shared = await tryShare(dataUrl, filename).catch(() => false);
      if (!shared) {
        downloadDataUrl(dataUrl, filename);
        setMsg('Saved! The image has been downloaded — drop it into WhatsApp.');
      } else {
        setMsg('Opening share sheet…');
      }
    } catch (e) {
      setMsg('Error: ' + (e.message || 'Could not generate image'));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true); setMsg('');
    try {
      const dataUrl = await generatePng(cardRef.current);
      downloadDataUrl(dataUrl, filename);
      setMsg('Downloaded ✓');
    } catch (e) {
      setMsg('Error: ' + (e.message || 'Could not generate image'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-[#051A10]/90 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl my-6 rounded-2xl border border-[#D4AF37]/30 bg-[#0F2C1D] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[#D4AF37]" weight="duotone" />
            <h2 className="text-base font-serif text-[#D4AF37]">Share Season Recap</h2>
          </div>
          <button onClick={onClose} className="text-[#A9C5B4] hover:text-white" data-testid="recap-close"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Preview — scaled down */}
          <div className="rounded-xl border border-[#D4AF37]/15 bg-[#051A10] overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
              {/* Scale 0.4 for preview, true size offscreen version is what gets captured */}
              <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: 1080 }}>
                <RecapCard ref={cardRef} season={season} />
              </div>
              {/* Placeholder sizing so container respects scaled content */}
              <div style={{ height: 0 }} />
            </div>
          </div>
          {msg && <p className={`text-xs ${msg.startsWith('Error') ? 'text-red-400' : 'text-emerald-300'}`} data-testid="recap-msg">{msg}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] disabled:opacity-50"
              data-testid="recap-share-btn"
            >
              <Share size={16} weight="bold" /> {busy ? 'Working…' : 'Share / Download'}
            </button>
            <button
              onClick={handleDownload}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-sm hover:bg-[#D4AF37]/10 disabled:opacity-50"
              data-testid="recap-download-btn"
            >
              <Download size={16} weight="bold" />
            </button>
          </div>
          <p className="text-[11px] text-[#A9C5B4]/60 italic text-center">
            On mobile: opens the native share sheet (WhatsApp, Messages…). On desktop: downloads a PNG you can drop in any chat.
          </p>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
