import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Flag, CaretDown, Trophy } from '@phosphor-icons/react';
import TourFines from './TourFines';
import { Card, Chip, SectionLabel, EmptyState } from './common';

// Icon mapping for per-round awards
const awardIcons = {
  wooden_spoon: <span className="text-amber-300 text-sm">🥄</span>,
  freeze: <span className="text-blue-300 text-sm">❄️</span>,
  heater: <span className="text-orange-300 text-sm">🔥</span>,
  slow_starter: <span className="text-green-300 text-sm">🐢</span>,
  clutch_king: <span className="text-purple-300 text-sm">🎯</span>,
};

const tileDefs = [
  { key: 'wooden_spoon', label: 'Wooden Spoon', detail: (d) => d ? `${d.points} pts` : '—' },
  { key: 'freeze',       label: 'Freeze',       detail: (d) => d ? `${d.drop > 0 ? '−' + d.drop : d.drop < 0 ? '+' + Math.abs(d.drop) : '0'} pts F→B` : '—' },
  { key: 'heater',       label: 'Heater',       detail: (d) => d ? `${d.gain > 0 ? '+' + d.gain : d.gain < 0 ? d.gain : '0'} pts B9` : '—' },
  { key: 'slow_starter', label: 'Slow Start',   detail: (d) => d ? `${d.points} pts H1-3` : '—' },
  { key: 'clutch_king',  label: 'Clutch King',  detail: (d) => d ? `${d.points} pts H16-18` : '—' },
];

function formatNames(names) {
  if (!names || names.length === 0) return '—';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(' & ');
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

function formatNamesFromArray(array, key = 'player') {
  if (!array || array.length === 0) return '—';
  const names = array.map(item => item[key]).filter(Boolean);
  return formatNames(names);
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
          <h3 className="text-sm font-sans text-rose-300">Drinks Watch</h3>
          <p className="text-[11px] text-rose-300/70 uppercase tracking-wider">Beer hole winners — because drinks can't wait</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {beerRounds.map((r, i) => {
          const names = r.beer_hole_winner.names || [];
          return (
            <div key={r.round_id ?? `r${r.round_number}-${i}`} className="flex items-start justify-between py-2 px-3 rounded-lg bg-[#051A10]/40 border border-rose-500/10">
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
            <p className="text-base font-sans text-[#D4AF37]">Round {round.round_number}</p>
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
                    <p className="text-[10px] text-[#A9C5B4]/70 uppercase tracking-wider mb-0.5 flex items-center gap-1">{awardIcons[t.key]}<span>{t.label}</span></p>
                    <p className="text-white text-sm font-semibold truncate">{round[t.key]?.player || '—'}</p>
                    <p className="text-[10px] text-[#A9C5B4]">{t.detail(round[t.key])}</p>
                  </div>
                ))}
                {round.beer_hole_winner && !round.beer_hole_winner.tied && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-2.5 py-2">
                    <p className="text-[10px] text-rose-300 uppercase tracking-wider mb-0.5 flex items-center gap-1"><span className="text-rose-300">🍺</span><span>Beer Hole {round.beer_hole}</span></p>
                    <p className="text-white text-sm font-semibold truncate">{formatNames(round.beer_hole_winner.names)}</p>
                    <p className="text-[10px] text-rose-300/80">
                      {round.beer_hole_winner.strokes} strokes · buys drinks
                    </p>
                  </div>
                )}
                {round.joker_hole_winner && (
                  <div className="rounded-lg bg-purple-500/10 border border-purple-500/25 px-2.5 py-2">
                    <p className="text-[10px] text-purple-300 uppercase tracking-wider mb-0.5 flex items-center gap-1"><span className="text-purple-300">🎭</span><span>Joker H{round.joker_hole}</span></p>
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
                      <span className="text-rose-300">🍺</span>
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
  const awardsData = awards || {};
  const done = awardsData?.rounds_complete ?? 0;
  const total = awardsData?.total_rounds ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // If season not complete, show locked state
  if (!awardsData?.season_complete) {
    const isNewSeason = total === 0;
    
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-2 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/28 bg-[#D4AF37]/10">
            {isNewSeason ? (
              <Flag size={27} className="text-[#D4AF37]" weight="duotone" />
            ) : (
              <Lock size={27} className="text-[#D4AF37]" weight="duotone" />
            )}
          </div>
          <p className="pg-eyebrow pg-eyebrow-gold mb-2">Season awards</p>
          <h2 className="pg-display pg-gold-text mb-2.5 text-[28px] sm:text-[34px]">
            {isNewSeason ? 'New Season Started' : 'Awards Locked'}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-[#A9C5B4]">
            {isNewSeason
              ? 'No rounds have been set up yet. Awards appear once rounds are played and scores are entered.'
              : 'Full banter unlocks once every player has logged every round.'}
          </p>
          {!isNewSeason && (
            <Card className="mx-auto max-w-sm p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="pg-eyebrow">Progress</span>
                <span className="pg-num text-xs font-bold text-[#D4AF37]">{done} / {total} rounds</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#03110A]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F1D67E]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </Card>
          )}
        </div>
        {awardsData?.per_round && <DrinksWatch perRound={awardsData.per_round} />}
        {awardsData?.per_round && <TourFines rounds={awardsData.per_round} />}
      </div>
    );
  }

  const season = awardsData.season || {};
  
  // Check if all awards are empty
  const hasNoWinners = !season.golden_round?.length && 
                     !season.joker_king?.length && 
                     !season.beer_king?.length && 
                     !season.wooden_spoon_leader?.length;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="pg-eyebrow pg-eyebrow-gold mb-2">Season complete</p>
        <h2 className="pg-display pg-gold-text text-[32px] sm:text-[42px]">Awards</h2>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Chip tone="gold">{total} rounds</Chip>
          <Chip>{awardsData.active_players || 0} players</Chip>
        </div>
      </div>

      {/* No awards message */}
      {hasNoWinners && (
        <EmptyState
          icon={<Trophy size={26} weight="duotone" />}
          title="No awards this season"
          message="Golden Round, Joker King, Beer King and Wooden Spoon appear once players start scoring rounds."
        />
      )}

      {/* Season awards grid */}
      {!hasNoWinners && (
        <div className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              emoji: '👑', label: 'Golden Round', tone: 'yellow',
              names: formatNamesFromArray(season.golden_round),
              detail: season.golden_round?.length > 0
                ? `${season.golden_round[0].total} pts · ${season.golden_round[0].course || 'Unknown course'}`
                : 'No rounds played yet',
            },
            {
              emoji: '🎭', label: 'Joker King', tone: 'purple',
              names: formatNamesFromArray(season.joker_king),
              detail: season.joker_king?.length > 0
                ? `+${season.joker_king[0].totalBonus || 0} bonus pts across ${season.joker_king[0].rounds?.length || 0} joker hole${(season.joker_king[0].rounds?.length || 0) !== 1 ? 's' : ''}`
                : 'No joker holes played yet',
            },
            {
              emoji: '🍺', label: 'Beer King', tone: 'rose',
              names: formatNamesFromArray(season.beer_king),
              detail: season.beer_king?.length > 0
                ? `${season.beer_king[0].count || 0}× buying drinks · ${(season.beer_king[0].count || 0) === 1 ? 'a true legend' : 'the most generous'}`
                : 'No beer holes yet',
            },
            {
              emoji: '🥄', label: 'Wooden Spoon', tone: 'amber',
              names: formatNamesFromArray(season.wooden_spoon_leader),
              detail: season.wooden_spoon_leader?.length > 0
                ? `${Math.round((season.wooden_spoon_leader[0].average || 0) * 10) / 10} avg · ${season.wooden_spoon_leader[0].rounds || 0} rounds`
                : 'No rounds completed',
            },
          ].map((a, i) => {
            const ring = {
              yellow: 'border-yellow-500/30 bg-yellow-500/8',
              purple: 'border-purple-500/30 bg-purple-500/8',
              rose: 'border-rose-500/30 bg-rose-500/8',
              amber: 'border-amber-500/30 bg-amber-500/8',
            }[a.tone];
            const label = {
              yellow: 'text-yellow-300',
              purple: 'text-purple-300',
              rose: 'text-rose-300',
              amber: 'text-amber-300',
            }[a.tone];
            return (
              <motion.div
                key={a.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={`pg-card-interactive rounded-2xl border p-5 ${ring}`}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-2xl leading-none">{a.emoji}</span>
                  <span className={`pg-eyebrow ${label}`} style={{ color: 'inherit' }}>{a.label}</span>
                </div>
                <p className="pg-display text-[20px] leading-tight text-white">{a.names}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#A9C5B4]">{a.detail}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tour Fines - also show in unlocked state */}
      <TourFines rounds={awardsData.per_round || []} />

      {/* Per-round awards */}
      {(awardsData.per_round || []).length > 0 && (
        <div>
          <SectionLabel
            icon={<Flag size={13} weight="duotone" />}
            className="mb-3"
            trailing={<span className="hidden text-[11px] italic text-[#A9C5B4]/55 sm:block">Tap any round to expand</span>}
          >
            Round by round
          </SectionLabel>
          <div className="space-y-2">
            {/* Keyed on round_id: round_number is not unique in practice —
                a season can contain two rounds numbered the same. */}
            {(awardsData.per_round || []).map((r, i) => (
              <RoundRow key={r.round_id ?? `r${r.round_number}-${i}`} round={r} index={i} openDefault={i === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
