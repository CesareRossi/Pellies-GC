import React from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from '@phosphor-icons/react';

/* ==========================================================================
   Shared hole grid + score stepper.
   Score Entry (full page) and the Quick Score drawer carried two near-identical
   copies of this; keeping one means the scoring feel is identical everywhere.
   Scoring logic itself is untouched — this is input + presentation only.
   ========================================================================== */

/** Colour language used for a score relative to par. */
export function scoreTone(value, par) {
  const hasValue = value != null && value !== '';
  if (!hasValue) return 'empty';
  const diff = Number(value) - Number(par);
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
}

const TONE_CLASS = {
  empty: 'border-[#D4AF37]/18 bg-[#03110A]/70 text-[#A9C5B4]',
  eagle: 'border-[#D4AF37]/60 bg-[#D4AF37]/22 text-[#F1D67E]',
  birdie: 'border-emerald-400/50 bg-emerald-500/18 text-emerald-200',
  par: 'border-white/25 bg-white/8 text-white',
  bogey: 'border-orange-400/45 bg-orange-500/14 text-orange-200',
  double: 'border-red-500/45 bg-red-500/14 text-red-200',
};

export const SCORE_LEGEND = [
  { tone: 'eagle', label: 'Eagle +' },
  { tone: 'birdie', label: 'Birdie' },
  { tone: 'par', label: 'Par' },
  { tone: 'bogey', label: 'Bogey' },
  { tone: 'double', label: 'Double +' },
];

export const ScoreLegend = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
    {SCORE_LEGEND.map((l) => (
      <span key={l.tone} className="flex items-center gap-1.5 text-[10.5px] text-[#A9C5B4]">
        <span className={`inline-block h-3 w-3 rounded border ${TONE_CLASS[l.tone]}`} />
        {l.label}
      </span>
    ))}
  </div>
);

/**
 * Grid of hole buttons, split Front 9 / Back 9.
 * `beerHole` / `jokerHole` get a ring so the special holes are obvious while
 * you are entering scores, not just on the scorecard.
 */
export const HoleGrid = ({ holes, scores, selectedHole, onSelectHole, beerHole, jokerHole }) => (
  <div className="space-y-4">
    {[{ label: 'Front 9', slice: [0, 9] }, { label: 'Back 9', slice: [9, 18] }].map(({ label, slice }) => {
      const section = holes.slice(...slice);
      if (section.length === 0) return null;
      const sectionTotal = section.reduce((sum, h) => {
        const v = scores[h.hole_number];
        return typeof v === 'number' ? sum + v : sum;
      }, 0);
      const sectionPlayed = section.filter((h) => typeof scores[h.hole_number] === 'number').length;

      return (
        <div key={label}>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="pg-eyebrow">{label}</p>
            <p className="pg-num text-[11px] text-[#A9C5B4]">
              {sectionPlayed > 0 ? <>{sectionTotal} <span className="text-[#A9C5B4]/55">· {sectionPlayed}/{section.length}</span></> : '—'}
            </p>
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {section.map((h) => {
              const v = scores[h.hole_number];
              const hasValue = v != null && v !== '';
              const isSelected = selectedHole === h.hole_number;
              const tone = TONE_CLASS[scoreTone(v, h.par)];
              const isBeer = beerHole && h.hole_number === beerHole;
              const isJoker = jokerHole && h.hole_number === jokerHole;

              return (
                <button
                  key={h.hole_number}
                  type="button"
                  onClick={() => onSelectHole(h.hole_number)}
                  aria-pressed={isSelected}
                  aria-label={`Hole ${h.hole_number}, par ${h.par}${hasValue ? `, score ${v}` : ', no score'}`}
                  title={`Hole ${h.hole_number} · Par ${h.par} · SI ${h.stroke_index}`}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border transition-all duration-150 ${tone} ${
                    isSelected
                      ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-[#0F2C1D] scale-[1.04]'
                      : 'hover:border-[#D4AF37]/45 active:scale-95'
                  }`}
                >
                  <span className="pg-num text-[9px] leading-none opacity-60">{h.hole_number}</span>
                  <span className="pg-num text-[15px] font-bold leading-tight">{hasValue ? v : '–'}</span>
                  {(isBeer || isJoker) && (
                    <span className="absolute -right-0.5 -top-0.5 text-[9px] leading-none">
                      {isBeer ? '🍺' : '🎭'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

/**
 * Stepper for the selected hole: − / value / +, plus one-tap presets.
 * Presets are centred on the hole's par so the common scores are nearest.
 */
export const HoleStepper = ({ hole, value, onChange, onAdjust, beerHole, jokerHole }) => {
  if (!hole) return null;

  const hasValue = value != null && value !== '';
  const tone = TONE_CLASS[scoreTone(value, hole.par)];
  const par = Number(hole.par) || 4;
  const presets = Array.from({ length: 7 }, (_, i) => Math.max(1, par - 2 + i));
  const isBeer = beerHole && hole.hole_number === beerHole;
  const isJoker = jokerHole && hole.hole_number === jokerHole;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="pg-card-flat p-4"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="pg-display text-[15px] text-white">Hole {hole.hole_number}</span>
          {isBeer && <span className="pg-chip pg-chip-rose">🍺 Beer hole</span>}
          {isJoker && <span className="pg-chip pg-chip-purple">🎭 Joker hole</span>}
        </div>
        <span className="pg-num text-[11px] text-[#A9C5B4]">
          Par {hole.par} · SI {hole.stroke_index}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={hasValue && Number(value) <= 1}
          aria-label="Decrease score"
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/28 bg-[#03110A]/80 text-[#D4AF37] transition-all active:scale-92 hover:border-[#D4AF37]/55 hover:bg-[#D4AF37]/12 disabled:opacity-35"
        >
          <Minus size={22} weight="bold" />
        </button>

        <button
          type="button"
          onClick={() => onChange(hasValue ? value : par)}
          aria-label={hasValue ? `Score ${value}` : `Set score to par (${par})`}
          className={`pg-num flex h-16 w-24 items-center justify-center rounded-2xl border-2 text-[30px] font-bold transition-colors ${tone}`}
        >
          {hasValue ? value : '–'}
        </button>

        <button
          type="button"
          onClick={() => onAdjust(1)}
          aria-label="Increase score"
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/28 bg-[#03110A]/80 text-[#D4AF37] transition-all active:scale-92 hover:border-[#D4AF37]/55 hover:bg-[#D4AF37]/12"
        >
          <Plus size={22} weight="bold" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {presets.map((n) => {
          const active = Number(value) === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`pg-num h-9 w-9 rounded-xl border text-[13px] font-bold transition-colors ${
                active
                  ? 'border-[#D4AF37] bg-gradient-to-b from-[#F1D67E] to-[#D4AF37] text-[#051A10]'
                  : 'border-[#D4AF37]/18 bg-[#03110A]/70 text-white hover:border-[#D4AF37]/50'
              }`}
            >
              {n}
            </button>
          );
        })}
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="h-9 rounded-xl border border-transparent px-3 text-[12px] font-semibold text-[#A9C5B4] transition-colors hover:border-[#D4AF37]/18 hover:bg-white/6 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </motion.div>
  );
};
