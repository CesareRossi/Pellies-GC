import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, ChartLine, User, Users, MapPin, Gauge, Star, Crown, Lightning, Fire, Flag, CaretRight,
} from '@phosphor-icons/react';
import { Card, SectionLabel, Chip, Button } from './common';

/* Stat tile — one headline number with its label and a quiet sub-line. */
const StatCard = ({ icon, value, label, sub, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
  >
    <Card className="h-full px-4 py-5 text-center">
      <div className="mb-2.5 flex justify-center text-[#D4AF37]">{icon}</div>
      <p className="pg-display pg-num text-[30px] leading-none text-white">{value}</p>
      <p className="pg-eyebrow mt-2">{label}</p>
      {sub && <p className="mt-1.5 truncate text-[10.5px] text-[#A9C5B4]/65" title={sub}>{sub}</p>}
    </Card>
  </motion.div>
);

/* Highlight row inside the right-hand panel. */
const HighlightRow = ({ icon, title, value, detail }) => (
  <div className="flex items-center gap-3 border-b border-[#D4AF37]/8 py-2.5 last:border-0 last:pb-0">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/4">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="pg-eyebrow">{title}</p>
      <p className="truncate text-sm font-semibold text-white">{value}</p>
    </div>
    <p className="pg-num shrink-0 text-right text-sm font-bold text-[#D4AF37]">{detail}</p>
  </div>
);

/* Quick-nav tile. */
const QuickNav = ({ icon, title, desc, onClick, testId }) => (
  <Card
    as="button"
    interactive
    onClick={onClick}
    data-testid={testId}
    className="group w-full p-4 text-left"
  >
    <div className="mb-3 flex items-start justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/22 bg-[#D4AF37]/8 text-[#D4AF37] transition-transform duration-300 group-hover:scale-105">
        {icon}
      </span>
      <CaretRight size={14} className="mt-1 text-[#A9C5B4]/35 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#D4AF37]" />
    </div>
    <p className="text-sm font-semibold text-white">{title}</p>
    <p className="mt-0.5 text-xs text-[#A9C5B4]">{desc}</p>
  </Card>
);

const Overview = ({ data, onNav, archivedSeasons = [], onShareRecap }) => {
  if (!data) return null;

  // Podium: 2nd — 1st — 3rd, tallest in the middle
  const podiumOrder = [1, 0, 2];
  const podiumHeights = ['h-24 sm:h-28', 'h-32 sm:h-40', 'h-20 sm:h-24'];
  const podiumFills = [
    'from-[#D8DCE0] to-[#9BA3AA]',
    'from-[#F4E3A8] via-[#D4AF37] to-[#A8871F]',
    'from-[#E0A878] to-[#A0522D]',
  ];
  const podiumLabels = ['2nd', '1st', '3rd'];

  const coursesPlayed = (data.courses_played || []).join(', ');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="season-overview">
      {/* Hero */}
      <div className="mb-9 text-center">
        <p className="pg-eyebrow pg-eyebrow-gold mb-2.5">Pellies Golf Club</p>
        <h2 className="pg-display pg-gold-text text-[34px] leading-none sm:text-[46px]">Season Overview</h2>
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="gold">{data.total_courses} of {data.total_round_slots} rounds set up</Chip>
          <Chip tone="emerald">{data.active_players} active players</Chip>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard index={0} icon={<Users size={21} weight="duotone" />} value={data.active_players} label="Active Players" sub={`of ${data.total_players} total`} />
        <StatCard index={1} icon={<MapPin size={21} weight="duotone" />} value={`${data.total_courses}/${data.total_round_slots}`} label="Rounds Set Up" sub={coursesPlayed} />
        <StatCard index={2} icon={<Gauge size={21} weight="duotone" />} value={data.total_rounds_played} label="Rounds Played" sub={`${data.total_holes_played} holes`} />
        <StatCard index={3} icon={<Star size={21} weight="duotone" />} value={data.best_round.score} label="Best Round" sub={`${data.best_round.player} at ${(data.best_round.course || '').replace('Stableford - ', '')}`} />
      </div>

      {/* Podium + highlights */}
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <SectionLabel icon={<Crown size={15} weight="duotone" />} className="mb-6">League Leaders</SectionLabel>
          {data.top_players.length >= 3 ? (
            <div className="flex items-end justify-center gap-3 pt-2 sm:gap-5">
              {podiumOrder.map((playerIdx, visualIdx) => {
                const p = data.top_players[playerIdx];
                if (!p) return null;
                const isWinner = visualIdx === 1;
                return (
                  <motion.div
                    key={p.name}
                    initial={{ opacity: 0, y: 36 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: visualIdx * 0.14, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex min-w-0 flex-1 flex-col items-center"
                  >
                    {isWinner && <Crown size={19} weight="fill" className="mb-1 text-[#D4AF37]" />}
                    <p className="w-full truncate text-center text-[13px] font-semibold text-white" title={p.name}>{p.name}</p>
                    <p className="pg-num pg-display mb-2.5 mt-0.5 text-[19px] text-[#D4AF37]">{p.total}</p>
                    <div
                      className={`${podiumHeights[visualIdx]} flex w-full max-w-[96px] items-center justify-center rounded-t-xl bg-gradient-to-t ${podiumFills[visualIdx]} shadow-[0_-2px_18px_-6px_rgba(212,175,55,0.5)]`}
                    >
                      <span className="pg-display text-[17px] font-bold text-[#051A10]">{podiumLabels[visualIdx]}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#A9C5B4]/70">
              The podium fills in once at least three players have scored.
            </p>
          )}
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <SectionLabel icon={<Lightning size={15} weight="duotone" />} className="mb-4">Highlights</SectionLabel>
          <div>
            <HighlightRow icon={<Trophy size={17} weight="duotone" className="text-[#D4AF37]" />} title="Leader" value={data.top_players[0]?.name || '—'} detail={`${data.top_players[0]?.total || 0} pts`} />
            {/* TEAM COMMENTED OUT: Top Team highlight row */}
            <HighlightRow icon={<Star size={17} weight="duotone" className="text-amber-400" />} title="Best Round" value={data.best_round.player} detail={`${data.best_round.score} pts`} />
            <HighlightRow icon={<Fire size={17} weight="duotone" className="text-orange-400" />} title="Eagles" value={data.eagle_leader.player || '—'} detail={`${data.eagle_leader.count}`} />
            <HighlightRow icon={<Flag size={17} weight="duotone" className="text-emerald-400" />} title="Birdies" value={data.birdie_leader.player || '—'} detail={`${data.birdie_leader.count}`} />
            {data.hio_leader?.count > 0 && (
              <HighlightRow icon={<Star size={17} weight="fill" className="text-fuchsia-400" />} title="Hole in one" value={data.hio_leader.player} detail={`${data.hio_leader.count}`} />
            )}
          </div>
        </Card>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <QuickNav icon={<Trophy size={20} weight="duotone" />} title="Leaderboards" desc="Season rankings" onClick={() => onNav('league_lb')} testId="quicknav-leaderboards" />
        <QuickNav icon={<ChartLine size={20} weight="duotone" />} title="Individual Rounds" desc="Round scorecards" onClick={() => onNav('stableford')} testId="quicknav-rounds" />
        {/* TEAM COMMENTED OUT: Teams quick-nav tile */}
        <QuickNav icon={<User size={20} weight="duotone" />} title="Player Stats" desc="Per-player breakdowns" onClick={() => onNav('stats')} testId="quicknav-stats" />
      </div>

      {/* Past champions */}
      {archivedSeasons && archivedSeasons.length > 0 && (
        <div className="mt-10" data-testid="past-champions-card">
          <SectionLabel icon={<Trophy size={14} weight="duotone" />} className="mb-4">
            Past Champions
          </SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedSeasons.slice(0, 6).map((s, i) => {
              const champ = s.summary_json?.champion;
              // TEAM COMMENTED OUT: const team = s.summary_json?.champion_team;
              const pick = (key) => {
                const node = s.summary_json?.awards?.season?.[key];
                return Array.isArray(node) ? node[0]?.player : node?.player;
              };
              const spoon = pick('wooden_spoon_leader');
              const joker = pick('joker_king');
              const beerKing = pick('beer_king');
              const endYear = s.ended_at ? new Date(s.ended_at).getFullYear() : '';

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card feature className="flex h-full flex-col p-4" data-testid={`past-champion-${s.id}`}>
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <p className="pg-display truncate text-[15px] text-[#D4AF37]">{s.name}</p>
                      {endYear && <span className="pg-eyebrow shrink-0">{endYear}</span>}
                    </div>
                    <div className="flex-1 space-y-1.5 text-xs">
                      {champ && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#A9C5B4]/80">🏆 Champion</span>
                          <span className="max-w-[60%] truncate font-semibold text-white">{champ.player || champ.Player || '—'}</span>
                        </div>
                      )}
                      {/* TEAM COMMENTED OUT: Top Team row */}
                      {spoon && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#A9C5B4]/80">🥄 Wooden Spoon</span>
                          <span className="max-w-[60%] truncate text-white/80">{spoon}</span>
                        </div>
                      )}
                      {joker && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#A9C5B4]/80">🎭 Joker King</span>
                          <span className="max-w-[60%] truncate text-white/80">{joker}</span>
                        </div>
                      )}
                      {beerKing && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#A9C5B4]/80">🍺 Beer King</span>
                          <span className="max-w-[60%] truncate text-white/80">{beerKing}</span>
                        </div>
                      )}
                    </div>
                    {onShareRecap && (
                      <Button
                        variant="secondary"
                        size="sm"
                        block
                        className="mt-3.5"
                        onClick={() => onShareRecap(s)}
                        data-testid={`past-champion-share-${s.id}`}
                      >
                        Share recap
                      </Button>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Overview;
