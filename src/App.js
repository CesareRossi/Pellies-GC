import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChartLine, ArrowsClockwise, User, Target, Flag, Fire, TrendUp, Medal, Golf, CaretDown, UsersThree, Crown, Lightning, MapPin, Users, Gauge, Star } from '@phosphor-icons/react';
import * as excelService from './services/excelService';

const REFRESH_INTERVAL = 5 * 60 * 1000;
const PLAYER_STATS_TAB = '__player_stats__';
const SEASON_OVERVIEW_TAB = '__season_overview__';

const formatLastUpdated = (ts) => {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getRankBadge = (row) => {
  for (const key in row) {
    if (key.toLowerCase().includes('rank')) {
      const rank = parseInt(row[key]);
      if (rank >= 1 && rank <= 3) return rank;
    }
  }
  return null;
};

// --- Dropdown Nav ---
const NavDropdown = ({ label, icon, items, activeSheet, onSelect, testId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isActive = items.some((i) => i.name === activeSheet);
  const activeItem = items.find((i) => i.name === activeSheet);
  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button onClick={() => setOpen(!open)} data-testid={`${testId}-trigger`} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap ${isActive ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}>
        {icon}
        <span>{activeItem ? activeItem.display_name : label}</span>
        <CaretDown size={14} weight="bold" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 mt-2 min-w-[220px] rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
            {items.map((item) => (
              <button key={item.name} onClick={() => { onSelect(item.name); setOpen(false); }} data-testid={`nav-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`} className={`w-full text-left px-4 py-3 text-sm font-sans transition-colors duration-150 flex items-center gap-2 ${activeSheet === item.name ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'text-[#A9C5B4] hover:bg-[#163A27] hover:text-white'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {item.display_name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Player Card ---
const PlayerCard = ({ player, index }) => {
  const totalHoles = player.eagles_plus + player.birdies + player.pars + player.bogeys + player.double_bogeys_plus;
  const getRankColor = (rank) => { if (rank === 1) return 'from-[#D4AF37] to-[#B8860B]'; if (rank === 2) return 'from-[#C0C0C0] to-[#808080]'; if (rank === 3) return 'from-[#CD7F32] to-[#8B4513]'; return 'from-[#A9C5B4] to-[#6B8F7B]'; };
  const getBarWidth = (count) => totalHoles === 0 ? '0%' : `${Math.max((count / totalHoles) * 100, count > 0 ? 4 : 0)}%`;
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.08 }} data-testid={`player-card-${player.name.toLowerCase().replace(/\s+/g, '-')}`} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden shadow-2xl hover:border-[#D4AF37]/40 transition-all duration-300">
      <div className="p-5 pb-4 border-b border-[#D4AF37]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(player.rank)} flex items-center justify-center text-[#051A10] font-bold text-sm shadow-lg`}>{player.rank || '-'}</div>
            <div>
              <h3 className="text-lg font-serif text-white tracking-tight">{player.name}</h3>
              <p className="text-xs text-[#A9C5B4]">{player.rounds_played} round{player.rounds_played !== 1 ? 's' : ''} played</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#D4AF37]">{player.total_points}</p>
            <p className="text-xs text-[#A9C5B4] tracking-wider uppercase">Total Pts</p>
          </div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-3">
        {[{ icon: <TrendUp size={18} weight="duotone" />, val: player.avg_per_round, lbl: 'Avg/Round' }, { icon: <Medal size={18} weight="duotone" />, val: player.best_round, lbl: 'Best Round' }, { icon: <Target size={18} weight="duotone" />, val: player.avg_per_hole, lbl: 'Avg/Hole' }].map((s, i) => (
          <div key={i} className="text-center p-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10">
            <div className="mx-auto mb-1 text-[#D4AF37] flex justify-center">{s.icon}</div>
            <p className="text-lg font-bold text-white">{s.val}</p>
            <p className="text-[10px] text-[#A9C5B4] uppercase tracking-wider">{s.lbl}</p>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Scoring Breakdown</p>
        <div className="space-y-2">
          <ScoringBar label="Eagles+" count={player.eagles_plus} color="bg-[#D4AF37]" width={getBarWidth(player.eagles_plus)} icon={<Fire size={14} weight="fill" />} />
          <ScoringBar label="Birdies" count={player.birdies} color="bg-emerald-400" width={getBarWidth(player.birdies)} icon={<Flag size={14} weight="fill" />} />
          <ScoringBar label="Pars" count={player.pars} color="bg-sky-400" width={getBarWidth(player.pars)} icon={<Golf size={14} weight="fill" />} />
          <ScoringBar label="Bogeys" count={player.bogeys} color="bg-orange-400" width={getBarWidth(player.bogeys)} icon={<Target size={14} weight="fill" />} />
          {player.double_bogeys_plus > 0 && <ScoringBar label="Dbl Bogey+" count={player.double_bogeys_plus} color="bg-red-400" width={getBarWidth(player.double_bogeys_plus)} icon={<Target size={14} weight="fill" />} />}
        </div>
      </div>
      {player.round_details?.length > 0 && (
        <div className="px-5 pb-5">
          <p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Round History</p>
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

const ScoringBar = ({ label, count, color, width, icon }) => (
  <div className="flex items-center gap-2">
    <span className="text-[#A9C5B4] w-[72px] text-xs flex items-center gap-1">
      <span className={`${color} rounded-full p-0.5 text-[#051A10]`}>{icon}</span>{label}
    </span>
    <div className="flex-1 h-5 bg-[#051A10]/60 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width }} transition={{ duration: 0.8, ease: 'easeOut' }} className={`h-full ${color} rounded-full`} />
    </div>
    <span className="text-white text-xs font-bold w-6 text-right">{count}</span>
  </div>
);

// --- Season Overview ---
const SeasonOverview = ({ data, onNavigate }) => {
  if (!data) return null;
  const podiumOrder = [1, 0, 2];
  const podiumHeights = ['h-28', 'h-36', 'h-24'];
  const podiumColors = ['from-[#C0C0C0] to-[#A0A0A0]', 'from-[#D4AF37] to-[#B8860B]', 'from-[#CD7F32] to-[#A0522D]'];
  const podiumLabels = ['2nd', '1st', '3rd'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} data-testid="season-overview">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-serif text-[#D4AF37] tracking-tight mb-2">Season Overview</h2>
        <p className="text-[#A9C5B4] text-sm">{data.courses_played.length} of {data.total_courses} courses played &middot; {data.active_players} active players</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard icon={<Users size={22} weight="duotone" />} value={data.active_players} label="Active Players" sub={`of ${data.total_players} total`} />
        <StatCard icon={<MapPin size={22} weight="duotone" />} value={data.courses_played.length} label="Courses Played" sub={data.courses_played.join(', ')} />
        <StatCard icon={<Gauge size={22} weight="duotone" />} value={data.total_rounds_played} label="Rounds Played" sub={`${data.total_holes_played} holes total`} />
        <StatCard icon={<Star size={22} weight="duotone" />} value={data.best_round.score} label="Best Round" sub={`${data.best_round.player} at ${data.best_round.course.replace('Stableford - ', '')}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-6 shadow-2xl" data-testid="podium-section">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Crown size={16} weight="duotone" className="text-[#D4AF37]" /> League Leaders</h3>
          <div className="flex items-end justify-center gap-4 pt-4">
            {data.top_players.length >= 3 && podiumOrder.map((pi, vi) => {
              const p = data.top_players[pi];
              if (!p) return null;
              return (
                <motion.div key={p.name} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: vi * 0.15 }} className="flex flex-col items-center">
                  <p className="text-white font-sans text-sm font-semibold mb-1">{p.name}</p>
                  <p className="text-[#D4AF37] text-lg font-bold mb-2">{p.total} pts</p>
                  <div className={`${podiumHeights[vi]} w-20 sm:w-24 rounded-t-lg bg-gradient-to-t ${podiumColors[vi]} flex items-center justify-center shadow-lg`}>
                    <span className="text-[#051A10] font-bold text-lg">{podiumLabels[vi]}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-6 shadow-2xl" data-testid="highlights-section">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Lightning size={16} weight="duotone" className="text-[#D4AF37]" /> Season Highlights</h3>
          <div className="space-y-4">
            <HighlightRow icon={<Trophy size={20} weight="duotone" className="text-[#D4AF37]" />} title="League Leader" value={data.top_players[0]?.name || '-'} detail={`${data.top_players[0]?.total || 0} total points`} />
            <HighlightRow icon={<UsersThree size={20} weight="duotone" className="text-emerald-400" />} title="Top Team" value={data.top_team?.name || '-'} detail={`${data.top_team?.total || 0} total points`} />
            <HighlightRow icon={<Star size={20} weight="duotone" className="text-amber-400" />} title="Best Single Round" value={data.best_round.player} detail={`${data.best_round.score} pts at ${data.best_round.course.replace('Stableford - ', '')}`} />
            <HighlightRow icon={<Fire size={20} weight="duotone" className="text-orange-400" />} title="Eagle Leader" value={data.eagle_leader.player || '-'} detail={`${data.eagle_leader.count} eagles`} />
            <HighlightRow icon={<Flag size={20} weight="duotone" className="text-green-400" />} title="Birdie Leader" value={data.birdie_leader.player || '-'} detail={`${data.birdie_leader.count} birdies`} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickNavCard icon={<Trophy size={24} weight="duotone" />} title="Leaderboards" desc="Player & team rankings" onClick={() => onNavigate('League Leaderboard')} />
        <QuickNavCard icon={<ChartLine size={24} weight="duotone" />} title="Stableford" desc="Round-by-round scores" onClick={() => onNavigate('Stableford_1')} />
        <QuickNavCard icon={<UsersThree size={24} weight="duotone" />} title="Team Rounds" desc="Team pair scoring" onClick={() => onNavigate('Teams_1')} />
        <QuickNavCard icon={<User size={24} weight="duotone" />} title="Player Stats" desc="Detailed breakdowns" onClick={() => onNavigate(PLAYER_STATS_TAB)} />
      </div>
    </motion.div>
  );
};
const StatCard = ({ icon, value, label, sub }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md p-5 shadow-xl text-center">
    <div className="text-[#D4AF37] flex justify-center mb-2">{icon}</div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-[#A9C5B4] uppercase tracking-wider mt-1">{label}</p>
    {sub && <p className="text-[10px] text-[#A9C5B4]/70 mt-1 truncate">{sub}</p>}
  </motion.div>
);
const HighlightRow = ({ icon, title, value, detail }) => (
  <div className="flex items-center gap-3 py-2 border-b border-[#D4AF37]/10 last:border-0">
    <div className="flex-shrink-0">{icon}</div>
    <div className="flex-1 min-w-0"><p className="text-xs text-[#A9C5B4] uppercase tracking-wider">{title}</p><p className="text-white font-semibold text-sm truncate">{value}</p></div>
    <p className="text-xs text-[#A9C5B4] text-right flex-shrink-0">{detail}</p>
  </div>
);
const QuickNavCard = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} data-testid={`quick-nav-${title.toLowerCase().replace(/\s+/g, '-')}`} className="rounded-xl border border-[#D4AF37]/15 bg-[#0F2C1D]/60 backdrop-blur-md p-5 shadow-lg text-left hover:bg-[#163A27] hover:border-[#D4AF37]/30 transition-all duration-200 group">
    <div className="text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform duration-200">{icon}</div>
    <p className="text-white text-sm font-semibold">{title}</p>
    <p className="text-[#A9C5B4] text-xs mt-0.5">{desc}</p>
  </button>
);

// --- Main App ---
function App() {
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(SEASON_OVERVIEW_TAB);
  const [sheetData, setSheetData] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [seasonOverview, setSeasonOverview] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSheets = useCallback(async () => {
    try {
      const data = await excelService.getSheets();
      setSheets(data.sheets);
      setLastUpdated(data.last_updated);
      setError(null);
    } catch (err) {
      console.error('Error fetching sheets:', err);
      setError('Failed to load data. Retrying...');
    }
  }, []);

  const fetchSheetData = useCallback(async (sheetName) => {
    try {
      setLoading(true);
      setError(null);
      if (sheetName === SEASON_OVERVIEW_TAB) {
        const data = await excelService.getSeasonOverview();
        setSeasonOverview(data);
        setLastUpdated(data.last_updated);
        setSheetData(null); setPlayerStats(null);
      } else if (sheetName === PLAYER_STATS_TAB) {
        const data = await excelService.getPlayerStats();
        setPlayerStats(data.players);
        setLastUpdated(data.last_updated);
        setSheetData(null); setSeasonOverview(null);
      } else {
        const data = await excelService.getSheetData(sheetName);
        setSheetData(data.sheet);
        setLastUpdated(data.last_updated);
        setPlayerStats(null); setSeasonOverview(null);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Failed to load ${sheetName}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await excelService.refreshData();
      await fetchSheets();
      if (activeSheet) await fetchSheetData(activeSheet);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [activeSheet, fetchSheets, fetchSheetData]);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);
  useEffect(() => { if (activeSheet) fetchSheetData(activeSheet); }, [activeSheet, fetchSheetData]);
  useEffect(() => { const i = setInterval(() => handleRefresh(), REFRESH_INTERVAL); return () => clearInterval(i); }, [handleRefresh]);

  const leaderboards = sheets.filter((s) => s.name.toLowerCase().includes('leaderboard'));
  const stablefords = sheets.filter((s) => s.name.toLowerCase().startsWith('stableford_'));
  const teams = sheets.filter((s) => s.name.toLowerCase().startsWith('teams_'));

  const renderTable = () => {
    if (!sheetData?.data?.length) return <div className="py-12 text-center text-[#A9C5B4]">No data available</div>;
    const headers = Object.keys(sheetData.data[0]);
    return (
      <div className="rounded-lg border border-[#D4AF37]/20 bg-[#0F2C1D]/80 backdrop-blur-md overflow-hidden shadow-2xl" data-testid="table-container">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-[#0A2A1A] border-b border-[#D4AF37]/30">
              {headers.map((h, i) => <th key={i} data-testid={`table-header-${h.toLowerCase().replace(/\s+/g, '-')}`} className="py-4 px-6 text-left text-xs font-sans tracking-[0.2em] uppercase text-[#A9C5B4]">{h}</th>)}
            </tr></thead>
            <tbody>
              {sheetData.data.map((row, ri) => {
                const rb = getRankBadge(row);
                return (
                  <tr key={ri} data-testid={`table-row-${ri}`} className={`${ri % 2 === 0 ? 'bg-transparent' : 'bg-[#FFFFFF]/5'} hover:bg-[#163A27] transition-colors duration-200 ${rb ? 'border-l-2 border-[#D4AF37]' : ''}`}>
                    {Object.entries(row).map(([k, v], ci) => (
                      <td key={ci} data-testid={`table-cell-${ri}-${ci}`} className="py-4 px-6 align-middle text-sm sm:text-base font-sans text-white">
                        <div className="flex items-center gap-2">
                          {ci === 0 && rb && <span className="inline-flex items-center justify-center rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1 text-xs font-bold shadow-[0_0_10px_rgba(212,175,55,0.2)]" data-testid={`rank-badge-${rb}`}>#{rb}</span>}
                          <span>{String(v)}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const isPlayerStats = activeSheet === PLAYER_STATS_TAB;
  const isOverview = activeSheet === SEASON_OVERVIEW_TAB;

  return (
    <div className="min-h-screen bg-[#051A10] relative overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1761400025076-8fec91f620f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxnb2xmJTIwY291cnNlJTIwZmFpcndheXN8ZW58MHx8fHwxNzc2MzQ1Mzg5fDA&ixlib=rb-4.1.0&q=85)' }} />
      <div className="fixed inset-0 bg-[#051A10]/95" />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#051A10]/80 border-b border-[#D4AF37]/20" data-testid="main-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src="https://customer-assets.emergentagent.com/job_40790795-ad45-4986-96fc-d389b274e70b/artifacts/3k0g1frp_IMG_0702.JPG" alt="Pellies GC" className="h-14 object-contain" data-testid="logo-image" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif text-[#D4AF37] tracking-tight" data-testid="main-title">Pellies Golf League 2026</h1>
                  <p className="text-xs text-[#A9C5B4] mt-0.5">Last updated: {formatLastUpdated(lastUpdated)}</p>
                </div>
              </div>
              <button onClick={handleRefresh} disabled={refreshing} data-testid="refresh-button" className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 rounded-lg transition-colors duration-200 disabled:opacity-50">
                <ArrowsClockwise size={18} weight="bold" className={refreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline text-sm">Refresh</span>
              </button>
            </div>
            <nav className="mt-4 flex items-center gap-2 flex-wrap" data-testid="nav-container">
              <button onClick={() => setActiveSheet(SEASON_OVERVIEW_TAB)} data-testid="nav-overview" className={`flex items-center gap-2 px-5 py-3 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap ${isOverview ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}>
                <Gauge size={18} weight="duotone" /><span>Overview</span>
              </button>
              {leaderboards.length > 0 && <NavDropdown label="Leaderboards" icon={<Trophy size={18} weight="duotone" />} items={leaderboards} activeSheet={activeSheet} onSelect={setActiveSheet} testId="nav-leaderboards" />}
              {stablefords.length > 0 && <NavDropdown label="Stableford Rounds" icon={<ChartLine size={18} weight="duotone" />} items={stablefords} activeSheet={activeSheet} onSelect={setActiveSheet} testId="nav-stableford" />}
              {teams.length > 0 && <NavDropdown label="Team Rounds" icon={<UsersThree size={18} weight="duotone" />} items={teams} activeSheet={activeSheet} onSelect={setActiveSheet} testId="nav-teams" />}
              <button onClick={() => setActiveSheet(PLAYER_STATS_TAB)} data-testid="nav-player-stats" className={`flex items-center gap-2 px-5 py-3 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap ${isPlayerStats ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}>
                <User size={18} weight="duotone" /><span>Player Stats</span>
              </button>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {error && <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm" data-testid="error-banner">{error}</div>}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-20">
                <div className="text-[#D4AF37] text-lg">Loading...</div>
              </motion.div>
            ) : isOverview && seasonOverview ? (
              <SeasonOverview data={seasonOverview} onNavigate={setActiveSheet} />
            ) : isPlayerStats && playerStats ? (
              <motion.div key="player-stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} data-testid="player-stats-container">
                {playerStats.length === 0 ? <div className="text-center py-20 text-[#A9C5B4]">No player stats available yet.</div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {playerStats.map((p, i) => <PlayerCard key={p.name} player={p} index={i} />)}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key={activeSheet} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                {renderTable()}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
