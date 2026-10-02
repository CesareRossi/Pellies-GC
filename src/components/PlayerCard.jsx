import React from 'react';
import { motion } from 'framer-motion';
import { TrendUp, Medal, Target, Fire, Flag, Golf, Star, Crown } from '@phosphor-icons/react';
import { Card } from './common';

/* A single scoring-distribution bar. */
const DistributionBar = ({ label, count, barClass, width, icon }) => (
  <div className="flex items-center gap-2.5">
    <span className="flex w-[74px] shrink-0 items-center gap-1.5 text-[11px] text-[#A9C5B4]">
      <span className={`${barClass} flex h-4 w-4 items-center justify-center rounded-full text-[#051A10]`}>{icon}</span>
      {label}
    </span>
    <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#03110A]/70">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${barClass}`}
      />
    </div>
    <span className="pg-num w-6 shrink-0 text-right text-[11px] font-bold text-white">{count}</span>
  </div>
);

const PlayerCard = ({ player, index }) => {
  const total =
    (player.hole_in_ones || 0) +
    (player.albatross || 0) +
    player.eagles + player.birdies + player.pars + player.bogeys + player.double_bogeys_plus;

  const rankFill = (r) =>
    r === 1 ? 'from-[#F4E3A8] to-[#B8860B]'
      : r === 2 ? 'from-[#D8DCE0] to-[#8D949B]'
      : r === 3 ? 'from-[#E0A878] to-[#8B4513]'
      : 'from-[#2A5340] to-[#1A3528]';

  const barWidth = (c) => (total === 0 ? '0%' : `${Math.max((c / total) * 100, c > 0 ? 4 : 0)}%`);

  const isPodium = player.rank >= 1 && player.rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`player-card-${player.name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Card interactive feature={isPodium} className="flex h-full flex-col overflow-hidden">
        {/* Head */}
        <div className="flex items-center justify-between gap-3 border-b border-[#D4AF37]/10 p-5 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`pg-num flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold shadow-lg ${rankFill(player.rank)} ${
                isPodium ? 'text-[#051A10]' : 'text-[#D4AF37]'
              }`}
            >
              {player.rank || '–'}
            </span>
            <div className="min-w-0">
              <h3 className="pg-display truncate text-[17px] text-white">{player.name}</h3>
              <p className="text-[11px] text-[#A9C5B4]">
                {player.rounds_played} round{player.rounds_played !== 1 ? 's' : ''} played
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="pg-num pg-display text-[26px] leading-none text-[#D4AF37]">{player.total_points}</p>
            <p className="pg-eyebrow mt-1">Pts</p>
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2.5 p-5">
          {[
            { icon: <TrendUp size={17} weight="duotone" />, val: player.avg_per_round, lbl: 'Avg / round' },
            { icon: <Medal size={17} weight="duotone" />, val: player.best_round, lbl: 'Best round' },
            { icon: <Target size={17} weight="duotone" />, val: player.avg_per_hole, lbl: 'Avg / hole' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-[#D4AF37]/10 bg-[#03110A]/55 px-2 py-3 text-center">
              <div className="mb-1 flex justify-center text-[#D4AF37]">{s.icon}</div>
              <p className="pg-num text-[17px] font-bold leading-none text-white">{s.val}</p>
              <p className="pg-eyebrow mt-1.5 text-[9px]">{s.lbl}</p>
            </div>
          ))}
        </div>

        {/* Distribution */}
        <div className="px-5 pb-5">
          <p className="pg-eyebrow mb-3">Scoring</p>
          <div className="space-y-2">
            {(player.hole_in_ones || 0) > 0 && (
              <DistributionBar label="HIO" count={player.hole_in_ones} barClass="bg-fuchsia-400" width={barWidth(player.hole_in_ones)} icon={<Star size={11} weight="fill" />} />
            )}
            {(player.albatross || 0) > 0 && (
              <DistributionBar label="Albatross" count={player.albatross} barClass="bg-violet-400" width={barWidth(player.albatross)} icon={<Crown size={11} weight="fill" />} />
            )}
            <DistributionBar label="Eagles" count={player.eagles} barClass="bg-[#D4AF37]" width={barWidth(player.eagles)} icon={<Fire size={11} weight="fill" />} />
            <DistributionBar label="Birdies" count={player.birdies} barClass="bg-emerald-400" width={barWidth(player.birdies)} icon={<Flag size={11} weight="fill" />} />
            <DistributionBar label="Pars" count={player.pars} barClass="bg-sky-400" width={barWidth(player.pars)} icon={<Golf size={11} weight="fill" />} />
            <DistributionBar label="Bogeys" count={player.bogeys} barClass="bg-orange-400" width={barWidth(player.bogeys)} icon={<Target size={11} weight="fill" />} />
            {player.double_bogeys_plus > 0 && (
              <DistributionBar label="Dbl +" count={player.double_bogeys_plus} barClass="bg-red-400" width={barWidth(player.double_bogeys_plus)} icon={<Target size={11} weight="fill" />} />
            )}
          </div>
        </div>

        {/* Round history */}
        {player.round_details?.length > 0 && (
          <div className="mt-auto px-5 pb-5">
            <p className="pg-eyebrow mb-2.5">Rounds</p>
            <div className="pg-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
              {player.round_details.map((rd, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#03110A]/45 px-3 py-1.5 text-[12.5px]"
                >
                  <span className="min-w-0 truncate text-[#A9C5B4]">{rd.course}</span>
                  <span className="pg-num shrink-0 font-bold text-white">{rd.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default PlayerCard;
