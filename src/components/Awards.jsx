import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Flag, CaretDown } from '@phosphor-icons/react';

const tileDefs = [
  { emoji: '🥄', key: 'wooden_spoon', label: 'Wooden Spoon', detail: (d) => d ? `${d.points} pts` : '—' },
  { emoji: '🧊', key: 'freeze',       label: 'Freeze',       detail: (d) => d && d.drop > 0 ? `−${d.drop} pts F→B` : '—' },
  { emoji: '🔥', key: 'heater',       label: 'Heater',       detail: (d) => d && d.gain > 0 ? `+${d.gain} pts B9` : '—' },
  { emoji: '🐢', key: 'slow_starter', label: 'Slow Start',   detail: (d) => d ? `${d.points} pts H1-3` : '—' },
  { emoji: '🎯', key: 'clutch_king',  label: 'Clutch King',  detail: (d) => d ? `${d.points} pts H16-18` : '—' },
];

function formatNames(names) {
  if (!names || names.length === 0) return '—';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' & ');
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

// Small helper — renders each tied player as its own chip so long lists
// stay readable even with 4+ names on one beer hole.
function NameChips({ names, color = 'rose' }) {
  const colorMap = {
    rose: 'bg-rose-500/15 border-rose-500/30 text-rose-100',
    amber: 'bg-amber-500/15 border-amber-500/30 text-amber-100',
  };
  const cls = colorMap[color] || colorMap.rose;
  if (!names || names.length === 0) return <span className="text-white/60">—</span>;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {names.map((n, i) => (
        <span key={`${n}-${i}`} className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
          {n}
        </span>
      ))}
    </div>
  );
}

function DrinksWatch({ perRound }) {
  const beerRounds = perRound.filter(r => r.has_scores && r.beer_hole_winner);
  if (beerRounds.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto mt-8 rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-transparent p-5 backdrop-blur-md"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🍺</span>
        <div>
          <h3 className="text-sm font-serif text-rose-300">Drinks Watch</h3>
          <p className="text-[11px] text-rose-300/70 uppercase tracking-wider">Beer hole winners — because drinks can't wait</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {beerRounds.map(r => {
          const names = r.beer_hole_winner.names || [];
          return (
            <div key={r.round_number} className="flex items-start justify-between py-2 px-3 rounded-lg bg-[#051A10]/40 border border-rose-500/10">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-[10px] text-[#A9C5B4]/80 uppercase tracking-wider truncate">R{r.round_number} · {r.course}</p>
                {names.length <= 1 ? (
                  <p className="text-white text-sm font-semibold mt-0.5">
                    {formatNames(names)}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-rose-300/80 mt-1" data-testid={`drinks-tied-count-${r.round_number}`}>
                      {names.length} tied — all liable
                    </p>
                    <NameChips names={names} />
                  </>
                )}
              </div>
              <div className="text-right flex-shrink-0 pt-0.5">
                <p className="text-[10px] text-rose-300/70 uppercase">Hole {r.beer_hole}</p>
                <p className="text-rose-300 text-sm font-bold">{r.beer_hole_winner.strokes}</p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function RoundRow({ round, index, openDefault = false }) {
  const [open, setOpen] = useState(openDefault);
  if (!round.has_scores) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="rounded-xl border border-[#D4AF37]/10 bg-[#0F2C1D]/50 px-4 py-3 flex items-center gap-3 opacity-60"
      >
        <Flag size={18} className="text-[#D4AF37]/70" weight="duotone" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">Round {round.round_number} · {round.course}</p>
          <p className="text-[11px] text-[#A9C5B4]/60">No scores logged yet</p>
        </div>
      </motion.div>
    );
  }

  // Summary chips in collapsed state
  const chipList = [
    { emoji: '🥄', name: round.wooden_spoon?.player, color: 'text-amber-300' },
    { emoji: '🎯', name: round.clutch_king?.player, color: 'text-yellow-300' },
  ];
  if (round.beer_hole_winner) chipList.push({ emoji: '🍺', name: formatNames(round.beer_hole_winner.names), color: 'text-rose-300' });
  if (round.joker_hole_winner) chipList.push({ emoji: '🎭', name: round.joker_hole_winner.name, color: 'text-purple-300' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/80 overflow-hidden backdrop-blur-md"
    >
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#D4AF37]/5 transition-colors text-left"
        data-testid={`round-${round.round_number}-toggle`}
      >
        <Flag size={18} className="text-[#D4AF37]" weight="duotone" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-base font-serif text-[#D4AF37]">Round {round.round_number}</p>
            <p className="text-xs text-[#A9C5B4] truncate">{round.course}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {chipList.slice(0, 4).map((c, i) => (
            <span key={i} className={`inline-flex items-center gap-1 text-[11px] ${c.color}`}>
              <span>{c.emoji}</span>
              <span className="text-white/90 font-medium truncate max-w-[80px]">{c.name}</span>
            </span>
          ))}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} className="text-[#A9C5B4] flex-shrink-0">
          <CaretDown size={16} />
        </motion.div>
      </button>

      {/* Detail — grid of all awards for this round */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[#D4AF37]/10">
              {round.excluded && round.excluded.length > 0 && (
                <p className="text-[11px] text-amber-300/90 mt-3 mb-1" data-testid={`round-${round.round_number}-excluded`}>
                  <span className="uppercase tracking-wider text-amber-300/70 mr-1">Did not play:</span>
                  {formatNames(round.excluded)}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 mt-3">
                {tileDefs.map(t => (
                  <div key={t.key} className="rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10 px-2.5 py-2">
                    <p className="text-[10px] text-[#A9C5B4]/70 uppercase tracking-wider mb-0.5 flex items-center gap-1"><span>{t.emoji}</span><span>{t.label}</span></p>
                    <p className="text-white text-sm font-semibold truncate">{round[t.key]?.player || '—'}</p>
                    <p className="text-[10px] text-[#A9C5B4]">{t.detail(round[t.key])}</p>
                  </div>
                ))}
                {round.beer_hole_winner && !round.beer_hole_winner.tied && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-2.5 py-2">
                    <p className="text-[10px] text-rose-300 uppercase tracking-wider mb-0.5 flex items-center gap-1"><span>🍺</span><span>Beer Hole {round.beer_hole}</span></p>
                    <p className="text-white text-sm font-semibold truncate">{formatNames(round.beer_hole_winner.names)}</p>
                    <p className="text-[10px] text-rose-300/80">
                      {round.beer_hole_winner.strokes} strokes · buys drinks
                    </p>
                  </div>
                )}
                {round.joker_hole_winner && (
                  <div className="rounded-lg bg-purple-500/10 border border-purple-500/25 px-2.5 py-2">
                    <p className="text-[10px] text-purple-300 uppercase tracking-wider mb-0.5 flex items-center gap-1"><span>🎭</span><span>Joker H{round.joker_hole}</span></p>
                    <p className="text-white text-sm font-semibold truncate">{round.joker_hole_winner.name}</p>
                    <p className="text-[10px] text-purple-300/80">+{round.joker_hole_winner.bonus} bonus pts</p>
                  </div>
                )}
              </div>

              {/* When the beer hole has multiple tied winners we give them
                  their own full-width strip so every name is legible. */}
              {round.beer_hole_winner && round.beer_hole_winner.tied && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2.5 mt-2" data-testid={`beer-tie-${round.round_number}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-rose-300 uppercase tracking-wider flex items-center gap-1">
                      <span>🍺</span>
                      <span>Beer Hole {round.beer_hole} · {round.beer_hole_winner.strokes} strokes</span>
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-rose-200 font-semibold">
                      {round.beer_hole_winner.names.length} tied — all liable
                    </p>
                  </div>
                  <NameChips names={round.beer_hole_winner.names} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Awards({ awards }) {
  const done = awards?.rounds_complete ?? 0;
  const total = awards?.total_rounds ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Gated: season not complete — show lock + Drinks Watch
  if (!awards?.season_complete) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2"
          data-testid="awards-locked"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 mb-4">
            <Lock size={28} className="text-[#D4AF37]" weight="duotone" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#D4AF37] mb-2">Season Awards Locked</h2>
          <p className="text-[#A9C5B4] text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Full banter unlocks once every player has logged every round.
          </p>
          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/80 p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-2 text-[11px] text-[#A9C5B4] uppercase tracking-wider">
              <span>Progress</span>
              <span className="font-bold text-[#D4AF37]">{done} / {total} rounds</span>
            </div>
            <div className="h-2 rounded-full bg-[#051A10] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F1D67E]"
              />
            </div>
          </div>
        </motion.div>
        {awards?.per_round && <DrinksWatch perRound={awards.per_round} />}
      </div>
    );
  }

  const season = awards.season || {};

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto" data-testid="awards-section">
      {/* Refined header */}
      <div className="text-center mb-8">
        <p className="text-[11px] text-[#D4AF37]/80 uppercase tracking-[0.25em] mb-1">Season Complete</p>
        <h2 className="text-3xl sm:text-4xl font-serif text-[#D4AF37] mb-1">Awards</h2>
        <p className="text-xs text-[#A9C5B4]">{total} rounds · {awards.active_players} players</p>
      </div>

      {/* Season headlines — 2 hero cards instead of 3 cluttered ones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🥄</span>
            <span className="text-[11px] uppercase tracking-[0.15em] text-amber-300 font-semibold">Wooden Spoon Leader</span>
          </div>
          <p className="text-white font-bold text-xl truncate">{season.wooden_spoon_leader?.player || '—'}</p>
          <p className="text-[#A9C5B4] text-xs mt-0.5">
            {season.wooden_spoon_leader?.count > 0 ? `${season.wooden_spoon_leader.count}× worst round this season` : 'Nobody stinkered yet'}
            {season.longest_streak?.streak > 1 && ` · streak ${season.longest_streak.streak}×`}
          </p>
        </div>
        <div className="rounded-xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-transparent p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎭</span>
            <span className="text-[11px] uppercase tracking-[0.15em] text-purple-300 font-semibold">Joker King</span>
          </div>
          <p className="text-white font-bold text-xl truncate">{season.joker_king?.player || '—'}</p>
          <p className="text-[#A9C5B4] text-xs mt-0.5">
            {season.joker_king ? `+${season.joker_king.bonus} bonus pts · ${season.joker_king.course} H${season.joker_king.hole}` : 'No joker hole set yet'}
          </p>
        </div>
      </div>

      {/* Per-round awards — accordion list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em]">Round-by-Round</h3>
          <p className="text-[11px] text-[#A9C5B4]/60 italic hidden sm:block">Tap any round to expand</p>
        </div>
        <div className="space-y-2">
          {awards.per_round.map((r, i) => <RoundRow key={r.round_number} round={r} index={i} openDefault={i === 0} />)}
        </div>
      </div>
    </motion.div>
  );
}
