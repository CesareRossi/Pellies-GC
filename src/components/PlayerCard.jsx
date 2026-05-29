import React from 'react';
import { motion } from 'framer-motion';
import { TrendUp, Medal, Target, Fire, Flag, Golf, Star, Crown } from '@phosphor-icons/react';

const Bar = ({ l, c, cl, w, ic }) => (
  <div className="flex items-center gap-2">
    <span className="text-[#A9C5B4] w-[72px] text-xs flex items-center gap-1">
      <span className={`${cl} rounded-full p-0.5 text-[#051A10]`}>{ic}</span>
      {l}
    </span>
    <div className="flex-1 h-5 bg-[#051A10]/60 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }} 
        animate={{ width: w }} 
        transition={{ duration: 0.8 }} 
        className={`h-full ${cl} rounded-full`}
      />
    </div>
    <span className="text-white text-xs font-bold w-6 text-right">{c}</span>
  </div>
);

const PlayerCard = ({ player, index }) => {
  const t = (player.hole_in_ones || 0) + (player.albatross || 0) + player.eagles + player.birdies + player.pars + player.bogeys + player.double_bogeys_plus;
  const rc = (r) => r === 1 ? 'from-[#D4AF37] to-[#B8860B]' : r === 2 ? 'from-[#C0C0C0] to-[#808080]' : r === 3 ? 'from-[#CD7F32] to-[#8B4513]' : 'from-[#A9C5B4] to-[#6B8F7B]';
  const bw = (c) => t === 0 ? '0%' : `${Math.max((c / t) * 100, c > 0 ? 4 : 0)}%`;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, delay: index * 0.08 }} 
      data-testid={`player-card-${player.name.toLowerCase().replace(/\s+/g, '-')}`} 
      className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden shadow-2xl hover:border-[#D4AF37]/40 transition-all duration-300"
    >
      <div className="p-5 pb-4 border-b border-[#D4AF37]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${rc(player.rank)} flex items-center justify-center text-[#051A10] font-bold text-sm shadow-lg`}>
              {player.rank || '-'}
            </div>
            <div>
              <h3 className="text-lg font-sans text-white tracking-tight">{player.name}</h3>
              <p className="text-xs text-[#A9C5B4]">{player.rounds_played} round{player.rounds_played !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#D4AF37]">{player.total_points}</p>
            <p className="text-xs text-[#A9C5B4] tracking-wider uppercase">Pts</p>
          </div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-3">
        {[
          { icon: <TrendUp size={18} weight="duotone" />, val: player.avg_per_round, lbl: 'Avg/Round' },
          { icon: <Medal size={18} weight="duotone" />, val: player.best_round, lbl: 'Best Round' },
          { icon: <Target size={18} weight="duotone" />, val: player.avg_per_hole, lbl: 'Avg/Hole' }
        ].map((s, i) => (
          <div key={i} className="text-center p-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
            <div className="mx-auto mb-1 text-[#D4AF37] flex justify-center">{s.icon}</div>
            <p className="text-lg font-bold text-white">{s.val}</p>
            <p className="text-[10px] text-[#A9C5B4] uppercase tracking-wider">{s.lbl}</p>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Scoring</p>
        <div className="space-y-2">
          {(player.hole_in_ones || 0) > 0 && <Bar l="HIO" c={player.hole_in_ones} cl="bg-fuchsia-400" w={bw(player.hole_in_ones)} ic={<Star size={14} weight="fill" />} />}
          {(player.albatross || 0) > 0 && <Bar l="Albatross" c={player.albatross} cl="bg-violet-400" w={bw(player.albatross)} ic={<Crown size={14} weight="fill" />} />}
          <Bar l="Eagles" c={player.eagles} cl="bg-[#D4AF37]" w={bw(player.eagles)} ic={<Fire size={14} weight="fill" />} />
          <Bar l="Birdies" c={player.birdies} cl="bg-emerald-400" w={bw(player.birdies)} ic={<Flag size={14} weight="fill" />} />
          <Bar l="Pars" c={player.pars} cl="bg-sky-400" w={bw(player.pars)} ic={<Golf size={14} weight="fill" />} />
          <Bar l="Bogeys" c={player.bogeys} cl="bg-orange-400" w={bw(player.bogeys)} ic={<Target size={14} weight="fill" />} />
          {player.double_bogeys_plus > 0 && <Bar l="Dbl+" c={player.double_bogeys_plus} cl="bg-red-400" w={bw(player.double_bogeys_plus)} ic={<Target size={14} weight="fill" />} />}
        </div>
      </div>
      {player.round_details?.length > 0 && (
        <div className="px-5 pb-5">
          <p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Rounds</p>
          <div className="space-y-1.5">
            {player.round_details.map((rd, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-[#051A10]/40">
                <span className="text-[#A9C5B4]">{rd.course}</span>
                <span className="text-white font-bold">{rd.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PlayerCard;
