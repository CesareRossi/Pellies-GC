import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toBlob } from 'html-to-image';
import { motion } from 'framer-motion';
import { Share, Download, X, Trophy } from '@phosphor-icons/react';

// Pure-CSS recap card. Uses only inline styles so html-to-image doesn't
// need to walk external stylesheets (which was triggering CORS font errors).
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

  // All styles inline to sidestep the html-to-image font/CSS embed failures
  const root = {
    width: 1080,
    minHeight: 1350,
    padding: '64px',
    background:
      'radial-gradient(1200px 800px at 50% -20%, rgba(212,175,55,0.28), transparent 60%),' +
      'radial-gradient(800px 600px at 100% 100%, rgba(22,58,39,0.9), transparent 70%),' +
      'linear-gradient(180deg, #0A2618 0%, #051A10 100%)',
    color: '#FFFFFF',
    fontFamily: "Georgia, 'Times New Roman', serif",
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  };
  const topStripe = {
    position: 'absolute', top: 0, left: 0, right: 0, height: 6,
    background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
  };
  const eyebrow = {
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: '#D4AF37',
    fontSize: 14,
    marginBottom: 12,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 600,
  };
  const titleStyle = {
    fontSize: 68,
    color: '#F1D67E',
    lineHeight: 1.1,
    margin: '0 0 12px',
    fontWeight: 600,
  };
  const subtitle = {
    color: '#A9C5B4',
    fontSize: 18,
    fontFamily: 'Helvetica, Arial, sans-serif',
    margin: 0,
  };
  const champCard = {
    marginTop: 40,
    padding: '40px 44px',
    borderRadius: 28,
    border: '1px solid rgba(212,175,55,0.45)',
    background: 'linear-gradient(135deg, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.05) 60%, transparent 100%)',
    position: 'relative',
    overflow: 'hidden',
  };
  const watermark = {
    position: 'absolute', right: -80, top: -80,
    fontSize: 280, lineHeight: 1, opacity: 0.1,
  };
  const champLabel = {
    letterSpacing: '0.3em', textTransform: 'uppercase', color: '#D4AF37',
    fontSize: 13, marginBottom: 12, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600,
  };
  const champName = { fontSize: 84, color: '#FFFFFF', fontWeight: 700, margin: '0 0 6px', lineHeight: 1 };
  const champScore = { fontSize: 34, color: '#D4AF37', fontWeight: 700, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' };

  const teamCard = {
    marginTop: 28,
    padding: '28px 32px',
    borderRadius: 22,
    background: 'rgba(15,44,29,0.85)',
    border: '1px solid rgba(16,185,129,0.3)',
    display: 'flex', alignItems: 'center', gap: 20,
  };
  const emojiBig = { fontSize: 56 };
  const teamLabel = { letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6EE7B7', fontSize: 12, marginBottom: 4, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 };
  const teamName = { fontSize: 42, color: '#FFFFFF', fontWeight: 600, margin: 0 };
  const teamPts = { fontSize: 30, color: '#6EE7B7', fontWeight: 700, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' };

  const gridAwards = { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
  const awardCard = (bg, border, color) => ({
    padding: 24, borderRadius: 20, background: bg, border: `1px solid ${border}`,
  });
  const awardLabel = (color) => ({
    color, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 11,
    marginBottom: 6, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600,
  });
  const awardName = { fontSize: 32, color: '#FFFFFF', fontWeight: 700, lineHeight: 1.1, margin: 0 };
  const awardSub = (color) => ({ fontSize: 14, color, marginTop: 4, fontFamily: 'Helvetica, Arial, sans-serif', opacity: 0.85 });

  const drinksCard = {
    marginTop: 28, padding: '24px 28px', borderRadius: 22,
    background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
  };
  const drinksHeaderRow = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 };
  const drinksLabel = { letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FCA5A5', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 };
  const drinksSub = { color: 'rgba(252,165,165,0.8)', fontSize: 14, marginTop: 2, fontFamily: 'Helvetica, Arial, sans-serif' };
  const drinksRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(5,26,16,0.55)', borderRadius: 12, marginBottom: 8 };

  const footer = {
    marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(212,175,55,0.25)', textAlign: 'center',
  };
  const footerBrand = { fontSize: 26, color: '#D4AF37', margin: 0, letterSpacing: '0.08em', fontWeight: 600 };
  const footerSub = { fontSize: 13, color: 'rgba(169,197,180,0.7)', marginTop: 4, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Helvetica, Arial, sans-serif' };

  return (
    <div ref={ref} style={root}>
      <div style={topStripe} />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={eyebrow}>Season Recap</div>
        <h1 style={titleStyle}>{season?.name || 'Pellies Golf League'}</h1>
        {endDate && (
          <p style={subtitle}>
            Final standings · {endDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      <div style={champCard}>
        <div style={watermark}>🏆</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={champLabel}>League Champion</div>
          <div style={champName}>{champ?.player || '—'}</div>
          <div style={champScore}>{champ?.total ?? 0} points</div>
        </div>
      </div>

      {team && (
        <div style={teamCard}>
          <div style={emojiBig}>👥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={teamLabel}>Top Team</div>
            <div style={teamName}>{team.player || '—'}</div>
          </div>
          <div style={teamPts}>{team.total ?? 0} pts</div>
        </div>
      )}

      <div style={gridAwards}>
        <div style={awardCard('rgba(245,158,11,0.12)', 'rgba(245,158,11,0.35)')}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🥄</div>
          <div style={awardLabel('#FCD34D')}>Wooden Spoon Leader</div>
          <div style={awardName}>{awards.wooden_spoon_leader?.player || '—'}</div>
          {awards.wooden_spoon_leader?.count > 0 && (
            <div style={awardSub('#FCD34D')}>{awards.wooden_spoon_leader.count}× worst round</div>
          )}
        </div>
        <div style={awardCard('rgba(168,85,247,0.12)', 'rgba(168,85,247,0.35)')}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎭</div>
          <div style={awardLabel('#D8B4FE')}>Joker King</div>
          <div style={awardName}>{awards.joker_king?.player || '—'}</div>
          {awards.joker_king?.bonus > 0 && (
            <div style={awardSub('#D8B4FE')}>+{awards.joker_king.bonus} bonus pts</div>
          )}
        </div>
      </div>

      {beerRounds.length > 0 && (
        <div style={drinksCard}>
          <div style={drinksHeaderRow}>
            <div style={{ fontSize: 36 }}>🍺</div>
            <div>
              <div style={drinksLabel}>Drinks Watch</div>
              <div style={drinksSub}>Beer-hole winners across the season</div>
            </div>
          </div>
          <div>
            {beerRounds.slice(0, 6).map(r => (
              <div key={r.round_number} style={drinksRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'rgba(252,165,165,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 600 }}>
                    R{r.round_number} · {r.course}
                  </div>
                  <div style={{ fontSize: 20, color: '#FFFFFF', fontWeight: 600, marginTop: 2 }}>
                    {fmtBeer(r)}
                  </div>
                </div>
                <div style={{ fontSize: 24, color: '#FCA5A5', fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  H{r.beer_hole}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={footer}>
        <div style={footerBrand}>Pellies GC</div>
        <div style={footerSub}>League Recap · Fairway Glory</div>
      </div>
    </div>
  );
});
RecapCard.displayName = 'RecapCard';

// Convert DOM node → PNG Blob at full native size.
// skipFonts bypasses the googlefonts CSS embed step which throws CORS errors.
async function nodeToPngBlob(node) {
  return await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    skipFonts: true,
    backgroundColor: '#051A10',
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Keep the object URL alive for ~60s so slow/native save dialogs aren't broken
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function tryNativeShare(blob, filename) {
  if (!blob) return false;
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Pellies GC — Season Recap',
        text: 'Season recap — Pellies Golf League 🏆',
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Open the blob in a new window as an absolute last-resort fallback if
// the anchor download attribute is blocked.
function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  // Don't revoke immediately — the tab needs to load.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return !!win;
}

// Modal that renders the recap card (offscreen full-size + scaled-down preview)
export default function SeasonRecapModal({ season, onClose }) {
  const captureRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const safeName = (season?.name || 'season').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const filename = `pellies-recap-${safeName}.png`;

  // Always generate first → show preview → then attempt share or download.
  // Preview is shown regardless so the user can right-click / long-press save
  // as a guaranteed fallback on any browser.
  const generate = async () => {
    if (!captureRef.current) throw new Error('Preview not ready — reopen the modal.');
    const blob = await nodeToPngBlob(captureRef.current);
    if (!blob) throw new Error('The browser returned an empty image. Try again.');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return blob;
  };

  const handleShare = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await generate();
      const shared = await tryNativeShare(blob, filename);
      if (shared) {
        setMsg('Shared ✓');
      } else {
        downloadBlob(blob, filename);
        setMsg('Downloaded ✓ — if nothing appeared, right-click the preview above and choose "Save image as".');
      }
    } catch (e) {
      setMsg('Error: ' + (e?.message || 'Could not generate image'));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await generate();
      downloadBlob(blob, filename);
      setMsg('Downloaded ✓ — if nothing appeared, right-click the preview above and choose "Save image as".');
    } catch (e) {
      setMsg('Error: ' + (e?.message || 'Could not generate image'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTab = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await generate();
      const opened = openBlobInNewTab(blob);
      setMsg(opened ? 'Opened in new tab — long-press / right-click to save.' : 'Blocked by popup blocker — please use Download instead.');
    } catch (e) {
      setMsg('Error: ' + (e?.message || 'Could not generate image'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      {/* Offscreen capture node — full native 1080px width. html-to-image
         captures this, not the scaled preview. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 1080,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <RecapCard ref={captureRef} season={season} />
      </div>

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
            {/* Preview — if we already generated once, show the real PNG.
                Otherwise, show a scaled-down live preview of the card. */}
            <div className="rounded-xl border border-[#D4AF37]/15 bg-[#051A10] overflow-hidden flex items-start justify-center" style={{ maxHeight: '60vh' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Season recap" style={{ maxWidth: '100%', height: 'auto' }} />
              ) : (
                <div style={{ transform: 'scale(0.4)', transformOrigin: 'top center', width: 1080, marginBottom: -600 }}>
                  <RecapCard season={season} />
                </div>
              )}
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
                title="Download PNG"
              >
                <Download size={16} weight="bold" />
              </button>
            </div>
            <p className="text-[11px] text-[#A9C5B4]/60 italic text-center">
              On mobile: opens the native share sheet (WhatsApp, Messages…). On desktop: downloads a PNG you can drop in any chat.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </>,
    document.body
  );
}
