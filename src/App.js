import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, ChartLine, ArrowsClockwise, Target, Flag, Golf, Gauge,
  SignOut, Gear, UserPlus, BeerBottle,
} from '@phosphor-icons/react';

import { supabase } from './services/supabaseClient';
import * as db from './services/supabaseService';

import NavDropdown from './components/navigation/NavDropdown';
import PlayerCard from './components/PlayerCard';
import Overview from './components/Overview';
import DataTable from './components/DataTable';
import AuthModal from './components/AuthModal';
import ScoreEntry from './components/ScoreEntry';
import AdminPanel from './components/AdminPanel';
import SeasonWizard from './components/SeasonWizard';
import Awards from './components/Awards';
import SeasonRecapModal from './components/SeasonRecap';
import GolfScorecard from './components/GolfScorecard';
import LiveLeaderboard from './components/LiveLeaderboard';
import QuickScoreDrawer from './components/QuickScoreDrawer';
import QuickFinesDrawer from './components/QuickFinesDrawer';
import Fines from './components/Fines';
import RulesInfo from './components/RulesInfo';
import { PageHeader, EmptyState, LoadingState, Segmented, Banner } from './components/common';

/* -------------------------------------------------------------------------- */

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
        <EmptyState
          icon={<Flag size={26} weight="duotone" />}
          title="Something went wrong"
          message="The scorecard could not be rendered. Try refreshing the page."
        />
      );
    }
    return this.props.children;
  }
}

/* -------------------------------------------------------------------------- */

// NOTE: the Supabase client is a singleton from services/supabaseClient.
// Creating a second client here spawns a second GoTrueClient on the same
// storage key — the two race on token refresh and getSession() can come back
// empty, which pops the Sign In modal over an already-signed-in session.

const formatLastUpdated = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never';

const DEFAULT_APP_TITLE = 'Pellies Golf League';

// Views where the Stableford / Stroke toggle is meaningful
const MODE_VIEWS = ['league_lb', 'stableford', 'live'];

const QUICK_MENU_VIEWS = new Set(['stats', 'awards', 'score_entry', 'season_wizard', 'admin', 'fines', 'rules']);

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
  const [loadError, setLoadError] = useState('');
  const [leaderboardMode, setLeaderboardMode] = useState(() => {
    const saved = localStorage.getItem('leaderboardMode');
    return saved === 'stroke' || saved === 'stableford' ? saved : 'stableford';
  }); // 'stableford' | 'stroke'
  const [quickScoreOpen, setQuickScoreOpen] = useState(false);
  const [quickFinesOpen, setQuickFinesOpen] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [archivedSeasons, setArchivedSeasons] = useState([]);

  // Auth.
  // onAuthStateChange fires an INITIAL_SESSION event on subscribe, so it is the
  // single source of truth for who is signed in. getSession() is only used to
  // decide whether to show the Sign In modal, and it must not race the listener:
  // `authResolved` makes the first of the two to answer the one that wins.
  useEffect(() => {
    let cancelled = false;
    let authResolved = false;

    const applySession = (session) => {
      if (cancelled) return;
      authResolved = true;
      if (session?.user) {
        setUser(session.user);
        supabase
          .from('user_profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => { if (!cancelled) setProfile(data); })
          .catch(() => {});
        setShowAuth(false);
      } else {
        setUser(null);
        setProfile(null);
        setShowAuth(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    // getSession() resolves to { data: { session } } — destructuring it as
    // { session } (as this used to) always read undefined and forced the
    // Sign In modal open on top of a perfectly valid session.
    supabase.auth.getSession()
      .then(({ data }) => { if (!authResolved) applySession(data?.session ?? null); })
      .catch(() => { if (!authResolved) applySession(null); });

    return () => { cancelled = true; subscription.unsubscribe(); };
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
    } catch (err) { console.error(err); }
  }, []);

  // Load initial data
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const name = currentSeason?.name?.trim();
    document.title = name || DEFAULT_APP_TITLE;
  }, [currentSeason?.name]);

  // Sequence guard: the season overview takes several seconds, so a user who
  // navigates away mid-flight would otherwise have the stale request land and
  // re-assert `loading` (or stale data) over the view they are now on.
  const loadSeq = useRef(0);

  const loadView = useCallback(async (v, param) => {
    const seq = ++loadSeq.current;
    const isCurrent = () => loadSeq.current === seq;

    setLoading(true);
    setLoadError('');
    // Safety: force-clear loading after 15s so the user is never stuck on a "Loading..." spinner
    const safety = setTimeout(() => { if (isCurrent()) setLoading(false); }, 15000);
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
      if (isCurrent()) setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error(err);
      if (isCurrent()) setLoadError(err?.message || 'Could not load this view.');
    }
    finally {
      clearTimeout(safety);
      if (isCurrent()) setLoading(false);
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
    navigate('overview');
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

  const quickMenuItems = [
    { id: 'stats', label: 'Player Stats' },
    { id: 'awards', label: 'Awards' },
    ...(isApprovedUser ? [{ id: 'fines', label: 'Fines' }] : []),
    { id: 'rules', label: 'Rules' },
    ...(canScore ? [{ id: 'score_entry', label: 'Scores' }] : []),
    ...(isApprovedUser ? [{ id: 'season_wizard', label: 'Season Setup' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  // Round labels carry the round number so repeat visits to the same course
  // are distinguishable — several rounds share "Pebble Rock".
  const stabItems = useMemo(
    () => rounds.map(r => ({
      id: r.id,
      label: `R${r.round_number} · ${r.courses?.name || 'Round ' + r.round_number}`,
    })),
    [rounds]
  );
  // TEAM COMMENTED OUT: const teamItems = useMemo(() => rounds.map(r=>({id: r.id, label: 'Teams - ' + (r.courses?.name || 'Round ' + r.round_number)})), [rounds]);

  useEffect(() => {
    if (view === 'score_entry' && !canScore) setView('overview');
    if ((view === 'admin' || view === 'season_wizard') && !isAdmin) setView('overview');
  }, [view, canScore, isAdmin]);

  /* ---- content ------------------------------------------------------- */
  // Every branch returns a real element. Returning bare `null` from inside
  // <AnimatePresence mode="wait"> leaves the outgoing child stuck mid-exit
  // (opacity 0, never unmounted) and the view never appears.
  const renderContent = () => {
    if (loadError) {
      return (
        <EmptyState
          icon={<Flag size={26} weight="duotone" />}
          title="Couldn’t load that"
          message={loadError}
        />
      );
    }

    if (view === 'overview') {
      if (!overview) return <EmptyState icon={<Gauge size={26} weight="duotone" />} title="No season data yet" message="Set up rounds and log some scores to see the season overview." />;
      return <Overview data={overview} onNav={navigate} archivedSeasons={archivedSeasons} onShareRecap={setRecapSeason} />;
    }

    if (view === 'stats') {
      if (!playerStats || playerStats.length === 0) {
        return (
          <EmptyState
            icon={<Flag size={26} weight="duotone" />}
            title="No stats yet"
            message="No players have started scoring rounds yet. Stats appear once rounds are played."
          />
        );
      }
      return (
        <div>
          <PageHeader eyebrow="Season" title="Player Stats" lede={`${playerStats.length} players ranked by total points`} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {playerStats.map((p, i) => <PlayerCard key={p.name} player={p} index={i} />)}
          </div>
        </div>
      );
    }

    if (view === 'awards') {
      if (!awards) return <EmptyState icon={<Trophy size={26} weight="duotone" />} title="No awards yet" message="Awards unlock once rounds are played." />;
      return <Awards awards={awards} />;
    }

    if (view === 'live') {
      return (
        <LiveLeaderboard
          currentRound={viewParam}
          onRefresh={handleRefresh}
          mode={leaderboardMode}
          setMode={setLeaderboardMode}
          roundsVersion={roundsVersion}
          userId={user?.id}
          userPlayerId={profile?.player_id}
          allPlayers={players}
        />
      );
    }

    // TEAM COMMENTED OUT: if ((view === 'league_lb' || view === 'team_lb') && (leaderboard || teamLb)) {
    if (view === 'league_lb') {
      if (!leaderboard) return <EmptyState icon={<Trophy size={26} weight="duotone" />} title="No leaderboard yet" message="Scores will appear here once rounds are played." />;
      return (
        <div>
          <PageHeader
            eyebrow="Standings"
            title="League Leaderboard"
            lede={leaderboardMode === 'stroke'
              ? 'Average net strokes across each player’s best 12 rounds'
              : 'Total stableford points across each player’s best 12 rounds'}
          />
          {/* TEAM COMMENTED OUT: <DataTable data={isTeam ? teamLb?.leaderboard : leaderboard?.leaderboard}/> */}
          <DataTable data={leaderboard?.leaderboard} />
        </div>
      );
    }

    if (view === 'stableford') {
      if (!sheetData || sheetDataMode !== leaderboardMode) {
        return <EmptyState icon={<ChartLine size={26} weight="duotone" />} title="Pick a round" message="Choose a round from the Individual Rounds menu to see its scorecard." />;
      }
      return (
        <div>
          <PageHeader
            eyebrow="Scorecard"
            title={sheetData?.display_name}
            lede={leaderboardMode === 'stroke' ? 'Net strokes per hole' : 'Stableford points per hole'}
          />
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
        </div>
      );
    }

    // TEAM COMMENTED OUT: if (view === 'teams' && sheetData && sheetDataMode === leaderboardMode) { ... }

    if (view === 'score_entry' && canScore) {
      return (
        <ScoreEntry
          key={'score-entry-' + roundsVersion}
          rounds={rounds}
          players={players}
          userId={user?.id}
          userPlayerId={profile?.player_id}
          currentRoundId={viewParam || currentSeason?.current_round_id}
          roundsVersion={roundsVersion}
        />
      );
    }

    if (view === 'season_wizard') {
      return <SeasonWizard onComplete={() => { loadData(); navigate('overview'); }} />;
    }

    if (view === 'admin') {
      return <AdminPanel onSeasonChanged={loadData} currentUserId={user?.id} allPlayers={players} />;
    }

    if (view === 'fines' && isApprovedUser) {
      return (
        <Fines
          rounds={rounds}
          players={players}
          userId={user?.id}
          userPlayerId={profile?.player_id}
          currentRoundId={viewParam || currentSeason?.current_round_id}
        />
      );
    }

    if (view === 'rules') return <RulesInfo />;

    return (
      <EmptyState
        icon={<Golf size={26} weight="duotone" />}
        title="Nothing here"
        message="Pick a view from the navigation above."
      />
    );
  };

  // One stable key per rendered view keeps the swap unambiguous.
  // roundsVersion is deliberately NOT part of it: bumping it on every data
  // refresh would remount the whole subtree and throw away in-view state —
  // the Admin panel would jump back to its first tab after each save.
  // Components that genuinely need to re-read on a refresh take roundsVersion
  // as a prop (ScoreEntry, LiveLeaderboard) and key themselves.
  const contentKey = loading ? 'loading' : `${view}:${viewParam ?? ''}:${leaderboardMode}`;

  const modeToggle = (
    <Segmented
      ariaLabel="Scoring mode"
      size="sm"
      value={leaderboardMode}
      onChange={setLeaderboardMode}
      options={[
        { value: 'stableford', label: 'Stableford', title: 'Stableford scoring' },
        { value: 'stroke', label: 'Stroke', title: 'Stroke play scoring' },
      ]}
    />
  );

  const showModeToggle = MODE_VIEWS.includes(view);

  const navBtnClass = (isActive) =>
    [
      'flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200',
      isActive
        ? 'border-[#D4AF37]/35 bg-[#D4AF37]/14 text-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.08)]'
        : 'border-transparent text-[#A9C5B4] hover:border-[#D4AF37]/18 hover:bg-white/5 hover:text-white',
    ].join(' ');

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#051A10]">
      {/* Backdrop: course photograph, pushed almost entirely behind a deep
          green wash plus a vignette so content always reads cleanly. */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1761400025076-8fec91f620f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxnb2xmJTIwY291cnNlJTIwZmFpcndheXN8ZW58MHx8fHwxNzc2MzQ1Mzg5fDA&ixlib=rb-4.1.0&q=85)' }}
      />
      <div className="fixed inset-0 bg-[#051A10]/94" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(212,175,55,0.07) 0%, transparent 55%), radial-gradient(100% 70% at 50% 110%, rgba(0,0,0,0.6) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-[#D4AF37]/16 bg-[#051A10]/82 backdrop-blur-2xl">
          {/* Gold hairline under the header */}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.45), transparent)' }}
          />
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-[#051A10] shadow-[0_0_0_1px_rgba(212,175,55,0.08),0_8px_20px_-10px_rgba(0,0,0,0.9)] sm:h-14 sm:w-14">
                  <img src="/favicon.svg" alt="Pellies BC" className="h-[84px] w-[84px] object-contain sm:h-[96px] sm:w-[96px]" />
                </div>
                <div className="min-w-0">
                  <h1
                    className="pg-display pg-gold-text truncate text-[22px] leading-tight sm:text-[28px]"
                    data-testid="app-season-title"
                  >
                    {currentSeason?.name || DEFAULT_APP_TITLE}
                  </h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#A9C5B4]/80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                    Updated {formatLastUpdated(lastUpdated)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="pg-btn pg-btn-secondary pg-btn-sm"
                  title="Refresh data"
                >
                  <ArrowsClockwise size={16} weight="bold" className={refreshing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    data-testid="sign-out-button"
                    title="Sign out"
                  >
                    <SignOut size={15} />
                    <span className="hidden max-w-[120px] truncate sm:inline">
                      {profile?.display_name || user.email.split('@')[0]}{isPendingUser ? ' (pending)' : ''}
                    </span>
                  </button>
                ) : (
                  <button onClick={() => setShowAuth(true)} className="pg-btn pg-btn-secondary pg-btn-sm">
                    <UserPlus size={16} />
                    <span className="hidden sm:inline">Sign In</span>
                  </button>
                )}
              </div>
            </div>

            {authNotice && (
              <Banner tone={isPendingUser ? 'warning' : 'error'} className="mt-3">
                {authNotice}
              </Banner>
            )}

            <nav className="mt-3.5">
              {/* Desktop */}
              <div className="hidden items-center justify-between gap-2 rounded-2xl border border-[#D4AF37]/18 bg-[#0A2518]/70 px-2 py-2 backdrop-blur-xl lg:flex">
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate('overview')} className={navBtnClass(view === 'overview')} data-testid="nav-overview">
                    <Gauge size={16} weight="duotone" /><span>Overview</span>
                  </button>
                  <button onClick={() => navigate('live')} className={navBtnClass(view === 'live')} data-testid="nav-live">
                    <Target size={16} weight="duotone" /><span>Live</span>
                  </button>
                  {/* TEAM COMMENTED OUT: Leaderboards dropdown also had Team Leaderboard */}
                  <NavDropdown
                    label="Leaderboards"
                    icon={<Trophy size={16} weight="duotone" />}
                    items={[{ id: 'league_lb', label: 'League Leaderboard' }]}
                    activeId={view === 'league_lb' ? view : null}
                    onSelect={id => navigate(id)}
                    testId="nav-lb"
                  />
                  {stabItems.length > 0 && (
                    <NavDropdown
                      label="Individual Rounds"
                      icon={<ChartLine size={16} weight="duotone" />}
                      items={stabItems}
                      activeId={view === 'stableford' ? viewParam : null}
                      onSelect={id => navigate('stableford', id)}
                      testId="nav-stab"
                    />
                  )}
                  {/* TEAM COMMENTED OUT: Teams Round dropdown */}
                </div>

                <div className="ml-1 flex items-center gap-2 border-l border-[#D4AF37]/18 pl-2">
                  {showModeToggle && modeToggle}
                  {quickMenuItems.length > 0 && (
                    <NavDropdown
                      label="Manage"
                      icon={<Gear size={15} weight="duotone" />}
                      items={quickMenuItems}
                      activeId={QUICK_MENU_VIEWS.has(view) ? view : null}
                      onSelect={id => navigate(id)}
                      testId="nav-menu"
                      align="right"
                    />
                  )}
                </div>
              </div>

              {/* Mobile / tablet */}
              <div className="rounded-2xl border border-[#D4AF37]/18 bg-[#0A2518]/70 p-2 backdrop-blur-xl lg:hidden">
                <div className="grid grid-cols-2 gap-2">
                  {/* TEAM COMMENTED OUT: Play menu also had Team Leaderboard */}
                  <NavDropdown
                    label="Play"
                    icon={<Gauge size={15} weight="duotone" />}
                    items={[
                      { id: 'overview', label: 'Overview' },
                      { id: 'live', label: 'Live Leaderboard' },
                      { id: 'league_lb', label: 'League Leaderboard' },
                    ]}
                    activeId={['overview', 'live', 'league_lb'].includes(view) ? view : null}
                    onSelect={id => navigate(id)}
                    testId="nav-mobile-primary"
                  />
                  {quickMenuItems.length > 0 && (
                    <NavDropdown
                      label="Manage"
                      icon={<Gear size={15} weight="duotone" />}
                      items={quickMenuItems}
                      activeId={QUICK_MENU_VIEWS.has(view) ? view : null}
                      onSelect={id => navigate(id)}
                      testId="nav-mobile-menu"
                      align="right"
                    />
                  )}
                  {stabItems.length > 0 && (
                    /* Third item spans both columns so the 2-col grid doesn't
                       leave a lopsided empty cell on phones. */
                    <div className="col-span-2">
                      <NavDropdown
                        label="Individual Rounds"
                        icon={<ChartLine size={15} weight="duotone" />}
                        items={stabItems}
                        activeId={view === 'stableford' ? viewParam : null}
                        onSelect={id => navigate('stableford', id)}
                        testId="nav-mobile-stab"
                      />
                    </div>
                  )}
                  {/* TEAM COMMENTED OUT: Teams dropdown */}
                </div>

                {showModeToggle && (
                  <div className="mt-2 flex justify-center border-t border-[#D4AF37]/14 pt-2">{modeToggle}</div>
                )}
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          {/* Deliberately NOT wrapped in <AnimatePresence mode="wait">.
              Under React 19 + framer-motion 12 the exit callback does not
              always fire here, and with mode="wait" a stalled exit blocks the
              incoming view forever (the screen stays on "Loading…"). Keying
              the element makes React swap it outright; the enter animation
              still plays, we just don't wait on an exit. */}
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {loading ? <LoadingState label="Loading…" /> : renderContent()}
          </motion.div>
        </main>

        {/* Quick Score & Fines FABs - Only visible on mobile/tablet */}
        {user && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 lg:hidden">
            {isApprovedUser && (
              <button
                onClick={() => setQuickFinesOpen(true)}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4AF37] bg-[#0F2C1D] text-[#D4AF37] shadow-2xl transition-all active:scale-95 hover:bg-[#D4AF37] hover:text-[#051A10]"
                title="Quick Fines"
                aria-label="Quick Fines"
              >
                <BeerBottle size={26} weight="fill" />
              </button>
            )}
            {canScore && (
              <button
                onClick={() => setQuickScoreOpen(true)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-[#F1D67E] to-[#D4AF37] text-[#051A10] shadow-[0_10px_30px_-8px_rgba(212,175,55,0.65)] transition-all active:scale-95 hover:from-[#F8E6B4] hover:to-[#F1D67E]"
                title="Quick Score"
                aria-label="Quick Score"
              >
                <Golf size={26} weight="fill" />
              </button>
            )}
          </div>
        )}

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
        {showAuth && <AuthModal key="auth" onSuccess={() => setShowAuth(false)} onClose={() => setShowAuth(false)} />}
        {recapSeason && <SeasonRecapModal key="recap" season={recapSeason} onClose={() => setRecapSeason(null)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
