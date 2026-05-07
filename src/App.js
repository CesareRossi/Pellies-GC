import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';

// Simple ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    console.error('ErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary error info:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20">
          <p className="text-red-400">Something went wrong loading the scorecard.</p>
          <p className="text-[#A9C5B4] text-sm mt-2">Please try refreshing the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
import { createClient } from '@supabase/supabase-js';
import { Trophy, ChartLine, ArrowsClockwise, User, Target, Flag, Fire, TrendUp, Medal, Golf, CaretDown, UsersThree, Crown, Lightning, MapPin, Users, Gauge, Star, Lock, PencilSimple, Check, X, SignOut, CloudArrowUp, DownloadSimple, Gear, UserPlus, ShieldCheck } from '@phosphor-icons/react';
import * as db from './services/supabaseService';
import AdminPanel from './components/AdminPanel';
import SeasonWizard from './components/SeasonWizard';
import Awards from './components/Awards';
import SeasonRecapModal from './components/SeasonRecap';
import GolfScorecard from './components/GolfScorecard';
import TeamScorecard from './components/TeamScorecard';
import LiveLeaderboard from './components/LiveLeaderboard';
import QuickScoreDrawer from './components/QuickScoreDrawer';

const REFRESH_INTERVAL = 5 * 60 * 1000;

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://djalydmfpdfpdarocmto.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || 'sb_publishable_cpgvQJ8un2BAjnWqPyH2jw_2U1U3Kh3';

const supabase = createClient(supabaseUrl, supabaseKey);

const formatLastUpdated = (ts) => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never';

// ===== NAV DROPDOWN =====
const NavDropdown = ({ label, icon, items, activeId, onSelect, testId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const active = items.find(i => i.id === activeId);
  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button onClick={() => setOpen(!open)} data-testid={`${testId}-trigger`} className={`flex items-center gap-2 px-3 py-2 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap border ${active ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 shadow-[0_0_0_1px_rgba(212,175,55,0.08)]' : 'text-[#A9C5B4] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/15'}`}>
        {icon}<span>{label}</span>
        <CaretDown size={14} weight="bold" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute top-full left-0 mt-2 min-w-[220px] rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          {items.map(item => (
            <button key={item.id} onClick={() => { onSelect(item.id); setOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-sans transition-colors duration-150 flex items-center gap-2 ${activeId === item.id ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'text-[#A9C5B4] hover:bg-[#163A27] hover:text-white'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{item.label}
            </button>
          ))}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};

// ===== PLAYER CARD =====
const PlayerCard = ({ player, index }) => {
  const t = (player.hole_in_ones||0) + (player.albatross||0) + player.eagles + player.birdies + player.pars + player.bogeys + player.double_bogeys_plus;
  const rc = (r) => r===1?'from-[#D4AF37] to-[#B8860B]':r===2?'from-[#C0C0C0] to-[#808080]':r===3?'from-[#CD7F32] to-[#8B4513]':'from-[#A9C5B4] to-[#6B8F7B]';
  const bw = (c) => t===0?'0%':`${Math.max((c/t)*100,c>0?4:0)}%`;
  return (
    <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.4,delay:index*0.08}} data-testid={`player-card-${player.name.toLowerCase().replace(/\s+/g,'-')}`} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 backdrop-blur-md overflow-hidden shadow-2xl hover:border-[#D4AF37]/40 transition-all duration-300">
      <div className="p-5 pb-4 border-b border-[#D4AF37]/10"><div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-gradient-to-br ${rc(player.rank)} flex items-center justify-center text-[#051A10] font-bold text-sm shadow-lg`}>{player.rank||'-'}</div><div><h3 className="text-lg font-sans text-white tracking-tight">{player.name}</h3><p className="text-xs text-[#A9C5B4]">{player.rounds_played} round{player.rounds_played!==1?'s':''}</p></div></div>
        <div className="text-right"><p className="text-2xl font-bold text-[#D4AF37]">{player.total_points}</p><p className="text-xs text-[#A9C5B4] tracking-wider uppercase">Pts</p></div>
      </div></div>
      <div className="p-5 grid grid-cols-3 gap-3">
        {[{icon:<TrendUp size={18} weight="duotone"/>,val:player.avg_per_round,lbl:'Avg/Round'},{icon:<Medal size={18} weight="duotone"/>,val:player.best_round,lbl:'Best Round'},{icon:<Target size={18} weight="duotone"/>,val:player.avg_per_hole,lbl:'Avg/Hole'}].map((s,i)=>(
          <div key={i} className="text-center p-3 rounded-lg bg-[#051A10]/60 border border-[#D4AF37]/10"><div className="mx-auto mb-1 text-[#D4AF37] flex justify-center">{s.icon}</div><p className="text-lg font-bold text-white">{s.val}</p><p className="text-[10px] text-[#A9C5B4] uppercase tracking-wider">{s.lbl}</p></div>
        ))}
      </div>
      <div className="px-5 pb-5"><p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Scoring</p><div className="space-y-2">
        {(player.hole_in_ones||0)>0&&<Bar l="HIO" c={player.hole_in_ones} cl="bg-fuchsia-400" w={bw(player.hole_in_ones)} ic={<Star size={14} weight="fill"/>}/>}
        {(player.albatross||0)>0&&<Bar l="Albatross" c={player.albatross} cl="bg-violet-400" w={bw(player.albatross)} ic={<Crown size={14} weight="fill"/>}/>}
        <Bar l="Eagles" c={player.eagles} cl="bg-[#D4AF37]" w={bw(player.eagles)} ic={<Fire size={14} weight="fill"/>}/>
        <Bar l="Birdies" c={player.birdies} cl="bg-emerald-400" w={bw(player.birdies)} ic={<Flag size={14} weight="fill"/>}/>
        <Bar l="Pars" c={player.pars} cl="bg-sky-400" w={bw(player.pars)} ic={<Golf size={14} weight="fill"/>}/>
        <Bar l="Bogeys" c={player.bogeys} cl="bg-orange-400" w={bw(player.bogeys)} ic={<Target size={14} weight="fill"/>}/>
        {player.double_bogeys_plus>0&&<Bar l="Dbl+" c={player.double_bogeys_plus} cl="bg-red-400" w={bw(player.double_bogeys_plus)} ic={<Target size={14} weight="fill"/>}/>}
      </div></div>
      {player.round_details?.length>0&&<div className="px-5 pb-5"><p className="text-xs text-[#A9C5B4] uppercase tracking-[0.15em] mb-3">Rounds</p><div className="space-y-1.5">{player.round_details.map((rd,i)=>(<div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-[#051A10]/40"><span className="text-[#A9C5B4]">{rd.course}</span><span className="text-white font-bold">{rd.score} pts</span></div>))}</div></div>}
    </motion.div>
  );
};
const Bar = ({l,c,cl,w,ic}) => (<div className="flex items-center gap-2"><span className="text-[#A9C5B4] w-[72px] text-xs flex items-center gap-1"><span className={`${cl} rounded-full p-0.5 text-[#051A10]`}>{ic}</span>{l}</span><div className="flex-1 h-5 bg-[#051A10]/60 rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:w}} transition={{duration:0.8}} className={`h-full ${cl} rounded-full`}/></div><span className="text-white text-xs font-bold w-6 text-right">{c}</span></div>);

// ===== SEASON OVERVIEW =====
const Overview = ({data, onNav, archivedSeasons = [], onShareRecap}) => {
  if(!data) return null;
  const po=[1,0,2], ph=['h-28','h-36','h-24'], pc=['from-[#C0C0C0] to-[#A0A0A0]','from-[#D4AF37] to-[#B8860B]','from-[#CD7F32] to-[#A0522D]'], pl=['2nd','1st','3rd'];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} data-testid="season-overview">
      <div className="text-center mb-10"><h2 className="text-3xl sm:text-4xl font-sans text-[#D4AF37] mb-2">Season Overview</h2><p className="text-[#A9C5B4] text-sm">{data.total_courses} of {data.total_round_slots} rounds set up &middot; {data.active_players} active players</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <SC icon={<Users size={22} weight="duotone"/>} value={data.active_players} label="Active Players" sub={`of ${data.total_players} total`}/>
        <SC icon={<MapPin size={22} weight="duotone"/>} value={`${data.total_courses}/${data.total_round_slots}`} label="Rounds Set Up" sub={data.courses_played.join(', ')}/>
        <SC icon={<Gauge size={22} weight="duotone"/>} value={data.total_rounds_played} label="Rounds Played" sub={`${data.total_holes_played} holes`}/>
        <SC icon={<Star size={22} weight="duotone"/>} value={data.best_round.score} label="Best Round" sub={`${data.best_round.player} at ${(data.best_round.course||'').replace('Stableford - ','')}`}/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-6 shadow-2xl"><h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Crown size={16} className="text-[#D4AF37]"/> League Leaders</h3>
          <div className="flex items-end justify-center gap-4 pt-4">{data.top_players.length>=3&&po.map((pi,vi)=>{const p=data.top_players[pi];if(!p)return null;return(<motion.div key={p.name} initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{delay:vi*0.15}} className="flex flex-col items-center"><p className="text-white text-sm font-semibold mb-1">{p.name}</p><p className="text-[#D4AF37] text-lg font-bold mb-2">{p.total} pts</p><div className={`${ph[vi]} w-20 sm:w-24 rounded-t-lg bg-gradient-to-t ${pc[vi]} flex items-center justify-center shadow-lg`}><span className="text-[#051A10] font-bold text-lg">{pl[vi]}</span></div></motion.div>);})}</div>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-6 shadow-2xl"><h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Lightning size={16} className="text-[#D4AF37]"/> Highlights</h3><div className="space-y-4">
          <HR icon={<Trophy size={20} className="text-[#D4AF37]"/>} title="Leader" value={data.top_players[0]?.name||'-'} detail={`${data.top_players[0]?.total||0} pts`}/>
          <HR icon={<UsersThree size={20} className="text-emerald-400"/>} title="Top Team" value={data.top_team?.name||'-'} detail={`${data.top_team?.total||0} pts`}/>
          <HR icon={<Star size={20} className="text-amber-400"/>} title="Best Round" value={data.best_round.player} detail={`${data.best_round.score} pts`}/>
          <HR icon={<Fire size={20} className="text-orange-400"/>} title="Eagles" value={data.eagle_leader.player||'-'} detail={`${data.eagle_leader.count}`}/>
          <HR icon={<Flag size={20} className="text-green-400"/>} title="Birdies" value={data.birdie_leader.player||'-'} detail={`${data.birdie_leader.count}`}/>
          {data.hio_leader?.count>0&&<HR icon={<Star size={20} className="text-fuchsia-400"/>} title="HIO" value={data.hio_leader.player} detail={`${data.hio_leader.count}`}/>}
        </div></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QN icon={<Trophy size={24}/>} title="Leaderboards" desc="Rankings" onClick={()=>onNav('league_lb')}/>
        <QN icon={<ChartLine size={24}/>} title="Individual Rounds" desc="Round scores" onClick={()=>onNav('stableford')}/>
        <QN icon={<UsersThree size={24}/>} title="Teams" desc="Team scoring" onClick={()=>onNav('teams')}/>
        <QN icon={<User size={24}/>} title="Player Stats" desc="Breakdowns" onClick={()=>onNav('stats')}/>
      </div>

      {archivedSeasons && archivedSeasons.length > 0 && (
        <div className="mt-10" data-testid="past-champions-card">
          <h3 className="text-xs text-[#A9C5B4] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Trophy size={14} className="text-[#D4AF37]" weight="duotone"/> Past Champions</h3>
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
              const endYear = s.ended_at ? new Date(s.ended_at).getFullYear() : '';
              return (
                <motion.div
                  key={s.id}
                  initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
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
                        <span className="text-[#A9C5B4]/80">🥄 Spoon</span>
                        <span className="text-white/80 truncate max-w-[60%]">{spoon}</span>
                      </div>
                    )}
                    {joker && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#A9C5B4]/80">🎭 Joker King</span>
                        <span className="text-white/80 truncate max-w-[60%]">{joker}</span>
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
const SC = ({icon,value,label,sub}) => (<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-5 shadow-xl text-center"><div className="text-[#D4AF37] flex justify-center mb-2">{icon}</div><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-[#A9C5B4] uppercase tracking-wider mt-1">{label}</p>{sub&&<p className="text-[10px] text-[#A9C5B4]/70 mt-1 truncate">{sub}</p>}</motion.div>);
const HR = ({icon,title,value,detail}) => (<div className="flex items-center gap-3 py-2 border-b border-[#D4AF37]/10 last:border-0"><div>{icon}</div><div className="flex-1 min-w-0"><p className="text-xs text-[#A9C5B4] uppercase tracking-wider">{title}</p><p className="text-white font-semibold text-sm truncate">{value}</p></div><p className="text-xs text-[#A9C5B4] text-right">{detail}</p></div>);
const QN = ({icon,title,desc,onClick}) => (<button onClick={onClick} className="rounded-xl border border-[#D4AF37]/15 bg-[#0F2C1D]/60 p-5 shadow-lg text-left hover:bg-[#163A27] hover:border-[#D4AF37]/30 transition-all group"><div className="text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform">{icon}</div><p className="text-white text-sm font-semibold">{title}</p><p className="text-[#A9C5B4] text-xs mt-0.5">{desc}</p></button>);

// ===== DATA TABLE =====
const DataTable = ({data}) => {
  if(!data?.length) return <div className="py-12 text-center text-[#A9C5B4]">No data</div>;
  // Hide internal sorting helper columns from the UI
  const hiddenKeys = new Set(['rank_display']);
  const headers = Object.keys(data[0]).filter(h => !hiddenKeys.has(h));
  return (
    <div className="rounded-lg border border-[#D4AF37]/20 bg-[#0F2C1D]/80 backdrop-blur-md overflow-hidden shadow-2xl" data-testid="table-container"><div className="overflow-x-auto"><table className="w-full">
      <thead><tr className="bg-[#0A2A1A] border-b border-[#D4AF37]/30">
        {headers.map((h,i)=>{const isName=h.toLowerCase()==='player'||h.toLowerCase()==='team';return<th key={i} className={`py-4 px-4 text-xs font-sans tracking-[0.15em] uppercase text-[#A9C5B4] ${isName?'text-left':'text-center'}`}>{h}</th>;})}
      </tr></thead>
      <tbody>{data.map((row,ri)=>{
        const rankDisp = row.rank_display || (row.rank ? String(row.rank) : null);
        const numericRank = parseInt(row.rank);
        const isTopThree = numericRank >= 1 && numericRank <= 3;
        return(
        <tr key={ri} className={`${ri%2===0?'bg-transparent':'bg-[#FFFFFF]/5'} hover:bg-[#163A27] transition-colors ${isTopThree?'border-l-2 border-[#D4AF37]':''}`}>
          {headers.map((k,ci)=>{
            const v = row[k];
            const isName=k.toLowerCase()==='player'||k.toLowerCase()==='team';
            const isRankCol = k.toLowerCase() === 'rank';
            return(
            <td key={ci} className={`py-3 px-4 text-sm font-sans text-white ${isName?'text-left':'text-center'}`}>
              <div className={`flex items-center gap-2 ${isName?'':'justify-center'}`}>
                {ci===0&&isTopThree&&<span className="inline-flex items-center justify-center rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 text-xs font-bold">#{numericRank}</span>}
                <span>{isRankCol && rankDisp ? rankDisp : String(v)}</span>
              </div>
            </td>);})}
        </tr>);})}</tbody>
    </table></div></div>
  );
};

// ===== AUTH MODAL =====
const AuthModal = ({onSuccess, onClose}) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true); setSuccess('');
    try {
      if (mode === 'login') {
        await db.signIn(email, password);
        // Small delay to let auth state propagate before closing modal
        await new Promise(r => setTimeout(r, 500));
        onSuccess();
      } else {
        const res = await db.signUp(email, password, displayName);
        // If session was returned (email confirmation disabled), user is logged in
        if (res?.session) {
          await new Promise(r => setTimeout(r, 500));
          onSuccess();
        } else {
          setSuccess('Account created! Please check your email to confirm your address, then sign in. An admin will approve your editing access.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#051A10]/80 backdrop-blur-sm">
      <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} className="w-full max-w-sm mx-4 rounded-xl border border-[#D4AF37]/30 bg-[#0F2C1D] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-sans text-[#D4AF37] flex items-center gap-2"><Lock size={20}/> {mode==='login'?'Sign In':'Register'}</h2>
          <button onClick={onClose} className="text-[#A9C5B4] hover:text-white"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode==='register'&&<input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm" placeholder="Display Name" required/>}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm" placeholder="Email" required data-testid="auth-email"/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white placeholder-[#A9C5B4]/50 focus:border-[#D4AF37]/50 focus:outline-none text-sm" placeholder="Password" required data-testid="auth-password"/>
          {error&&<p className="text-red-400 text-xs">{error}</p>}
          {success&&<p className="text-emerald-400 text-xs">{success}</p>}
          <button type="submit" disabled={loading} data-testid="auth-submit" className="w-full py-2.5 rounded-lg bg-[#D4AF37] text-[#051A10] font-bold text-sm hover:bg-[#F1D67E] transition-colors disabled:opacity-50">{loading?'Please wait...':mode==='login'?'Sign In':'Create Account'}</button>
        </form>
        <p className="text-xs text-[#A9C5B4] text-center mt-4">
          {mode==='login'?<>No account? <button onClick={()=>{setMode('register');setError('');setSuccess('');}} className="text-[#D4AF37] hover:underline">Register</button></>:<>Have an account? <button onClick={()=>{setMode('login');setError('');setSuccess('');}} className="text-[#D4AF37] hover:underline">Sign In</button></>}
        </p>
      </motion.div>
    </motion.div>
  );
};

// ===== SCORE ENTRY =====
const ScoreEntry = ({rounds, players, userId, userPlayerId = null, currentRoundId = null}) => {
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [holes, setHoles] = useState([]);
  const [holesLoading, setHolesLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [selectedHole, setSelectedHole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [excludedPlayers, setExcludedPlayers] = useState(new Set());
  const hasSetDefaults = useRef(false);

  // Get live round (is_current flag or currentRoundId match)
  const liveRound = useMemo(() => {
    // Priority: 1) Round with is_current flag, 2) Round matching currentRoundId, 3) First open round
    return rounds.find(r => r.is_current) || 
           rounds.find(r => r.id === parseInt(currentRoundId)) ||
           rounds.find(r => !r.is_closed);
  }, [rounds, currentRoundId]);

  // Set round default once when component mounts with data
  useEffect(() => {
    if (hasSetDefaults.current) return;
    if (rounds.length === 0) return;
    
    hasSetDefaults.current = true;
    
    // Set round default priority: 1) Live round if open, 2) First open round
    let defaultRound = null;
    if (liveRound && !liveRound.is_closed) {
      defaultRound = liveRound.id;
    } else {
      const openRounds = rounds.filter(r => !r.is_closed);
      defaultRound = openRounds[0]?.id || rounds[0]?.id;
    }
    if (defaultRound) setSelectedRound(defaultRound);
  }, [rounds, liveRound]);
  
  // Set player default whenever userPlayerId becomes available
  useEffect(() => {
    if (!userPlayerId) return;
    if (players.length === 0) return;
    if (selectedPlayer) return; // Don't override if already selected
    
    const linkedPlayer = players.find(p => p.id === userPlayerId);
    if (linkedPlayer) {
      setSelectedPlayer(userPlayerId);
    }
  }, [userPlayerId, players, selectedPlayer]);

  useEffect(() => {
    if(!selectedRound) return;
    setHolesLoading(true);
    setHoles([]);
    setExcludedPlayers(new Set());
    
    Promise.all([
      db.getHolesForRound(selectedRound),
      db.getRoundExclusions(selectedRound)
    ]).then(([holesData, exclusionIds]) => {
      setHoles(holesData || []);
      setExcludedPlayers(new Set(exclusionIds || []));
    }).catch(() => {
      setHoles([]);
    }).finally(() => {
      setHolesLoading(false);
    });
    
    // Only reset player/scores when round actually changes (not initial mount)
    if (hasSetDefaults.current) {
      setSelectedPlayer(null);
    }
    setSelectedHole(null);
    setScores({});
  }, [selectedRound]);

  useEffect(() => {
    if(!selectedRound||!selectedPlayer) { setScores({}); setSelectedHole(null); return; }
    setScores({}); // Clear while loading
    db.getScoresForRound(selectedRound).then(data => {
      const ps = {};
      data.filter(s=>s.player_id===parseInt(selectedPlayer)).forEach(s=>{ ps[s.hole_number]=s.strokes; });
      setScores(ps);
    }).catch(() => setScores({}));
  }, [selectedRound, selectedPlayer]);

  const updateScore = (hole, val) => { const n=val===''?'':parseInt(val); if(val!==''&&(isNaN(n)||n<0||n>20))return; setScores(p=>({...p,[hole]:n})); };
  const adjustScore = (hole, delta, par) => {
    const current = scores[hole];
    const base = current != null && current !== '' ? parseInt(current) : par || 4;
    const newVal = Math.max(1, Math.min(15, base + delta));
    setScores(p => ({...p, [hole]: newVal}));
  };
  const totalScore = Object.values(scores).reduce((a,b)=>(typeof b==='number'?a+b:a),0);
  const totalPar = holes.reduce((a,h)=>a+h.par,0);
  const filled = Object.values(scores).filter(v=>typeof v==='number'&&v>0).length;

  const handleSave = async () => {
    if(!selectedPlayer||!selectedRound||filled===0) return;
    setSaving(true); setMsg('');
    try {
      const scoreRows = Object.entries(scores).filter(([,v])=>typeof v==='number'&&v>0).map(([hole,strokes])=>({
        round_id: parseInt(selectedRound), player_id: parseInt(selectedPlayer),
        hole_number: parseInt(hole), strokes
      }));
      await db.upsertScores(scoreRows);
      setMsg(`Saved ${filled} holes!`);
    } catch(err) { setMsg('Error: '+err.message); }
    finally { setSaving(false); setTimeout(()=>setMsg(''),5000); }
  };

  const rd = rounds.find(r=>r.id===parseInt(selectedRound));

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} data-testid="score-entry">
      <div className="text-center mb-8"><h2 className="text-3xl font-sans text-[#D4AF37] mb-2">Score Entry</h2></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
        <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Round</label>
          <select value={selectedRound||''} onChange={e=>setSelectedRound(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            {rounds.filter(r => !r.is_closed).map(r=><option key={r.id} value={r.id}>{r.courses?.name} (Round {r.round_number})</option>)}
          </select></div>
        <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Player</label>
          <select value={selectedPlayer||''} onChange={e=>setSelectedPlayer(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            <option value="">Choose player...</option>
            {players.filter(p=>!excludedPlayers.has(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
      </div>
      {rd&&<div className="flex flex-wrap justify-center gap-4 mb-6 text-xs text-[#A9C5B4]">
        <span>Course: <strong className="text-white">{rd.courses?.name}</strong></span>
        <span>Par: <strong className="text-white">{rd.courses?.par}</strong></span>
        <span>Rating: <strong className="text-white">{rd.courses?.rating}</strong></span>
        <span>Slope: <strong className="text-white">{rd.courses?.slope}</strong></span>
      </div>}
      {rd?.is_closed && (
        <div className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-red-900/20 p-5 text-center mb-6">
          <p className="text-red-300 text-sm font-semibold mb-1">Round Closed</p>
          <p className="text-[#A9C5B4] text-xs">This round has been closed. No new scores can be added or changed.</p>
        </div>
      )}
      {selectedPlayer&&!rd?.is_closed&&(
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-4 border-b border-[#D4AF37]/10 flex items-center justify-between">
            <h3 className="text-sm text-white"><span className="text-[#D4AF37] font-bold">{players.find(p=>p.id===parseInt(selectedPlayer))?.name}</span></h3>
            <div className="text-xs text-[#A9C5B4]">{filled}/{holes.length} holes &middot; Total: <span className={`font-bold ${totalScore-totalPar<0?'text-emerald-400':totalScore-totalPar>0?'text-orange-400':'text-white'}`}>{totalScore||'-'}</span>{totalScore>0&&<span className="ml-1">({totalScore-totalPar>=0?'+':''}{totalScore-totalPar})</span>}</div>
          </div>
          
          {/* Hole Selector Grid */}
          {holesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
            </div>
          ) : holes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#A9C5B4] text-sm">No holes configured for this course</p>
            </div>
          ) : (
          <>
          <div className="p-4">
            {[{label:'Front 9',slice:[0,9]},{label:'Back 9',slice:[9,18]}].map(({label,slice})=>{
              const sectionHoles = holes.slice(...slice);
              if (sectionHoles.length === 0) return null;
              return (
                <div key={label} className="mb-4">
                  <p className="text-xs text-[#A9C5B4] uppercase tracking-wider mb-2">{label}</p>
                  <div className="grid grid-cols-9 gap-2">
                    {sectionHoles.map(h => {
                      const v = scores[h.hole_number];
                      const hasV = v != null && v !== '';
                      const isSelected = selectedHole === h.hole_number;
                      const diff = hasV ? v - h.par : 0;
                      const baseTone = !hasV
                        ? 'bg-[#051A10] border-[#D4AF37]/20 text-white'
                        : diff < 0
                          ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
                          : diff === 0
                            ? 'bg-[#051A10] border-[#D4AF37]/40 text-white'
                            : 'bg-orange-900/30 border-orange-500/40 text-orange-300';
                      return (
                        <button
                          key={h.hole_number}
                          onClick={() => setSelectedHole(h.hole_number)}
                          className={`aspect-square rounded-lg border text-sm font-bold transition-all relative ${
                            isSelected 
                              ? 'ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-[#0F2C1D] ' + baseTone
                              : baseTone + ' hover:border-[#D4AF37]/50'
                          }`}
                          title={`Par ${h.par}, SI ${h.stroke_index}`}
                        >
                          <span className="block text-xs opacity-70">{h.hole_number}</span>
                          <span className="block text-sm">{hasV ? v : '−'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Hole Score Input */}
          {selectedHole && (
            <div className="px-4 pb-4">
              <div className="bg-[#051A10]/50 rounded-xl p-4 border border-[#D4AF37]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[#A9C5B4]">Hole {selectedHole}</span>
                  <span className="text-xs text-[#A9C5B4]">Par {holes.find(h => h.hole_number === selectedHole)?.par} • SI {holes.find(h => h.hole_number === selectedHole)?.stroke_index}</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => adjustScore(selectedHole, -1, holes.find(h => h.hole_number === selectedHole)?.par)}
                    className="w-14 h-14 rounded-xl bg-[#051A10] border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-bold active:bg-[#D4AF37]/20 flex items-center justify-center"
                    disabled={scores[selectedHole] != null && scores[selectedHole] !== '' && scores[selectedHole] <= 1}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const h = holes.find(hh => hh.hole_number === selectedHole);
                      const v = scores[selectedHole];
                      const hasV = v != null && v !== '';
                      updateScore(selectedHole, hasV ? v : h?.par || 4);
                    }}
                    className={`w-20 h-14 rounded-xl border text-2xl font-bold ${
                      (() => {
                        const h = holes.find(hh => hh.hole_number === selectedHole);
                        const v = scores[selectedHole];
                        const hasV = v != null && v !== '';
                        if (!hasV) return 'bg-[#051A10] border-[#D4AF37]/30 text-white';
                        const diff = v - h.par;
                        if (diff < 0) return 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300';
                        if (diff === 0) return 'bg-[#051A10] border-[#D4AF37]/40 text-white';
                        return 'bg-orange-900/30 border-orange-500/40 text-orange-300';
                      })()
                    }`}
                  >
                    {(() => {
                      const v = scores[selectedHole];
                      const hasV = v != null && v !== '';
                      return hasV ? v : '−';
                    })()}
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustScore(selectedHole, 1, holes.find(h => h.hole_number === selectedHole)?.par)}
                    className="w-14 h-14 rounded-xl bg-[#051A10] border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-bold active:bg-[#D4AF37]/20 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                {/* Quick set buttons */}
                <div className="flex justify-center gap-2 mt-3">
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <button
                      key={n}
                      onClick={() => updateScore(selectedHole, n)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${
                        scores[selectedHole] === n 
                          ? 'bg-[#D4AF37] text-[#051A10] border-[#D4AF37]' 
                          : 'bg-[#051A10] text-white border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

            <div className="p-4 border-t border-[#D4AF37]/10 flex items-center justify-between gap-3">
              {msg&&<p className={`text-xs flex-1 ${msg.includes('Error')?'text-red-400':'text-emerald-400'}`}>{msg}</p>}
              <button onClick={handleSave} disabled={saving||filled===0} className="flex items-center gap-2 px-6 py-2.5 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] transition-colors disabled:opacity-40 ml-auto" data-testid="save-scores-btn">
                <CloudArrowUp size={16} weight="bold"/> {saving?'Saving...':'Save Scores'}
              </button>
            </div>
          </>
          )}
        </div>
      )}
      {/* Read-only view for closed rounds - show existing scores */}
      {selectedPlayer&&rd?.is_closed&&(
        <div className="rounded-xl border border-red-500/20 bg-[#0F2C1D]/90 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-4 border-b border-red-500/10 flex items-center justify-between bg-red-900/10">
            <h3 className="text-sm text-white"><span className="text-[#D4AF37] font-bold">{players.find(p=>p.id===parseInt(selectedPlayer))?.name}</span></h3>
            <span className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30">Round Closed - View Only</span>
          </div>
          <div className="p-4">
            {holes.length>0 ? (
              <div className="grid grid-cols-9 gap-3">
                {holes.map(h=>{
                  const v = scores[h.hole_number];
                  const hasV = v!=null&&v!=='';
                  const diff = hasV ? v - h.par : 0;
                  const tone = !hasV ? 'bg-[#051A10]/50 border-[#D4AF37]/10 text-[#A9C5B4]' : diff<0 ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300' : diff===0 ? 'bg-[#051A10] border-[#D4AF37]/20 text-white' : 'bg-orange-900/20 border-orange-500/30 text-orange-300';
                  return (
                    <div key={h.hole_number} className="text-center">
                      <div className="text-[10px] text-[#A9C5B4] mb-1">H{h.hole_number}</div>
                      <div className="text-[10px] text-[#D4AF37]/60 mb-1">P{h.par}</div>
                      <div className={`w-full h-10 flex items-center justify-center rounded-lg border text-sm font-bold ${tone}`}>
                        {hasV ? v : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-[#A9C5B4] text-sm py-4">No hole data available</p>
            )}
          </div>
          <div className="p-4 border-t border-red-500/10 bg-red-900/5">
            <p className="text-center text-xs text-[#A9C5B4]">Scores cannot be edited because this round is closed.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ===== MAIN APP =====
function App() {
  const [view, setView] = useState('overview');
  const [viewParam, setViewParam] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recapSeason, setRecapSeason] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authNotice, setAuthNotice] = useState('');

  // Data
  const [overview, setOverview] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [teamLb, setTeamLb] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [awards, setAwards] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [sheetDataMode, setSheetDataMode] = useState(null); // Track which mode sheetData is for
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState(() => {
    // Load from localStorage or default to 'stableford'
    const saved = localStorage.getItem('leaderboardMode');
    return saved === 'stroke' || saved === 'stableford' ? saved : 'stableford';
  }); // 'stableford' | 'stroke'
  const [quickScoreOpen, setQuickScoreOpen] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [archivedSeasons, setArchivedSeasons] = useState([]);

  // Auth
  useEffect(() => {
    const init = async () => {
      const session = await supabase.auth.getSession();
      if (session?.session?.user) {
        setUser(session.session.user);
        const { data } = await supabase.from('user_profiles').select('*').eq('id', session.session.user.id).single();
        setProfile(data);
      }
      setShowAuth(!session?.session?.user);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        supabase.from('user_profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data));
        setShowAuth(false);
      } else {
        setUser(null);
        setProfile(null);
        setShowAuth(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [roundsVersion, setRoundsVersion] = useState(0);
  
  const loadData = useCallback(async () => {
    try {
      const [r, p, cs, arch] = await Promise.all([
        db.getSetUpRounds(),
        db.getPlayers(),
        db.getCurrentSeason().catch(() => null),
        db.getArchivedSeasons().catch(() => []),
      ]);
      setRounds(r); setPlayers(p);
      setCurrentSeason(cs);
      setArchivedSeasons(arch || []);
      setRoundsVersion(v => v + 1); // Trigger refresh in score components
    } catch(err) { console.error(err); }
  }, []);

  // Load initial data
  useEffect(() => { loadData(); }, [loadData]);

  const loadView = useCallback(async (v, param) => {
    setLoading(true);
    // Safety: force-clear loading after 15s so the user is never stuck on a "Loading..." spinner
    const safety = setTimeout(() => setLoading(false), 15000);
    try {
      if (v === 'overview') { setOverview(await db.getSeasonOverview()); }
      else if (v === 'league_lb') { setLeaderboard(await db.getLeaderboardData(leaderboardMode)); }
      else if (v === 'team_lb') { setTeamLb(await db.getTeamLeaderboardData(leaderboardMode)); }
      else if (v === 'stats') { setPlayerStats(await db.getPlayerStats()); }
      else if (v === 'awards') { setAwards(await db.getAwards()); }
      else if (v === 'stableford' && param) { 
        const data = await db.getStablefordRoundData(param, leaderboardMode);
        setSheetData(data); 
        setSheetDataMode(leaderboardMode);
      }
      else if (v === 'teams' && param) { 
        const data = await db.getTeamRoundData(param, leaderboardMode);
        setSheetData(data); 
        setSheetDataMode(leaderboardMode);
      }
      setLastUpdated(new Date().toISOString());
    } catch(err) { 
      console.error(err); 
    }
    finally { 
      clearTimeout(safety); 
      setLoading(false); 
    }
  }, [leaderboardMode]);

  // Persist leaderboardMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('leaderboardMode', leaderboardMode);
  }, [leaderboardMode]);

  useEffect(() => { loadView(view, viewParam); }, [view, viewParam, loadView, leaderboardMode]);

  const navigate = (v, param) => { 
    // Clear sheetData when navigating to scorecards to prevent showing old data
    if (v === 'stableford' || v === 'teams') {
      setSheetData(null);
      setSheetDataMode(null);
    }
    setView(v); 
    setViewParam(param !== undefined ? param : (v==='stableford'||v==='teams'?rounds[0]?.id:null)); 
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Also refresh auth profile so admin sees latest user rows and stale sessions are corrected
      if (user) {
        try { const p = await db.getUserProfile(); setProfile(p); } catch (_) {}
      }
      await loadData();
      await loadView(view, viewParam);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try { await db.signOut(); } catch (_) {}
    setUser(null);
    setProfile(null);
    setView('overview');
    setViewParam(null);
  };

  const role = profile?.role || 'guest';
  const isApprovedUser = role === 'approved' || role === 'admin';
  const isPendingUser = role === 'pending';
  const isBlockedUser = role === 'rejected' || role === 'removed' || role === 'disabled';
  const isAdmin = role === 'admin';
  const canScore = !!user && isApprovedUser;

  useEffect(() => {
    if (!user || !isBlockedUser) return;
    (async () => {
      try { await db.signOut(); } catch (_) {}
      setUser(null);
      setProfile(null);
      setView('overview');
      setViewParam(null);
      setAuthNotice('Your account is disabled. Please contact an admin.');
    })();
  }, [user, isBlockedUser]);

  useEffect(() => {
    if (!user) {
      setAuthNotice('');
      return;
    }
    if (isPendingUser) {
      setAuthNotice('Your account is pending approval. You can view scores, but editing is disabled.');
      return;
    }
    if (!isBlockedUser) setAuthNotice('');
  }, [user, isPendingUser, isBlockedUser]);

  const primaryNav = [
    { id: 'overview', label: 'Overview' },
    { id: 'league_lb', label: 'League Leaderboard' },
    { id: 'team_lb', label: 'Team Leaderboard' },
    { id: 'stats', label: 'Player Stats' },
    { id: 'awards', label: 'Awards' },
    ...(canScore ? [{ id: 'score_entry', label: 'Scores' }] : []),
    ...(isAdmin ? [{ id: 'season_wizard', label: 'Season Setup' }, { id: 'admin', label: 'Admin' }] : []),
  ];

  const quickMenuItems = [
    { id: 'stats', label: 'Player Stats' },
    { id: 'awards', label: 'Awards' },
    ...(canScore ? [{ id: 'score_entry', label: 'Scores' }] : []),
    ...(isAdmin ? [{ id: 'season_wizard', label: 'Season Setup' }, { id: 'admin', label: 'Admin' }] : []),
  ];

  const stabItems = useMemo(() => rounds.map(r=>({id: r.id, label: `Individual - ${r.courses?.name || 'Round ' + r.round_number}`})), [rounds]);
  const teamItems = useMemo(() => rounds.map(r=>({id: r.id, label: `Teams - ${r.courses?.name || 'Round ' + r.round_number}`})), [rounds]);
  const mobilePrimaryItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'league_lb', label: 'League Leaderboard' },
    { id: 'team_lb', label: 'Team Leaderboard' },
  ];
  const quickMenuActiveViews = new Set(['stats', 'awards', 'score_entry', 'season_wizard', 'admin']);
  const primaryNavBtnClass = (isActive) => `flex items-center gap-2 px-3 py-2 text-sm font-sans rounded-lg whitespace-nowrap border transition-all ${
    isActive
      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 shadow-[0_0_0_1px_rgba(212,175,55,0.08)]'
      : 'text-[#A9C5B4] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/15'
  }`;
  const utilityNavBtnClass = (isActive) => `flex items-center gap-1.5 px-3 py-2 text-xs font-sans rounded-lg whitespace-nowrap border transition-all ${
    isActive
      ? 'bg-[#D4AF37]/12 text-[#D4AF37] border-[#D4AF37]/25'
      : 'text-[#9AB6A6] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/10'
  }`;

  useEffect(() => {
    if (view === 'score_entry' && !canScore) setView('overview');
    if ((view === 'admin' || view === 'season_wizard') && !isAdmin) setView('overview');
  }, [view, canScore, isAdmin]);

  const renderContent = () => {
    if (loading) {
      return (
        <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#A9C5B4] text-sm">Loading...</p>
          </div>
        </motion.div>
      );
    }
    if (view === 'overview' && overview) return <Overview data={overview} onNav={navigate} archivedSeasons={archivedSeasons} onShareRecap={setRecapSeason}/>;
    if (view === 'stats') {
      if (!playerStats || playerStats.length === 0) {
        return (
          <motion.div key="stats" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <Flag size={48} className="text-[#D4AF37]/50 mx-auto mb-4" />
              <h3 className="text-xl font-sans text-[#D4AF37] mb-2">No Stats Yet</h3>
              <p className="text-[#A9C5B4] text-sm max-w-xs mx-auto">No players have started scoring rounds yet. Stats will appear once rounds are completed.</p>
            </div>
          </motion.div>
        );
      }
      return (
        <motion.div key="stats" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {playerStats.map((p,i)=><PlayerCard key={p.name} player={p} index={i}/>)}
          </div>
        </motion.div>
      );
    }
    if (view === 'awards' && awards) {
      return (
        <motion.div key="awards" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
          <Awards awards={awards}/>
        </motion.div>
      );
    }
    if (view === 'live') {
      return (
        <motion.div key="live" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
          <LiveLeaderboard currentRound={viewParam} onRefresh={handleRefresh} mode={leaderboardMode} setMode={setLeaderboardMode} />
        </motion.div>
      );
    }
    if ((view === 'league_lb' || view === 'team_lb') && (leaderboard || teamLb)) {
      const isTeam = view === 'team_lb';
      const title = isTeam ? 'Team Leaderboard' : 'League Leaderboard';
      return (
        <motion.div key={view} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">{title}</h2>
          <DataTable data={isTeam ? teamLb?.leaderboard : leaderboard?.leaderboard}/>
        </motion.div>
      );
    }
    if (view === 'stableford' && sheetData && sheetDataMode === leaderboardMode) {
      return (
        <motion.div key={`${view}-${viewParam}-${leaderboardMode}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">{sheetData?.display_name}</h2>
          <ErrorBoundary>
            <GolfScorecard 
              data={sheetData?.data}
              title={null}
              currentUser={user?.name}
              jokerHole={sheetData?.joker_hole}
              beerHole={sheetData?.beer_hole}
              mode={leaderboardMode}
              playerHandicaps={sheetData?.player_handicaps}
            />
          </ErrorBoundary>
        </motion.div>
      );
    }
    if (view === 'teams' && sheetData && sheetDataMode === leaderboardMode) {
      return (
        <motion.div key={`${view}-${viewParam}-${leaderboardMode}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">{sheetData?.display_name}</h2>
          <TeamScorecard 
            data={sheetData?.data}
            title={null}
            jokerHole={sheetData?.joker_hole}
            beerHole={sheetData?.beer_hole}
            mode={leaderboardMode}
            playerHandicaps={sheetData?.player_handicaps}
          />
        </motion.div>
      );
    }
    if (view === 'score_entry' && canScore) return <ScoreEntry key={`score-entry-${roundsVersion}`} rounds={rounds} players={players} userId={user?.id} userPlayerId={profile?.player_id} currentRoundId={viewParam || currentSeason?.current_round_id} roundsVersion={roundsVersion}/>;
    if (view === 'season_wizard') return <SeasonWizard onComplete={()=>{ loadData(); navigate('overview'); }}/>;
    if (view === 'admin') return <AdminPanel onSeasonChanged={loadData} currentUserId={user?.id} allPlayers={players}/>;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#051A10] relative overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center" style={{backgroundImage:'url(https://images.unsplash.com/photo-1761400025076-8fec91f620f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxnb2xmJTIwY291cnNlJTIwZmFpcndheXN8ZW58MHx8fHwxNzc2MzQ1Mzg5fDA&ixlib=rb-4.1.0&q=85)'}}/>
      <div className="fixed inset-0 bg-[#051A10]/95"/>
      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#051A10]/80 border-b border-[#D4AF37]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-md border border-[#D4AF37]/25 bg-[#051A10] flex items-center justify-center">
                  <img src="/favicon.svg" alt="Pellies BC" className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] object-contain"/>
                </div>
                <div><h1 className="text-2xl sm:text-3xl font-sans font-bold text-[#D4AF37] tracking-tight" data-testid="app-season-title">{currentSeason?.name || 'Pellies Golf League'}</h1><p className="text-xs text-[#A9C5B4] mt-0.5">Updated: {formatLastUpdated(lastUpdated)}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 rounded-lg transition-colors disabled:opacity-50">
                  <ArrowsClockwise size={18} weight="bold" className={refreshing?'animate-spin':''}/><span className="hidden sm:inline text-sm">Refresh</span>
                </button>
                {user ? (
                  <button onClick={handleSignOut} className="flex items-center gap-1 px-3 py-2 text-xs text-[#A9C5B4] hover:text-red-400 transition-colors" data-testid="sign-out-button">
                    <SignOut size={16}/><span className="hidden sm:inline">{profile?.display_name||user.email.split('@')[0]}{isPendingUser ? ' (pending)' : ''}</span>
                  </button>
                ) : (
                  <button onClick={()=>setShowAuth(true)} className="flex items-center gap-1 px-3 py-2 text-sm text-[#D4AF37] hover:text-[#F1D67E] transition-colors">
                    <UserPlus size={18}/><span className="hidden sm:inline">Sign In</span>
                  </button>
                )}
              </div>
            </div>
            {authNotice && (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${isPendingUser ? 'border-amber-500/30 bg-amber-900/20 text-amber-200' : 'border-red-500/30 bg-red-900/20 text-red-200'}`}>
                {authNotice}
              </div>
            )}
            <nav className="mt-4">
              <div className="hidden lg:flex rounded-xl border border-[#D4AF37]/20 bg-[#0A2518]/75 backdrop-blur-xl px-2 py-2 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>navigate('overview')} className={primaryNavBtnClass(view==='overview')}><Gauge size={17} weight="duotone"/><span>Overview</span></button>
                  <button onClick={()=>navigate('live')} className={primaryNavBtnClass(view==='live')}><Target size={17} weight="duotone"/><span>Live</span></button>
                  <NavDropdown label="Leaderboards" icon={<Trophy size={17} weight="duotone"/>} items={[{id:'league_lb',label:'League Leaderboard'},{id:'team_lb',label:'Team Leaderboard'}]} activeId={view==='league_lb'||view==='team_lb'?view:null} onSelect={id=>navigate(id)} testId="nav-lb"/>
                  {stabItems.length>0&&<NavDropdown label="Individual Rounds" icon={<ChartLine size={17} weight="duotone"/>} items={stabItems} activeId={view==='stableford'?viewParam:null} onSelect={id=>navigate('stableford',id)} testId="nav-stab"/>}
                  {teamItems.length>0&&<NavDropdown label="Teams Round" icon={<UsersThree size={17} weight="duotone"/>} items={teamItems} activeId={view==='teams'?viewParam:null} onSelect={id=>navigate('teams',id)} testId="nav-teams"/>}
                </div>
                <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[#D4AF37]/20">
                  {/* Mode Toggle - Desktop */}
                  <div className="flex bg-[#051A10] rounded-lg p-0.5 border border-[#D4AF37]/20">
                    <button
                      onClick={() => setLeaderboardMode('stableford')}
                      className={`px-2 py-1 text-xs rounded-md transition-all ${
                        leaderboardMode === 'stableford'
                          ? 'bg-[#D4AF37] text-[#051A10] font-semibold'
                          : 'text-[#A9C5B4] hover:text-white'
                      }`}
                      title="Stableford scoring"
                    >
                      <span className="hidden xl:inline">Stableford</span>
                      <span className="xl:hidden">SF</span>
                    </button>
                    <button
                      onClick={() => setLeaderboardMode('stroke')}
                      className={`px-2 py-1 text-xs rounded-md transition-all ${
                        leaderboardMode === 'stroke'
                          ? 'bg-[#D4AF37] text-[#051A10] font-semibold'
                          : 'text-[#A9C5B4] hover:text-white'
                      }`}
                      title="Stroke play scoring"
                    >
                      <span className="hidden xl:inline">Stroke</span>
                      <span className="xl:hidden">ST</span>
                    </button>
                  </div>
                  {quickMenuItems.length>0&&<NavDropdown label="Manage" icon={<Gear size={15} weight="duotone"/>} items={quickMenuItems} activeId={quickMenuActiveViews.has(view)?view:null} onSelect={id=>navigate(id)} testId="nav-menu"/>}
                </div>
              </div>
              <div className="lg:hidden rounded-xl border border-[#D4AF37]/20 bg-[#0A2518]/75 backdrop-blur-xl px-2 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <NavDropdown label="Play" icon={<Gauge size={16} weight="duotone"/>} items={[{id:'overview',label:'Overview'},{id:'live',label:'Live Leaderboard'},{id:'league_lb',label:'League Leaderboard'},{id:'team_lb',label:'Team Leaderboard'}]} activeId={['overview','live','league_lb','team_lb'].includes(view)?view:null} onSelect={id=>navigate(id)} testId="nav-mobile-primary"/>
                  {quickMenuItems.length>0&&<NavDropdown label="Manage" icon={<Gear size={16} weight="duotone"/>} items={quickMenuItems} activeId={quickMenuActiveViews.has(view)?view:null} onSelect={id=>navigate(id)} testId="nav-mobile-menu"/>}
                  {stabItems.length>0&&<NavDropdown label="Individual" icon={<ChartLine size={16} weight="duotone"/>} items={stabItems} activeId={view==='stableford'?viewParam:null} onSelect={id=>navigate('stableford',id)} testId="nav-mobile-stab"/>}
                  {teamItems.length>0&&<NavDropdown label="Teams" icon={<UsersThree size={16} weight="duotone"/>} items={teamItems} activeId={view==='teams'?viewParam:null} onSelect={id=>navigate('teams',id)} testId="nav-mobile-teams"/>}
                </div>
                {/* Mode Toggle - Mobile */}
                <div className="mt-2 pt-2 border-t border-[#D4AF37]/20 flex justify-center">
                  <div className="flex bg-[#051A10] rounded-lg p-0.5 border border-[#D4AF37]/20">
                    <button
                      onClick={() => setLeaderboardMode('stableford')}
                      className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                        leaderboardMode === 'stableford'
                          ? 'bg-[#D4AF37] text-[#051A10] font-semibold'
                          : 'text-[#A9C5B4] hover:text-white'
                      }`}
                    >
                      Stableford
                    </button>
                    <button
                      onClick={() => setLeaderboardMode('stroke')}
                      className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                        leaderboardMode === 'stroke'
                          ? 'bg-[#D4AF37] text-[#051A10] font-semibold'
                          : 'text-[#A9C5B4] hover:text-white'
                      }`}
                    >
                      Stroke
                    </button>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </main>

        {/* Quick Score FAB - Only visible on mobile/tablet when user can score */}
        {user && (
          <button
            onClick={() => setQuickScoreOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#D4AF37] text-[#051A10] rounded-full shadow-2xl flex items-center justify-center hover:bg-[#F1D67E] active:scale-95 transition-all"
            title="Quick Score"
          >
            <Golf size={28} weight="fill" />
          </button>
        )}

        {/* Quick Score Drawer */}
        <QuickScoreDrawer
          isOpen={quickScoreOpen}
          onClose={() => setQuickScoreOpen(false)}
          rounds={rounds}
          players={players}
          userId={user?.id}
          userPlayerId={profile?.player_id}
          currentRoundId={viewParam || currentSeason?.current_round_id}
          roundsVersion={roundsVersion}
        />
      </div>
      <AnimatePresence>
        {showAuth&&<AuthModal onSuccess={()=>setShowAuth(false)} onClose={()=>setShowAuth(false)}/>}
        {recapSeason&&<SeasonRecapModal season={recapSeason} onClose={()=>setRecapSeason(null)}/>}
      </AnimatePresence>
    </div>
  );
}

export default App;
