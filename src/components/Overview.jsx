import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChartLine, UsersThree, User, Users, MapPin, Gauge, Star, Crown, Lightning, Fire, Flag } from '@phosphor-icons/react';

const SC = ({ icon, value, label, sub }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-5 shadow-xl text-center">
    <div className="text-[#D4AF37] flex justify-center mb-2">{icon}</div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-[#A9C5B4] uppercase tracking-wider mt-1">{label}</p>
    {sub && <p className="text-[10px] text-[#A9C5B4]/70 mt-1 truncate">{sub}</p>}
  </motion.div>
);

const HR = ({ icon, title, value, detail }) => (
  <div className="flex items-center gap-3 py-2 border-b border-[#D4AF37]/10 last:border-0">
    <div>{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-[#A9C5B4] uppercase tracking-wider">{title}</p>
      <p className="text-white font-semibold text-sm truncate">{value}</p>
    </div>
    <p className="text-xs text-[#A9C5B4] text-right">{detail}</p>
  </div>
);

const QN = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="rounded-xl border border-[#D4AF37]/15 bg-[#0F2C1D]/60 p-5 shadow-lg text-left hover:bg-[#163A27] hover:border-[#D4AF37]/30 transition-all group">
    <div className="text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform">{icon}</div>
    <p className="text-white text-sm font-semibold">{title}</p>
    <p className="text-[#A9C5B4] text-xs mt-0.5">{desc}</p>
  </button>
);

const Overview = ({ data, onNav, archivedSeasons = [], onShareRecap }) => {
  if (!data) return null;
  const po = [1, 0, 2], ph = ['h-28', 'h-36', 'h-24'], pc = ['from-[#C0C0C0] to-[#A0A0A0]', 'from-[#D4AF37] to-[#B8860B]', 'from-[#CD7F32] to-[#A0522D]'], pl = ['2nd', '1st', '3rd'];
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="season-overview">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-sans text-[#D4AF37] mb-2">Season Overview</h2>
        <p className="text-[#A9C5B4] text-sm">{data.total_courses} of {data.total_round_slots} rounds set up &middot; {data.active_players} active players</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <SC icon={<Users size={22} weight="duotone" />} value={data.active_players} label="Active Players" sub={`of ${data.total_players} total`} />
        <SC icon={<MapPin size={22} weight="duotone" />} value={`${data.total_courses}/${data.total_round_slots}`} label="Rounds Set Up" sub={data.courses_played.join(', ')} />
        <SC icon={<Gauge size={22} weight="duotone" />} value={data.total_rounds_played} label="Rounds Played" sub={`${data.total_holes_played} holes`} />
        <SC icon={<Star size={22} weight="duotone" />} value={data.best_round.score} label="Best Round" sub={`${data.best_round.player} at ${(data.best_round.course || '').replace('Stableford - ', '')}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-6 shadow-2xl">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Crown size={16} className="text-[#D4AF37]" /> League Leaders
          </h3>
          <div className="flex items-end justify-center gap-4 pt-4">
            {data.top_players.length >= 3 && po.map((pi, vi) => {
              const p = data.top_players[pi];
              if (!p) return null;
              return (
                <motion.div key={p.name} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: vi * 0.15 }} className="flex flex-col items-center">
                  <p className="text-white text-sm font-semibold mb-1">{p.name}</p>
                  <p className="text-[#D4AF37] text-lg font-bold mb-2">{p.total} pts</p>
                  <div className={`${ph[vi]} w-20 sm:w-24 rounded-t-lg bg-gradient-to-t ${pc[vi]} flex items-center justify-center shadow-lg`}>
                    <span className="text-[#051A10] font-bold text-lg">{pl[vi]}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-6 shadow-2xl">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Lightning size={16} className="text-[#D4AF37]" /> Highlights
          </h3>
          <div className="space-y-4">
            <HR icon={<Trophy size={20} className="text-[#D4AF37]" />} title="Leader" value={data.top_players[0]?.name || '-'} detail={`${data.top_players[0]?.total || 0} pts`} />
            <HR icon={<UsersThree size={20} className="text-emerald-400" />} title="Top Team" value={data.top_team?.name || '-'} detail={`${data.top_team?.total || 0} pts`} />
            <HR icon={<Star size={20} className="text-amber-400" />} title="Best Round" value={data.best_round.player} detail={`${data.best_round.score} pts`} />
            <HR icon={<Fire size={20} className="text-orange-400" />} title="Eagles" value={data.eagle_leader.player || '-'} detail={`${data.eagle_leader.count}`} />
            <HR icon={<Flag size={20} className="text-green-400" />} title="Birdies" value={data.birdie_leader.player || '-'} detail={`${data.birdie_leader.count}`} />
            {data.hio_leader?.count > 0 && <HR icon={<Star size={20} className="text-fuchsia-400" />} title="HIO" value={data.hio_leader.player} detail={`${data.hio_leader.count}`} />}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QN icon={<Trophy size={24} />} title="Leaderboards" desc="Rankings" onClick={() => onNav('league_lb')} />
        <QN icon={<ChartLine size={24} />} title="Individual Rounds" desc="Round scores" onClick={() => onNav('stableford')} />
        <QN icon={<UsersThree size={24} />} title="Teams" desc="Team scoring" onClick={() => onNav('teams')} />
        <QN icon={<User size={24} />} title="Player Stats" desc="Breakdowns" onClick={() => onNav('stats')} />
      </div>

      {archivedSeasons && archivedSeasons.length > 0 && (
        <div className="mt-10" data-testid="past-champions-card">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-[#D4AF37]" weight="duotone" /> Past Champions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {archivedSeasons.slice(0, 6).map((s) => {
              const champ = s.summary_json?.champion;
              const team = s.summary_json?.champion_team;
              const spoon = Array.isArray(s.summary_json?.awards?.season?.wooden_spoon_leader)
                ? s.summary_json.awards.season.wooden_spoon_leader[0]?.player
                : s.summary_json?.awards?.season?.wooden_spoon_leader?.player;
              const joker = Array.isArray(s.summary_json?.awards?.season?.joker_king)
                ? s.summary_json.awards.season.joker_king[0]?.player
                : s.summary_json?.awards?.season?.joker_king?.player;
              const beerKing = Array.isArray(s.summary_json?.awards?.season?.beer_king)
                ? s.summary_json.awards.season.beer_king[0]?.player
                : s.summary_json?.awards?.season?.beer_king?.player;
              const endYear = s.ended_at ? new Date(s.ended_at).getFullYear() : '';
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/8 to-transparent p-4 shadow-xl"
                  data-testid={`past-champion-${s.id}`}
                >
                  <div className="flex items-baseline justify-between mb-3 gap-2">
                    <p className="text-sm font-sans text-[#D4AF37] truncate">{s.name}</p>
                    {endYear && <span className="text-[10px] text-[#A9C5B4]/70 uppercase tracking-wider flex-shrink-0">{endYear}</span>}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {champ && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">🏆 Champion</span>
                        <span className="text-white font-semibold truncate max-w-[60%]">{champ.player || champ.Player || '—'}</span>
                      </div>
                    )}
                    {team && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">👥 Top Team</span>
                        <span className="text-white font-semibold truncate max-w-[60%]">{team.player || team.Team || team.team || '—'}</span>
                      </div>
                    )}
                    {spoon && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">🥄 Wooden Spoon </span>
                        <span className="text-white/80 truncate max-w-[60%]">{spoon}</span>
                      </div>
                    )}
                    {joker && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">🎭 Joker King</span>
                        <span className="text-white/80 truncate max-w-[60%]">{joker}</span>
                      </div>
                    )}
                    {beerKing && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">🍺 Beer King</span>
                        <span className="text-white/80 truncate max-w-[60%]">{beerKing}</span>
                      </div>
                    )}
                  </div>
                  {onShareRecap && (
                    <button
                      onClick={() => onShareRecap(s)}
                      className="mt-3 w-full py-2 rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/10 transition-colors"
                      data-testid={`past-champion-share-${s.id}`}
                    >
                      📸 Share recap
                    </button>
                  )}
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
