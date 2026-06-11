import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';
import NavDropdown from './components/navigation/NavDropdown';
import PlayerCard from './components/PlayerCard';
import Overview from './components/Overview';
import DataTable from './components/DataTable';
import AuthModal from './components/AuthModal';
import ScoreEntry from './components/ScoreEntry';

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
import { Trophy, ChartLine, ArrowsClockwise, User, Target, Flag, Fire, TrendUp, Medal, Golf, CaretDown, UsersThree, Crown, Lightning, MapPin, Users, Gauge, Star, Lock, PencilSimple, Check, X, SignOut, CloudArrowUp, DownloadSimple, Gear, UserPlus, ShieldCheck, BeerBottle, Scroll } from '@phosphor-icons/react';
import * as db from './services/supabaseService';
import AdminPanel from './components/AdminPanel';
import SeasonWizard from './components/SeasonWizard';
import Awards from './components/Awards';
import SeasonRecapModal from './components/SeasonRecap';
import GolfScorecard from './components/GolfScorecard';
import TeamScorecard from './components/TeamScorecard';
import LiveLeaderboard from './components/LiveLeaderboard';
import QuickScoreDrawer from './components/QuickScoreDrawer';
import QuickFinesDrawer from './components/QuickFinesDrawer';
import Fines from './components/Fines';
import RulesInfo from './components/RulesInfo';

const REFRESH_INTERVAL = 5 * 60 * 1000;

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://djalydmfpdfpdarocmto.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || 'sb_publishable_cpgvQJ8un2BAjnWqPyH2jw_2U1U3Kh3';

const supabase = createClient(supabaseUrl, supabaseKey);

const formatLastUpdated = (ts) => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never';
const DEFAULT_APP_TITLE = 'Pellies Golf League';

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
  // TEAM COMMENTED OUT: const [teamLb, setTeamLb] = useState(null);
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
  const [quickFinesOpen, setQuickFinesOpen] = useState(false);
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

  useEffect(() => {
    const name = currentSeason?.name?.trim();
    document.title = name || DEFAULT_APP_TITLE;
  }, [currentSeason?.name]);

  const loadView = useCallback(async (v, param) => {
    setLoading(true);
    // Safety: force-clear loading after 15s so the user is never stuck on a "Loading..." spinner
    const safety = setTimeout(() => setLoading(false), 15000);
    try {
      if (v === 'overview') { setOverview(await db.getSeasonOverview()); }
      else if (v === 'league_lb') { setLeaderboard(await db.getLeaderboardData(leaderboardMode)); }
      // TEAM COMMENTED OUT: else if (v === 'team_lb') { setTeamLb(await db.getTeamLeaderboardData(leaderboardMode)); }
      else if (v === 'stats') { setPlayerStats(await db.getPlayerStats()); }
      else if (v === 'awards') { setAwards(await db.getAwards()); }
      else if (v === 'stableford' && param) { 
        const data = await db.getStablefordRoundData(param, leaderboardMode);
        setSheetData(data); 
        setSheetDataMode(leaderboardMode);
      }
      // TEAM COMMENTED OUT: else if (v === 'teams' && param) { 
      //   const data = await db.getTeamRoundData(param, leaderboardMode);
      //   setSheetData(data); 
      //   setSheetDataMode(leaderboardMode);
      // }
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
    // TEAM COMMENTED OUT: if (v === 'stableford' || v === 'teams') {
    if (v === 'stableford') {
      setSheetData(null);
    }
    setView(v);
    setViewParam(param || null);
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
    navigate('/');
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
    // TEAM COMMENTED OUT: { id: 'team_lb', label: 'Team Leaderboard' },
    { id: 'stats', label: 'Player Stats' },
    { id: 'awards', label: 'Awards' },
    ...(canScore ? [{ id: 'score_entry', label: 'Scores' }] : []),
    ...(isAdmin ? [{ id: 'season_wizard', label: 'Season Setup' }, { id: 'admin', label: 'Admin' }] : []),
  ];

  const quickMenuItems = [
    { id: 'stats', label: 'Player Stats' },
    { id: 'awards', label: 'Awards' },
    ...(isApprovedUser ? [{ id: 'fines', label: 'Fines' }] : []),
    { id: 'rules', label: 'Rules' },
    ...(canScore ? [{ id: 'score_entry', label: 'Scores' }] : []),
    ...(isApprovedUser ? [{ id: 'season_wizard', label: 'Season Setup' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  const stabItems = useMemo(() => rounds.map(r=>({id: r.id, label: 'Individual - ' + (r.courses?.name || 'Round ' + r.round_number)})), [rounds]);
  // TEAM COMMENTED OUT: const teamItems = useMemo(() => rounds.map(r=>({id: r.id, label: 'Teams - ' + (r.courses?.name || 'Round ' + r.round_number)})), [rounds]);
  const mobilePrimaryItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'league_lb', label: 'League Leaderboard' },
    // TEAM COMMENTED OUT: { id: 'team_lb', label: 'Team Leaderboard' },
  ];
  const quickMenuActiveViews = new Set(['stats', 'awards', 'score_entry', 'season_wizard', 'admin', 'fines', 'rules']);
  const primaryNavBtnClass = (isActive) => {
    const base = 'flex items-center gap-2 px-3 py-2 text-sm font-sans rounded-lg whitespace-nowrap border transition-all ';
    if (isActive) {
      return base + 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 shadow-[0_0_0_1px_rgba(212,175,55,0.08)]';
    }
    return base + 'text-[#A9C5B4] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/15';
  };
  const utilityNavBtnClass = (isActive) => {
    const base = 'flex items-center gap-1.5 px-3 py-2 text-xs font-sans rounded-lg whitespace-nowrap border transition-all ';
    if (isActive) {
      return base + 'bg-[#D4AF37]/12 text-[#D4AF37] border-[#D4AF37]/25';
    }
    return base + 'text-[#9AB6A6] border-transparent hover:text-white hover:bg-[#FFFFFF]/5 hover:border-[#D4AF37]/10';
  };

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
          <LiveLeaderboard currentRound={viewParam} onRefresh={handleRefresh} mode={leaderboardMode} setMode={setLeaderboardMode} roundsVersion={roundsVersion} userId={user?.id} userPlayerId={profile?.player_id} allPlayers={players} />
        </motion.div>
      );
    }
    // TEAM COMMENTED OUT: if ((view === 'league_lb' || view === 'team_lb') && (leaderboard || teamLb)) {
    if (view === 'league_lb' && leaderboard) {
      // TEAM COMMENTED OUT: const isTeam = view === 'team_lb';
      // TEAM COMMENTED OUT: const title = isTeam ? 'Team Leaderboard' : 'League Leaderboard';
      const title = 'League Leaderboard';
      return (
        <motion.div key={`${view}-${roundsVersion}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">{title}</h2>
          {/* TEAM COMMENTED OUT: <DataTable data={isTeam ? teamLb?.leaderboard : leaderboard?.leaderboard}/> */}
          <DataTable data={leaderboard?.leaderboard}/>
        </motion.div>
      );
    }
    if (view === 'stableford' && sheetData && sheetDataMode === leaderboardMode) {
      return (
        <motion.div key={`${view}-${viewParam}-${leaderboardMode}-${roundsVersion}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
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
    // TEAM COMMENTED OUT: if (view === 'teams' && sheetData && sheetDataMode === leaderboardMode) {
    //   return (
    //     <motion.div key={`${view}-${viewParam}-${leaderboardMode}-${roundsVersion}`} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
    //       <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tracking-tight text-center sm:text-left">{sheetData?.display_name}</h2>
    //       <TeamScorecard 
    //         data={sheetData?.data}
    //         title={null}
    //         jokerHole={sheetData?.joker_hole}
    //         beerHole={sheetData?.beer_hole}
    //         mode={leaderboardMode}
    //         playerHandicaps={sheetData?.player_handicaps}
    //       />
    //     </motion.div>
    //   );
    // }
    if (view === 'score_entry' && canScore) return <ScoreEntry key={'score-entry-' + roundsVersion} rounds={rounds} players={players} userId={user?.id} userPlayerId={profile?.player_id} currentRoundId={viewParam || currentSeason?.current_round_id} roundsVersion={roundsVersion}/>;
    if (view === 'season_wizard') return <SeasonWizard onComplete={()=>{ loadData(); navigate('overview'); }}/>;
    if (view === 'admin') return <AdminPanel onSeasonChanged={loadData} currentUserId={user?.id} allPlayers={players}/>;
    if (view === 'fines' && isApprovedUser) return <Fines rounds={rounds} players={players} userId={user?.id} userPlayerId={profile?.player_id} currentRoundId={viewParam || currentSeason?.current_round_id} />;
    if (view === 'rules') return <RulesInfo />;
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
                <div><h1 className="text-2xl sm:text-3xl font-sans font-bold text-[#D4AF37] tracking-tight" data-testid="app-season-title">{currentSeason?.name || DEFAULT_APP_TITLE}</h1><p className="text-xs text-[#A9C5B4] mt-0.5">Updated: {formatLastUpdated(lastUpdated)}</p></div>
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
              <div className={'mt-3 rounded-lg border px-3 py-2 text-xs ' + (isPendingUser ? 'border-amber-500/30 bg-amber-900/20 text-amber-200' : 'border-red-500/30 bg-red-900/20 text-red-200')}>
                {authNotice}
              </div>
            )}
            <nav className="mt-4">
              <div className="hidden lg:flex rounded-xl border border-[#D4AF37]/20 bg-[#0A2518]/75 backdrop-blur-xl px-2 py-2 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>navigate('overview')} className={primaryNavBtnClass(view==='overview')}><Gauge size={17} weight="duotone"/><span>Overview</span></button>
                  <button onClick={()=>navigate('live')} className={primaryNavBtnClass(view==='live')}><Target size={17} weight="duotone"/><span>Live</span></button>
                  {/* TEAM COMMENTED OUT: <NavDropdown label="Leaderboards" icon={<Trophy size={17} weight="duotone"/>} items={[{id:'league_lb',label:'League Leaderboard'},{id:'team_lb',label:'Team Leaderboard'}]} activeId={view==='league_lb'||view==='team_lb'?view:null} onSelect={id=>navigate(id)} testId="nav-lb"/> */}
                  <NavDropdown label="Leaderboards" icon={<Trophy size={17} weight="duotone"/>} items={[{id:'league_lb',label:'League Leaderboard'}]} activeId={view==='league_lb'?view:null} onSelect={id=>navigate(id)} testId="nav-lb"/>
                  {stabItems.length>0&&<NavDropdown label="Individual Rounds" icon={<ChartLine size={17} weight="duotone"/>} items={stabItems} activeId={view==='stableford'?viewParam:null} onSelect={id=>navigate('stableford',id)} testId="nav-stab"/>}
                  {/* TEAM COMMENTED OUT: {teamItems.length>0&&<NavDropdown label="Teams Round" icon={<UsersThree size={17} weight="duotone"/>} items={teamItems} activeId={view==='teams'?viewParam:null} onSelect={id=>navigate('teams',id)} testId="nav-teams"/>} */}
                </div>
                <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[#D4AF37]/20">
                  {/* Mode Toggle - Desktop - only show on views that use it */}
                  {/* TEAM COMMENTED OUT: {['league_lb', 'team_lb', 'stableford', 'teams', 'live'].includes(view) && ( */}
                  {['league_lb', 'stableford', 'live'].includes(view) && (
                    <div className="flex bg-[#051A10] rounded-lg p-0.5 border border-[#D4AF37]/20">
                      <button
                        onClick={() => setLeaderboardMode('stableford')}
                        className={'px-2 py-1 text-xs rounded-md transition-all ' + (leaderboardMode === 'stableford' ? 'bg-[#D4AF37] text-[#051A10] font-semibold' : 'text-[#A9C5B4] hover:text-white')}
                        title="Stableford scoring"
                      >
                        <span className="hidden xl:inline">Stableford</span>
                        <span className="xl:hidden">SF</span>
                      </button>
                      <button
                        onClick={() => setLeaderboardMode('stroke')}
                        className={'px-2 py-1 text-xs rounded-md transition-all ' + (leaderboardMode === 'stroke' ? 'bg-[#D4AF37] text-[#051A10] font-semibold' : 'text-[#A9C5B4] hover:text-white')}
                        title="Stroke play scoring"
                      >
                        <span className="hidden xl:inline">Stroke</span>
                        <span className="xl:hidden">ST</span>
                      </button>
                    </div>
                  )}
                  {quickMenuItems.length>0&&<NavDropdown label="Manage" icon={<Gear size={15} weight="duotone"/>} items={quickMenuItems} activeId={quickMenuActiveViews.has(view)?view:null} onSelect={id=>navigate(id)} testId="nav-menu"/>}
                </div>
              </div>
              <div className="lg:hidden rounded-xl border border-[#D4AF37]/20 bg-[#0A2518]/75 backdrop-blur-xl px-2 py-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* TEAM COMMENTED OUT: <NavDropdown label="Play" icon={<Gauge size={16} weight="duotone"/>} items={[{id:'overview',label:'Overview'},{id:'live',label:'Live Leaderboard'},{id:'league_lb',label:'League Leaderboard'},{id:'team_lb',label:'Team Leaderboard'}]} activeId={['overview','live','league_lb','team_lb'].includes(view)?view:null} onSelect={id=>navigate(id)} testId="nav-mobile-primary"/> */}
                  <NavDropdown label="Play" icon={<Gauge size={16} weight="duotone"/>} items={[{id:'overview',label:'Overview'},{id:'live',label:'Live Leaderboard'},{id:'league_lb',label:'League Leaderboard'}]} activeId={['overview','live','league_lb'].includes(view)?view:null} onSelect={id=>navigate(id)} testId="nav-mobile-primary"/>
                  {quickMenuItems.length>0&&<NavDropdown label="Manage" icon={<Gear size={16} weight="duotone"/>} items={quickMenuItems} activeId={quickMenuActiveViews.has(view)?view:null} onSelect={id=>navigate(id)} testId="nav-mobile-menu"/>}
                  {stabItems.length>0&&<NavDropdown label="Individual" icon={<ChartLine size={16} weight="duotone"/>} items={stabItems} activeId={view==='stableford'?viewParam:null} onSelect={id=>navigate('stableford',id)} testId="nav-mobile-stab"/>}
                  {/* TEAM COMMENTED OUT: {teamItems.length>0&&<NavDropdown label="Teams" icon={<UsersThree size={16} weight="duotone"/>} items={teamItems} activeId={view==='teams'?viewParam:null} onSelect={id=>navigate('teams',id)} testId="nav-mobile-teams"/> */}
                </div>
                {/* Mode Toggle - Mobile - only show on views that use it */}
                {/* TEAM COMMENTED OUT: {['league_lb', 'team_lb', 'stableford', 'teams', 'live'].includes(view) && ( */}
                {['league_lb', 'stableford', 'live'].includes(view) && (
                  <div className="mt-2 pt-2 border-t border-[#D4AF37]/20 flex justify-center">
                    <div className="flex bg-[#051A10] rounded-lg p-0.5 border border-[#D4AF37]/20">
                      <button
                        onClick={() => setLeaderboardMode('stableford')}
                        className={'px-4 py-1.5 text-xs rounded-md transition-all ' + (leaderboardMode === 'stableford' ? 'bg-[#D4AF37] text-[#051A10] font-semibold' : 'text-[#A9C5B4] hover:text-white')}
                      >
                        Stableford
                      </button>
                      <button
                        onClick={() => setLeaderboardMode('stroke')}
                        className={'px-4 py-1.5 text-xs rounded-md transition-all ' + (leaderboardMode === 'stroke' ? 'bg-[#D4AF37] text-[#051A10] font-semibold' : 'text-[#A9C5B4] hover:text-white')}
                      >
                        Stroke
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </main>

        {/* Quick Score & Fines FABs - Only visible on mobile/tablet */}
        {user && (
          <div className="lg:hidden fixed bottom-6 right-6 z-50 flex flex-col gap-3">
            {/* Quick Fines FAB - Only for approved users */}
            {isApprovedUser && (
              <button
                onClick={() => setQuickFinesOpen(true)}
                className="w-14 h-14 bg-[#0F2C1D] border-2 border-[#D4AF37] text-[#D4AF37] rounded-full shadow-2xl flex items-center justify-center hover:bg-[#D4AF37] hover:text-[#051A10] active:scale-95 transition-all"
                title="Quick Fines"
              >
                <BeerBottle size={28} weight="fill" />
              </button>
            )}
            {/* Quick Score FAB - Only for users who can score */}
            {canScore && (
              <button
                onClick={() => setQuickScoreOpen(true)}
                className="w-14 h-14 bg-[#D4AF37] text-[#051A10] rounded-full shadow-2xl flex items-center justify-center hover:bg-[#F1D67E] active:scale-95 transition-all"
                title="Quick Score"
              >
                <Golf size={28} weight="fill" />
              </button>
            )}
          </div>
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
          onScoresSaved={() => {
            loadData();
            loadView(view, viewParam);
          }}
        />

        {/* Quick Fines Drawer */}
        <QuickFinesDrawer
          isOpen={quickFinesOpen}
          onClose={() => setQuickFinesOpen(false)}
          rounds={rounds}
          players={players}
          userId={user?.id}
          userPlayerId={profile?.player_id}
          currentRoundId={viewParam || currentSeason?.current_round_id}
          onFinesSaved={() => {
            loadData();
            loadView(view, viewParam);
          }}
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
