import React, { useState, useEffect, useCallback, useRef } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChartLine, ArrowsClockwise, User, Target, Flag, Fire, TrendUp, Medal, Golf, CaretDown, UsersThree, Crown, Lightning, MapPin, Users, Gauge, Star, Lock, PencilSimple, Check, X, SignOut, CloudArrowUp, DownloadSimple, Gear, UserPlus, ShieldCheck } from '@phosphor-icons/react';
import * as db from './services/supabaseService';
import AdminPanel from './components/AdminPanel';
import SeasonWizard from './components/SeasonWizard';

const REFRESH_INTERVAL = 5 * 60 * 1000;

const formatLastUpdated = (ts) => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never';
const getRankBadge = (row) => { const r = parseInt(row.rank || row.Rank); return r >= 1 && r <= 3 ? r : null; };

// ===== NAV DROPDOWN =====
const NavDropdown = ({ label, icon, items, activeId, onSelect, testId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const active = items.find(i => i.id === activeId);
  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button onClick={() => setOpen(!open)} data-testid={`${testId}-trigger`} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans transition-all duration-200 rounded-lg whitespace-nowrap ${active ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}>
        {icon}<span>{active ? active.label : label}</span>
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
        <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-gradient-to-br ${rc(player.rank)} flex items-center justify-center text-[#051A10] font-bold text-sm shadow-lg`}>{player.rank||'-'}</div><div><h3 className="text-lg font-serif text-white tracking-tight">{player.name}</h3><p className="text-xs text-[#A9C5B4]">{player.rounds_played} round{player.rounds_played!==1?'s':''}</p></div></div>
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
const Overview = ({data, onNav}) => {
  if(!data) return null;
  const po=[1,0,2], ph=['h-28','h-36','h-24'], pc=['from-[#C0C0C0] to-[#A0A0A0]','from-[#D4AF37] to-[#B8860B]','from-[#CD7F32] to-[#A0522D]'], pl=['2nd','1st','3rd'];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} data-testid="season-overview">
      <div className="text-center mb-10"><h2 className="text-3xl sm:text-4xl font-serif text-[#D4AF37] mb-2">Season Overview</h2><p className="text-[#A9C5B4] text-sm">{data.total_courses} of {data.total_round_slots} rounds set up &middot; {data.active_players} active players</p></div>
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
        <QN icon={<ChartLine size={24}/>} title="Stableford" desc="Round scores" onClick={()=>onNav('stableford')}/>
        <QN icon={<UsersThree size={24}/>} title="Teams" desc="Team scoring" onClick={()=>onNav('teams')}/>
        <QN icon={<User size={24}/>} title="Player Stats" desc="Breakdowns" onClick={()=>onNav('stats')}/>
      </div>
    </motion.div>
  );
};
const SC = ({icon,value,label,sub}) => (<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 p-5 shadow-xl text-center"><div className="text-[#D4AF37] flex justify-center mb-2">{icon}</div><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-[#A9C5B4] uppercase tracking-wider mt-1">{label}</p>{sub&&<p className="text-[10px] text-[#A9C5B4]/70 mt-1 truncate">{sub}</p>}</motion.div>);
const HR = ({icon,title,value,detail}) => (<div className="flex items-center gap-3 py-2 border-b border-[#D4AF37]/10 last:border-0"><div>{icon}</div><div className="flex-1 min-w-0"><p className="text-xs text-[#A9C5B4] uppercase tracking-wider">{title}</p><p className="text-white font-semibold text-sm truncate">{value}</p></div><p className="text-xs text-[#A9C5B4] text-right">{detail}</p></div>);
const QN = ({icon,title,desc,onClick}) => (<button onClick={onClick} className="rounded-xl border border-[#D4AF37]/15 bg-[#0F2C1D]/60 p-5 shadow-lg text-left hover:bg-[#163A27] hover:border-[#D4AF37]/30 transition-all group"><div className="text-[#D4AF37] mb-3 group-hover:scale-110 transition-transform">{icon}</div><p className="text-white text-sm font-semibold">{title}</p><p className="text-[#A9C5B4] text-xs mt-0.5">{desc}</p></button>);

// ===== DATA TABLE =====
const DataTable = ({data}) => {
  if(!data?.length) return <div className="py-12 text-center text-[#A9C5B4]">No data</div>;
  const headers = Object.keys(data[0]);
  return (
    <div className="rounded-lg border border-[#D4AF37]/20 bg-[#0F2C1D]/80 backdrop-blur-md overflow-hidden shadow-2xl" data-testid="table-container"><div className="overflow-x-auto"><table className="w-full">
      <thead><tr className="bg-[#0A2A1A] border-b border-[#D4AF37]/30">
        {headers.map((h,i)=>{const isName=h.toLowerCase()==='player'||h.toLowerCase()==='team';return<th key={i} className={`py-4 px-4 text-xs font-sans tracking-[0.15em] uppercase text-[#A9C5B4] ${isName?'text-left':'text-center'}`}>{h}</th>;})}
      </tr></thead>
      <tbody>{data.map((row,ri)=>{const rb=getRankBadge(row);return(
        <tr key={ri} className={`${ri%2===0?'bg-transparent':'bg-[#FFFFFF]/5'} hover:bg-[#163A27] transition-colors ${rb?'border-l-2 border-[#D4AF37]':''}`}>
          {Object.entries(row).map(([k,v],ci)=>{const isName=k.toLowerCase()==='player'||k.toLowerCase()==='team';return(
            <td key={ci} className={`py-3 px-4 text-sm font-sans text-white ${isName?'text-left':'text-center'}`}>
              <div className={`flex items-center gap-2 ${isName?'':'justify-center'}`}>
                {ci===0&&rb&&<span className="inline-flex items-center justify-center rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 text-xs font-bold">#{rb}</span>}
                <span>{String(v)}</span>
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
          <h2 className="text-xl font-serif text-[#D4AF37] flex items-center gap-2"><Lock size={20}/> {mode==='login'?'Sign In':'Register'}</h2>
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
const ScoreEntry = ({rounds, players, userId}) => {
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [holes, setHoles] = useState([]);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if(rounds.length>0&&!selectedRound) setSelectedRound(rounds[0].id); }, [rounds, selectedRound]);

  useEffect(() => {
    if(!selectedRound) return;
    db.getRoundHoles(selectedRound).then(setHoles);
    setSelectedPlayer(null); setScores({});
  }, [selectedRound]);

  useEffect(() => {
    if(!selectedRound||!selectedPlayer) { setScores({}); return; }
    db.getScoresForRound(selectedRound).then(data => {
      const ps = {};
      data.filter(s=>s.player_id===parseInt(selectedPlayer)).forEach(s=>{ ps[s.hole_number]=s.strokes; });
      setScores(ps);
    });
  }, [selectedRound, selectedPlayer]);

  const updateScore = (hole, val) => { const n=val===''?'':parseInt(val); if(val!==''&&(isNaN(n)||n<0||n>20))return; setScores(p=>({...p,[hole]:n})); };
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
      <div className="text-center mb-8"><h2 className="text-3xl font-serif text-[#D4AF37] mb-2">Score Entry</h2></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
        <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Round</label>
          <select value={selectedRound||''} onChange={e=>setSelectedRound(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            {rounds.map(r=><option key={r.id} value={r.id}>{r.courses?.name} (Round {r.round_number})</option>)}
          </select></div>
        <div><label className="text-xs text-[#A9C5B4] uppercase tracking-wider block mb-2">Player</label>
          <select value={selectedPlayer||''} onChange={e=>setSelectedPlayer(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#051A10] border border-[#D4AF37]/20 text-white focus:outline-none text-sm">
            <option value="">Choose player...</option>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
      </div>
      {rd&&<div className="flex flex-wrap justify-center gap-4 mb-6 text-xs text-[#A9C5B4]">
        <span>Course: <strong className="text-white">{rd.courses?.name}</strong></span>
        <span>Par: <strong className="text-white">{rd.courses?.par}</strong></span>
        <span>Rating: <strong className="text-white">{rd.courses?.rating}</strong></span>
        <span>Slope: <strong className="text-white">{rd.courses?.slope}</strong></span>
      </div>}
      {selectedPlayer&&holes.length>0&&(
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#0F2C1D]/90 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-4 border-b border-[#D4AF37]/10 flex items-center justify-between">
            <h3 className="text-sm text-white"><span className="text-[#D4AF37] font-bold">{players.find(p=>p.id===parseInt(selectedPlayer))?.name}</span></h3>
            <div className="text-xs text-[#A9C5B4]">{filled}/{holes.length} holes &middot; Total: <span className={`font-bold ${totalScore-totalPar<0?'text-emerald-400':totalScore-totalPar>0?'text-orange-400':'text-white'}`}>{totalScore||'-'}</span>{totalScore>0&&<span className="ml-1">({totalScore-totalPar>=0?'+':''}{totalScore-totalPar})</span>}</div>
          </div>
          {[{label:'Front 9',slice:[0,9]},{label:'Back 9',slice:[9,18]}].map(({label,slice})=>(
            <div key={label} className="p-4"><p className="text-xs text-[#A9C5B4] uppercase tracking-wider mb-3">{label}</p><div className="grid grid-cols-9 gap-2">
              {holes.slice(...slice).map(h=>(<div key={h.hole_number} className="text-center"><div className="text-[10px] text-[#A9C5B4] mb-1">H{h.hole_number}</div><div className="text-[10px] text-[#D4AF37]/60 mb-1">P{h.par}</div>
                <input type="number" min="1" max="15" value={scores[h.hole_number]??''} onChange={e=>updateScore(h.hole_number,e.target.value)} className={`w-full h-10 text-center rounded-lg border text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#D4AF37] ${scores[h.hole_number]!=null&&scores[h.hole_number]!==''?scores[h.hole_number]<h.par?'bg-emerald-900/40 border-emerald-500/40 text-emerald-300':scores[h.hole_number]===h.par?'bg-[#051A10] border-[#D4AF37]/30 text-white':'bg-orange-900/30 border-orange-500/40 text-orange-300':'bg-[#051A10] border-[#D4AF37]/15 text-white'}`}/>
              </div>))}
            </div></div>
          ))}
          <div className="p-4 border-t border-[#D4AF37]/10 flex items-center justify-between">
            {msg&&<p className={`text-xs ${msg.includes('Error')?'text-red-400':'text-emerald-400'}`}>{msg}</p>}
            <button onClick={handleSave} disabled={saving||filled===0} className="flex items-center gap-2 px-6 py-2.5 bg-[#D4AF37] text-[#051A10] font-bold text-sm rounded-lg hover:bg-[#F1D67E] transition-colors disabled:opacity-40 ml-auto">
              <CloudArrowUp size={16} weight="bold"/> {saving?'Saving...':'Save Scores'}
            </button>
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
  const [showAuth, setShowAuth] = useState(false);

  // Data
  const [overview, setOverview] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [teamLb, setTeamLb] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);

  // Auth
  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = db.onAuthChange(async (event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      if (session?.user) {
        try {
          const p = await db.getUserProfile();
          if (mounted) setProfile(p);
        } catch (e) { console.error('Profile fetch error:', e); }
      } else { setProfile(null); }
    });
    // Initial check
    db.getSession().then(async (s) => {
      if (!mounted) return;
      setUser(s?.user || null);
      if (s?.user) {
        try {
          const p = await db.getUserProfile();
          if (mounted) setProfile(p);
        } catch (e) { console.error('Profile fetch error:', e); }
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // Load initial data
  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([db.getSetUpRounds(), db.getPlayers()]);
      setRounds(r); setPlayers(p);
    } catch(err) { console.error(err); }
  }, []);

  const loadView = useCallback(async (v, param) => {
    setLoading(true);
    try {
      if (v === 'overview') { setOverview(await db.getSeasonOverview()); }
      else if (v === 'league_lb') { setLeaderboard(await db.getLeaderboardData()); }
      else if (v === 'team_lb') { setTeamLb(await db.getTeamLeaderboardData()); }
      else if (v === 'stats') { setPlayerStats(await db.getPlayerStats()); }
      else if (v === 'stableford' && param) { setSheetData(await db.getStablefordRoundData(param)); }
      else if (v === 'teams' && param) { setSheetData(await db.getTeamRoundData(param)); }
      setLastUpdated(new Date().toISOString());
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadView(view, viewParam); }, [view, viewParam, loadView]);

  const navigate = (v, param) => { setView(v); setViewParam(param || (v==='stableford'||v==='teams'?rounds[0]?.id:null)); };

  const handleRefresh = async () => { setRefreshing(true); await loadData(); await loadView(view, viewParam); setRefreshing(false); };

  const isAdmin = profile?.role === 'admin';
  const canEdit = profile?.role === 'admin' || profile?.role === 'approved';
  const canScore = !!user; // Any logged-in user can enter scores

  const stabItems = rounds.map(r=>({id: r.id, label: `Stableford - ${r.courses?.name||`Round ${r.round_number}`}`}));
  const teamItems = rounds.map(r=>({id: r.id, label: `Teams - ${r.courses?.name||`Round ${r.round_number}`}`}));

  return (
    <div className="min-h-screen bg-[#051A10] relative overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center" style={{backgroundImage:'url(https://images.unsplash.com/photo-1761400025076-8fec91f620f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxnb2xmJTIwY291cnNlJTIwZmFpcndheXN8ZW58MHx8fHwxNzc2MzQ1Mzg5fDA&ixlib=rb-4.1.0&q=85)'}}/>
      <div className="fixed inset-0 bg-[#051A10]/95"/>
      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#051A10]/80 border-b border-[#D4AF37]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src="https://customer-assets.emergentagent.com/job_40790795-ad45-4986-96fc-d389b274e70b/artifacts/3k0g1frp_IMG_0702.JPG" alt="Pellies GC" className="h-14 object-contain"/>
                <div><h1 className="text-2xl sm:text-3xl font-serif text-[#D4AF37] tracking-tight">Pellies Golf League 2026</h1><p className="text-xs text-[#A9C5B4] mt-0.5">Updated: {formatLastUpdated(lastUpdated)}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 rounded-lg transition-colors disabled:opacity-50">
                  <ArrowsClockwise size={18} weight="bold" className={refreshing?'animate-spin':''}/><span className="hidden sm:inline text-sm">Refresh</span>
                </button>
                {user ? (
                  <button onClick={()=>db.signOut()} className="flex items-center gap-1 px-3 py-2 text-xs text-[#A9C5B4] hover:text-red-400 transition-colors">
                    <SignOut size={16}/><span className="hidden sm:inline">{profile?.display_name||user.email.split('@')[0]}</span>
                  </button>
                ) : (
                  <button onClick={()=>setShowAuth(true)} className="flex items-center gap-1 px-3 py-2 text-sm text-[#D4AF37] hover:text-[#F1D67E] transition-colors">
                    <UserPlus size={18}/><span className="hidden sm:inline">Sign In</span>
                  </button>
                )}
              </div>
            </div>
            <nav className="mt-4 flex items-center gap-2 flex-wrap">
              <button onClick={()=>navigate('overview')} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans rounded-lg whitespace-nowrap transition-all ${view==='overview'?'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30':'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}><Gauge size={18} weight="duotone"/><span>Overview</span></button>
              <NavDropdown label="Leaderboards" icon={<Trophy size={18} weight="duotone"/>} items={[{id:'league_lb',label:'League Leaderboard'},{id:'team_lb',label:'Team Leaderboard'}]} activeId={view==='league_lb'||view==='team_lb'?view:null} onSelect={id=>navigate(id)} testId="nav-lb"/>
              {stabItems.length>0&&<NavDropdown label="Stableford" icon={<ChartLine size={18} weight="duotone"/>} items={stabItems} activeId={view==='stableford'?viewParam:null} onSelect={id=>navigate('stableford',id)} testId="nav-stab"/>}
              {teamItems.length>0&&<NavDropdown label="Team Rounds" icon={<UsersThree size={18} weight="duotone"/>} items={teamItems} activeId={view==='teams'?viewParam:null} onSelect={id=>navigate('teams',id)} testId="nav-teams"/>}
              <button onClick={()=>navigate('stats')} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans rounded-lg whitespace-nowrap transition-all ${view==='stats'?'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30':'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}><User size={18} weight="duotone"/><span>Player Stats</span></button>
              {canScore&&<button onClick={()=>navigate('score_entry')} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans rounded-lg whitespace-nowrap transition-all ${view==='score_entry'?'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30':'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`} data-testid="nav-scores"><PencilSimple size={18} weight="duotone"/><span>Scores</span></button>}
              {isAdmin&&<button onClick={()=>navigate('season_wizard')} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans rounded-lg whitespace-nowrap transition-all ${view==='season_wizard'?'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30':'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`} data-testid="nav-season-wizard"><Flag size={18} weight="duotone"/><span>Season Setup</span></button>}
              {isAdmin&&<button onClick={()=>navigate('admin')} className={`flex items-center gap-2 px-5 py-3 text-sm font-sans rounded-lg whitespace-nowrap transition-all ${view==='admin'?'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30':'text-[#A9C5B4] hover:text-white hover:bg-[#FFFFFF]/5 border border-transparent'}`}><Gear size={18} weight="duotone"/><span>Admin</span></button>}
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center justify-center py-20"><div className="text-[#D4AF37] text-lg">Loading...</div></motion.div>
            ) : view==='overview'&&overview ? (
              <Overview data={overview} onNav={navigate}/>
            ) : view==='stats'&&playerStats ? (
              <motion.div key="stats" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {playerStats.map((p,i)=><PlayerCard key={p.name} player={p} index={i}/>)}
                </div>
              </motion.div>
            ) : (view==='league_lb'||view==='team_lb')&&(leaderboard||teamLb) ? (
              <motion.div key={view} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
                <DataTable data={view==='league_lb'?leaderboard?.leaderboard:teamLb?.leaderboard}/>
              </motion.div>
            ) : (view==='stableford'||view==='teams')&&sheetData ? (
              <motion.div key={`${view}-${viewParam}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
                <DataTable data={sheetData?.data}/>
              </motion.div>
            ) : view==='score_entry' ? (
              <ScoreEntry rounds={rounds} players={players} userId={user?.id}/>
            ) : view==='season_wizard' ? (
              <SeasonWizard onComplete={()=>{ loadData(); navigate('overview'); }}/>
            ) : view==='admin' ? (
              <AdminPanel/>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>
        {showAuth&&<AuthModal onSuccess={()=>setShowAuth(false)} onClose={()=>setShowAuth(false)}/>}
      </AnimatePresence>
    </div>
  );
}

export default App;
