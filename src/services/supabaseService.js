import { supabase } from './supabaseClient';

// Safety timeout so a stalled Supabase token-refresh never hangs the UI forever.
// Returns whatever the underlying promise returns, or throws after `ms`.
function withTimeout(promise, ms = 12000, label = 'Supabase request') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// ===== AUTH =====
function getSiteUrl() {
  // Prefer explicit site URL (Vercel) env var, fall back to runtime origin
  return process.env.REACT_APP_SITE_URL || window.location.origin;
}

export async function signUp(email, password, displayName) {
  let res;
  try {
    res = await supabase.auth.signUp({
      email, password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: getSiteUrl(),
      }
    });
  } catch (err) {
    // supabase-js sometimes throws a body-stream parse error on duplicate emails
    const m = err?.message?.toLowerCase() || '';
    if (m.includes('body stream') || m.includes('already')) {
      throw new Error('That email is already registered. Try signing in instead.');
    }
    throw err;
  }
  const { data, error } = res;
  if (error) {
    const m = error.message?.toLowerCase() || '';
    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
      throw new Error('That email is already registered. Try signing in instead.');
    }
    if (m.includes('password') && m.includes('short')) {
      throw new Error('Password is too short. Please use at least 6 characters.');
    }
    if (m.includes('email') && m.includes('invalid')) {
      throw new Error('That email address doesn\'t look valid.');
    }
    throw error;
  }
  // If email confirmation is disabled and we have a session, ensure user_profiles row exists
  if (data?.session && data?.user) {
    try {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName,
        role: 'pending',
      }, { onConflict: 'id' });
    } catch (_) { /* Best-effort — DB trigger handles it if installed */ }
  }
  return data;
}

export async function signIn(email, password) {
  let data, error;
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    data = res.data;
    error = res.error;
  } catch (err) {
    // Handle network/body stream errors from Supabase auth
    const m = err?.message?.toLowerCase() || '';
    if (m.includes('body') && (m.includes('disturbed') || m.includes('locked') || m.includes('stream'))) {
      throw new Error('Connection interrupted. Please wait a moment and try again.');
    }
    throw err;
  }
  
  if (error) {
    // Friendly messages
    const m = error.message?.toLowerCase() || '';
    if (m.includes('email not confirmed') || m.includes('not confirmed')) {
      throw new Error('Your email isn\'t confirmed yet. Please check your inbox for the confirmation link, or ask an admin to approve your account.');
    }
    if (m.includes('invalid login') || m.includes('invalid credentials')) {
      throw new Error('Incorrect email or password.');
    }
    // Handle body disturbed/locked error from error response
    if (m.includes('body') && (m.includes('disturbed') || m.includes('locked'))) {
      throw new Error('Connection interrupted. Please wait a moment and try again.');
    }
    throw error;
  }
  // Enforce blocked roles immediately after authentication.
  // Supabase Auth itself does not know app-specific roles in user_profiles.
  try {
    const userId = data?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      const role = profile?.role;
      if (role === 'rejected' || role === 'removed' || role === 'disabled') {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
        throw new Error('Your account is disabled. Please contact an admin.');
      }
    }
  } catch (roleErr) {
    if (roleErr instanceof Error && roleErr.message) throw roleErr;
    throw new Error('Unable to verify account access. Please try again.');
  }
  return data;
}

export async function signOut() {
  try {
    // scope:'local' clears only this browser session — doesn't wait for server
    await supabase.auth.signOut({ scope: 'local' });
  } catch (_) {
    // ignore; we'll still clear storage below
  }
  // Hard-clear any lingering supabase tokens from localStorage
  try {
    Object.keys(window.localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.includes('supabase')) window.localStorage.removeItem(k);
    });
  } catch (_) {}
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Dedupe concurrent profile fetches to avoid supabase-js body-stream race
let _profilePromise = null;
export async function getUserProfile(existingSession = null) {
  if (_profilePromise) return _profilePromise;
  _profilePromise = (async () => {
    try {
      // Prefer session passed in from onAuthChange (avoids a stuck supabase-js internal getSession())
      let session = existingSession;
      if (!session) {
        try {
          session = await withTimeout(supabase.auth.getSession().then(r => r.data.session), 5000, 'getSession');
        } catch (_) { session = null; }
      }
      if (!session) return null;
      const query = supabase.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle();
      const { data, error } = await withTimeout(query, 10000, 'user_profiles select');
      if (error) return null;
      if (!data) {
        const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || '';
        const createQ = supabase
          .from('user_profiles')
          .upsert({ id: session.user.id, email: session.user.email, display_name: displayName, role: 'pending' }, { onConflict: 'id' })
          .select()
          .maybeSingle();
        const { data: created, error: createErr } = await withTimeout(createQ, 10000, 'user_profiles upsert');
        if (createErr) return null;
        return created;
      }
      return data;
    } catch (e) {
      console.warn('getUserProfile failed:', e.message);
      return null;
    } finally {
      setTimeout(() => { _profilePromise = null; }, 50);
    }
  })();
  return _profilePromise;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ===== PLAYERS =====
export async function getPlayers() {
  const q = supabase.from('players').select('*').eq('is_active', true).order('name');
  const { data, error } = await withTimeout(q, 12000, 'getPlayers');
  if (error) throw error;
  return data;
}

export async function getAllPlayers() {
  const q = supabase.from('players').select('*').order('name');
  const { data, error } = await withTimeout(q, 12000, 'getAllPlayers');
  if (error) throw error;
  return data;
}

export async function createPlayer(player) {
  const { data, error } = await supabase.from('players').insert(player).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id, updates) {
  const { data, error } = await supabase.from('players').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id) {
  // Hard delete the player (removes from database)
  // First remove their scores and teams
  await supabase.from('scores').delete().eq('player_id', id);
  const { error: t1 } = await supabase.from('teams').delete().eq('player1_id', id);
  if (t1) throw t1;
  const { error: t2 } = await supabase.from('teams').delete().eq('player2_id', id);
  if (t2) throw t2;
  
  // Then delete the player record
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function disablePlayer(id) {
  // Just disable without removing scores/teams
  const { error } = await supabase.from('players').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function enablePlayer(id) {
  // Enable player
  const { error } = await supabase.from('players').update({ is_active: true }).eq('id', id);
  if (error) throw error;
}

// ===== COURSES =====
export async function getCourses(includeInactive = false) {
  let q = supabase.from('courses').select('*').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await withTimeout(q, 12000, 'getCourses');
  if (error) throw error;
  return data;
}

export async function createCourse(course) {
  const { data, error } = await supabase.from('courses').insert(course).select().single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, updates) {
  const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setCourseActive(id, isActive) {
  return updateCourse(id, { is_active: isActive });
}

// ===== COURSE HOLES (v4: holes attached to course, not round) =====
export async function getCourseHoles(courseId) {
  const q = supabase.from('course_holes').select('*').eq('course_id', courseId).order('hole_number');
  const { data, error } = await withTimeout(q, 10000, 'getCourseHoles');
  if (error) throw error;
  return data;
}

export async function upsertCourseHoles(holes) {
  // Supabase-js occasionally throws "body stream already read" (TypeError)
  // when an auth token refresh races the query. The DB write usually
  // succeeds anyway — so we retry and/or verify by re-reading.
  const isStreamError = (e) => {
    const m = (e?.message || '').toLowerCase();
    return m.includes('body stream') || m.includes('already read');
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from('course_holes')
        .upsert(holes, { onConflict: 'course_id,hole_number' })
        .select();
      if (error) {
        if (isStreamError(error) && attempt < 2) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        throw error;
      }
      return data;
    } catch (e) {
      if (!isStreamError(e)) throw e;
      // Stream error: wait, then VERIFY by reading back — write may have landed
      await new Promise(r => setTimeout(r, 500));
      try {
        const courseId = holes[0]?.course_id;
        if (courseId) {
          const { data: verify } = await supabase
            .from('course_holes')
            .select('hole_number, par, stroke_index')
            .eq('course_id', courseId)
            .order('hole_number');
          if (verify && verify.length >= holes.length) {
            const wrote = holes.every(h => {
              const v = verify.find(x => x.hole_number === h.hole_number);
              return v && v.par === h.par && v.stroke_index === h.stroke_index;
            });
            if (wrote) return verify; // save actually succeeded
          }
        }
      } catch (_) { /* verification failed, fall through to retry */ }
      if (attempt === 2) throw e;
    }
  }
  throw new Error('Failed to save holes after 3 attempts. Please refresh and try again.');
}

// ===== ROUNDS =====
export async function getRounds() {
  const { data, error } = await supabase.from('rounds').select('*, courses(*)').order('round_number');
  if (error) throw error;
  return data;
}

export async function getSetUpRounds() {
  const q = supabase.from('rounds').select('*, courses(*)').eq('is_setup', true).order('round_number');
  const { data, error } = await withTimeout(q, 12000, 'getSetUpRounds');
  if (error) throw error;
  return data;
}

export async function getAllRounds() {
  const q = supabase.from('rounds').select('*, course_id, courses(*)').order('round_number');
  const { data, error } = await withTimeout(q, 12000, 'getAllRounds');
  if (error) throw error;
  return data;
}

export async function createRound(round) {
  const { data, error } = await supabase.from('rounds').insert(round).select().single();
  if (error) throw error;
  return data;
}

export async function updateRound(id, updates) {
  const { data, error } = await supabase.from('rounds').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRound(id) {
  // Cascade delete: fines → scores → round_holes → teams → exclusions → round
  await supabase.from('fines').delete().eq('round_id', id);
  const { error: e1 } = await supabase.from('scores').delete().eq('round_id', id);
  if (e1) throw new Error(`Failed to clear scores: ${e1.message}`);
  const { error: e2 } = await supabase.from('round_holes').delete().eq('round_id', id);
  if (e2) throw new Error(`Failed to clear holes: ${e2.message}`);
  const { error: e3 } = await supabase.from('teams').delete().eq('round_id', id);
  if (e3) throw new Error(`Failed to clear teams: ${e3.message}`);
  await supabase.from('round_exclusions').delete().eq('round_id', id);
  const { error } = await supabase.from('rounds').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete round: ${error.message}`);
}

// ===== ROUND PARTICIPANTS (v7) =====
// UI selects who played; persisted as round_exclusions (players who did NOT play).
export async function getRoundExclusions(roundId) {
  const { data, error } = await supabase.from('round_exclusions').select('player_id').eq('round_id', roundId);
  if (error) throw error;
  return (data || []).map(r => r.player_id);
}

export async function getAllRoundExclusions() {
  const { data, error } = await supabase.from('round_exclusions').select('round_id, player_id');
  if (error) throw error;
  return data || [];
}

export async function setPlayerExcluded(roundId, playerId, excluded) {
  if (excluded) {
    const { error } = await supabase.from('round_exclusions').upsert({ round_id: roundId, player_id: playerId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('round_exclusions').delete().eq('round_id', roundId).eq('player_id', playerId);
    if (error) throw error;
  }
}

export async function getRoundInclusions(roundId) {
  return getRoundParticipants(roundId);
}

export async function getAllRoundInclusions() {
  const [exclusions, players] = await Promise.all([getAllRoundExclusions(), getPlayers()]);
  if (!exclusions.length) return [];
  const activeIds = players.filter(p => p.is_active).map(p => p.id);
  const excludedByRound = {};
  for (const row of exclusions) {
    if (!excludedByRound[row.round_id]) excludedByRound[row.round_id] = new Set();
    excludedByRound[row.round_id].add(row.player_id);
  }
  const rows = [];
  for (const [roundId, excluded] of Object.entries(excludedByRound)) {
    for (const playerId of activeIds) {
      if (!excluded.has(playerId)) rows.push({ round_id: Number(roundId), player_id: playerId });
    }
  }
  return rows;
}

export async function setPlayerIncluded(roundId, playerId, included) {
  return setPlayerExcluded(roundId, playerId, !included);
}

// Who played: active players minus round_exclusions. No exclusions row = everyone active played (legacy).
export async function getRoundParticipants(roundId) {
  const players = await getPlayers();
  const activeIds = players.filter(p => p.is_active).map(p => p.id);
  const exclusions = await getRoundExclusions(roundId).catch(() => []);
  if (exclusions.length === 0) return activeIds;
  const excluded = new Set(exclusions);
  return activeIds.filter(id => !excluded.has(id));
}

function buildIncludedByRound(rounds, exclusionRows, activePlayerIds) {
  const excludedByRound = {};
  for (const row of exclusionRows || []) {
    if (!excludedByRound[row.round_id]) excludedByRound[row.round_id] = new Set();
    excludedByRound[row.round_id].add(row.player_id);
  }
  const result = {};
  for (const r of rounds) {
    const exc = excludedByRound[r.id];
    if (exc?.size) {
      result[r.id] = new Set(activePlayerIds.filter(id => !exc.has(id)));
    } else {
      result[r.id] = new Set(activePlayerIds);
    }
  }
  return result;
}

function isPlayerIncluded(includedByRound, roundId, playerId) {
  const set = includedByRound[roundId];
  return set ? set.has(playerId) : false;
}

// Admin: clear scores for a single round (keeps the round + holes + teams)
export async function clearRoundScores(roundId) {
  // Also clear fines when clearing scores
  await supabase.from('fines').delete().eq('round_id', roundId);
  const { error } = await supabase.from('scores').delete().eq('round_id', roundId);
  if (error) throw error;
}

// Admin: wipe all season data (fines + scores + teams + round_holes + rounds) — players & courses kept
// Returns counts of deleted rows so we can detect RLS-silent-failures
export async function resetSeasonData() {
  const { data: finesDel } = await supabase.from('fines').delete().not('id', 'is', null).select('id');
  const { data: scoresDel } = await supabase.from('scores').delete().not('id', 'is', null).select('id');
  const { data: teamsDel } = await supabase.from('teams').delete().not('id', 'is', null).select('id');
  const { data: holesDel } = await supabase.from('round_holes').delete().not('id', 'is', null).select('id');
  const { data: roundsDel, error } = await supabase.from('rounds').delete().not('id', 'is', null).select('id');
  if (error) throw error;
  return {
    fines: finesDel?.length || 0,
    scores: scoresDel?.length || 0,
    teams: teamsDel?.length || 0,
    holes: holesDel?.length || 0,
    rounds: roundsDel?.length || 0,
  };
}

// Admin: clear ALL scores and fines across the league (keep rounds / holes / teams)
export async function clearAllScores() {
  const { data: finesDel } = await supabase.from('fines').delete().not('id', 'is', null).select('id');
  const { data: scoresDel, error } = await supabase.from('scores').delete().not('id', 'is', null).select('id');
  if (error) throw error;
  return {
    fines: finesDel?.length || 0,
    scores: scoresDel?.length || 0,
  };
}

// ===== ROUND HOLES =====
export async function getRoundHoles(roundId) {
  const { data, error } = await supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number');
  if (error) throw error;
  return data;
}

// v5: Score Entry / any per-round consumer should use this — pulls from course_holes
// (the source of truth) with round_holes as a legacy fallback.
export async function getHolesForRound(roundId) {
  const { data: round, error: rErr } = await supabase.from('rounds').select('id, course_id').eq('id', roundId).maybeSingle();
  if (rErr) throw rErr;
  if (round?.course_id) {
    const { data: ch } = await supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number');
    if (ch && ch.length > 0) return ch;
  }
  const { data: rh, error } = await supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number');
  if (error) throw error;
  return rh || [];
}

export async function upsertRoundHoles(holes) {
  const { data, error } = await supabase.from('round_holes').upsert(holes, { onConflict: 'round_id,hole_number' }).select();
  if (error) throw error;
  return data;
}

// ===== SCORES =====
export async function getScoresForRound(roundId) {
  const { data, error } = await supabase.from('scores').select('*, players(name)').eq('round_id', roundId).order('hole_number');
  if (error) throw error;
  return data;
}

export async function upsertScores(scores) {
  // Check if round is closed first
  const roundId = scores[0]?.round_id;
  if (roundId) {
    const { data: round, error: roundError } = await supabase.from('rounds').select('is_closed').eq('id', roundId).single();
    if (roundError) throw roundError;
    if (round?.is_closed) throw new Error('This round is closed. No scores can be added or changed.');
  }
  
  try {
    const { data, error } = await withTimeout(
      supabase.from('scores').upsert(scores, { onConflict: 'round_id,player_id,hole_number' }).select(),
      15000,
      'upsertScores'
    );
    if (error) throw error;
    return data;
  } catch (err) {
    // Handle lock conflict specifically
    if (err?.message?.includes('Lock broken') || err?.message?.includes('steal')) {
      throw new Error('Another save is in progress. Please wait a moment and try again.');
    }
    throw err;
  }
}

// ===== TEAMS =====
// v5: Teams are now season-wide by default (round_id IS NULL).
// Per-round teams (round_id set) are still supported for legacy data and
// for leagues that want different pairings per round — they override
// the season-wide teams for that specific round.

export async function getTeamsForRound(roundId) {
  // Prefer round-specific teams; fall back to season teams (round_id null)
  const { data: specific, error: e1 } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)')
    .eq('round_id', roundId);
  if (e1) throw e1;
  if (specific && specific.length > 0) return specific;
  const { data: season, error: e2 } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)')
    .is('round_id', null);
  if (e2) throw e2;
  return season || [];
}

// Get season-wide teams (round_id null)
export async function getSeasonTeams() {
  const { data, error } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)')
    .is('round_id', null)
    .order('id');
  if (error) throw error;
  return data || [];
}

// Admin view: every team row (both season-wide and any legacy per-round)
export async function getAllTeams() {
  const { data, error } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name), rounds(round_number, courses(name))')
    .order('round_id', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

export async function createTeam(team) {
  // If no round_id supplied, create as season-wide team (round_id null)
  const payload = { ...team, round_id: team.round_id ?? null };
  const { data, error } = await supabase.from('teams').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteTeamsByPlayer(playerId) {
  const { error } = await supabase.from('teams').delete().or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  if (error) throw error;
}

// Remove all teams (both season-wide and per-round) — used by Danger Zone / Season Wizard
export async function clearAllTeams() {
  const { error } = await supabase.from('teams').delete().neq('id', 0);
  if (error) throw error;
}

// ===== USER MANAGEMENT =====
export async function getAllUsers() {
  const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateUserRole(userId, role) {
  const { data, error } = await supabase.from('user_profiles').update({ role }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function updateUserPlayerLink(userId, playerId) {
  const { data, error } = await supabase.from('user_profiles').update({ player_id: playerId }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

// Remove user: delete from user_profiles table (we can't delete from auth.users with anon key — admin must do that separately in Supabase dashboard).
export async function removeUser(userId) {
  const { error } = await supabase.from('user_profiles').delete().eq('id', userId);
  if (error) throw error;
}

// ===== STABLEFORD CALCULATION =====
// Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
function calcCourseHandicap(handicapIndex, slopeRating, courseRating, par) {
  if (!handicapIndex || !slopeRating) return 0;
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - par));
}

// Stableford points: based on net score (strokes - handicap strokes on that hole)
// Handicap strokes distributed by stroke index
function calcStablefordPoints(strokes, par, handicapStrokes) {
  const netScore = strokes - handicapStrokes;
  return Math.max(0, 2 + (par - netScore));
}

function applyJoker(points, holeNumber, jokerHole) {
  if (jokerHole && holeNumber === jokerHole) {
    return points * 2;
  }
  return points;
}

function distributeHandicapStrokes(courseHandicap, holes) {
  const strokesPerHole = {};
  // Guard: if no holes configured, return empty map (prevents infinite loop)
  if (!holes || holes.length === 0 || !courseHandicap) {
    for (const h of holes || []) strokesPerHole[h.hole_number] = 0;
    return strokesPerHole;
  }
  const sortedBySI = [...holes].sort((a, b) => (a.stroke_index || 99) - (b.stroke_index || 99));

  let remaining = Math.abs(courseHandicap);
  const isPlus = courseHandicap < 0; // Plus handicap (gives back strokes)

  for (const hole of sortedBySI) {
    strokesPerHole[hole.hole_number] = 0;
  }

  let pass = 0;
  const MAX_PASSES = 10; // Safety guard (10 strokes per hole is already extreme)
  while (remaining > 0 && pass < MAX_PASSES) {
    for (const hole of sortedBySI) {
      if (remaining <= 0) break;
      strokesPerHole[hole.hole_number] += 1;
      remaining--;
    }
    pass++;
  }

  if (isPlus) {
    for (const k of Object.keys(strokesPerHole)) {
      strokesPerHole[k] = -strokesPerHole[k];
    }
  }

  return strokesPerHole;
}

// ===== COMPUTED DATA =====

// Assigns ranks handling ties — 1, T2, T2, 4, 5, T6, T6, 8 style
function assignTiedRanks(rows, totalKey = 'total') {
  rows.forEach((row, i) => {
    if (i > 0 && row[totalKey] === rows[i - 1][totalKey]) {
      row.rank = rows[i - 1].rank; // share same numeric rank
    } else {
      row.rank = i + 1;
    }
  });
  // Mark ties with "T" prefix for display
  const counts = {};
  rows.forEach(r => { counts[r.rank] = (counts[r.rank] || 0) + 1; });
  rows.forEach(r => { r.rank_display = counts[r.rank] > 1 ? `T${r.rank}` : String(r.rank); });
}

// Reorders each row so `rank` appears as the first column (for table display)
function withRankFirst(rows) {
  return rows.map(r => {
    const { rank, rank_display, ...rest } = r;
    return { rank, ...rest, rank_display };
  });
}

// Builds holesMap and roundHolesMap indexed by round_id using course_holes (v4)
// with round_holes as legacy fallback. Each round uses its course's holes.
async function fetchHolesForRounds(rounds) {
  const courseIds = [...new Set(rounds.map(r => r.course_id).filter(Boolean))];
  const [courseHolesRes, roundHolesRes] = await Promise.all([
    courseIds.length > 0
      ? withTimeout(supabase.from('course_holes').select('course_id, hole_number, par, stroke_index').in('course_id', courseIds), 15000, 'course_holes')
      : Promise.resolve({ data: [] }),
    withTimeout(supabase.from('round_holes').select('round_id, hole_number, par, stroke_index'), 15000, 'round_holes'),
  ]);
  const courseHolesByCourse = {};
  for (const h of courseHolesRes.data || []) {
    if (!courseHolesByCourse[h.course_id]) courseHolesByCourse[h.course_id] = [];
    courseHolesByCourse[h.course_id].push(h);
  }
  const holesMap = {};
  const roundHolesMap = {};
  for (const r of rounds) {
    let holes = courseHolesByCourse[r.course_id];
    if (!holes || holes.length === 0) {
      // Fallback: legacy per-round holes
      holes = (roundHolesRes.data || []).filter(h => h.round_id === r.id);
    }
    roundHolesMap[r.id] = holes;
    for (const h of holes) {
      holesMap[`${r.id}_${h.hole_number}`] = { ...h, round_id: r.id };
    }
  }
  return { holesMap, roundHolesMap };
}

export async function getLeaderboardData(mode = 'stableford') {
  // Fetch all scores with pagination to handle more than 1000 rows
  const allScores = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await withTimeout(
      supabase.from('scores').select('round_id, player_id, hole_number, strokes').range(from, from + pageSize - 1),
      15000,
      'scores'
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allScores.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const [rounds, players, exclusionsRes] = await Promise.all([
    getAllRounds(),
    getPlayers(),
    withTimeout(supabase.from('round_exclusions').select('round_id, player_id'), 10000, 'exclusions-lb'),
  ]);
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);

  // Filter rounds to only include those with valid course data and holes
  const validRounds = rounds.filter(r => r.courses && r.course_id && (roundHolesMap[r.id]?.length > 0));

  const activePlayers = players.filter(p => p.is_active);
  const activePlayerIds = activePlayers.map(p => p.id);
  const includedByRound = buildIncludedByRound(validRounds, exclusionsRes.data || [], activePlayerIds);

  const playerRoundTotals = {};
  for (const p of activePlayers) {
    playerRoundTotals[p.id] = {};
    for (const r of validRounds) {
      if (!isPlayerIncluded(includedByRound, r.id, p.id)) continue;

      const courseHandicap = calcCourseHandicap(p.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
      const holes = roundHolesMap[r.id] || [];
      const handicapStrokes = distributeHandicapStrokes(courseHandicap, holes);

      const pScores = (allScores || []).filter(s => s.player_id === p.id && s.round_id === r.id);
      const totalHoles = holes.length;
      const uniqueHolesScored = new Set(pScores.map(s => s.hole_number)).size;

      // Only count this round if the player has scored at least one hole
      if (uniqueHolesScored === 0) continue;

      if (mode === 'stroke') {
        // Stroke Play: sum of strokes, with handicap adjustment on ALL rounds
        let grossStrokes = 0;
        let netStrokes = 0;
        for (const s of pScores) {
          grossStrokes += s.strokes || 0;
          // Apply handicap strokes on ALL rounds
          const hcStrokes = handicapStrokes[s.hole_number] || 0;
          netStrokes += Math.max(0, (s.strokes || 0) - hcStrokes);
        }
        // Store net strokes for total, show gross (net) in details for all rounds
        playerRoundTotals[p.id][r.id] = {
          net: netStrokes,
          gross: grossStrokes,
          display: `${grossStrokes} (${netStrokes})`
        };
      } else {
        // Stableford (default)
        let roundTotal = 0;
        for (const s of pScores) {
          const hole = holesMap[`${s.round_id}_${s.hole_number}`];
          if (!hole) continue;
          const hcStrokes = handicapStrokes[s.hole_number] || 0;
          let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes);
          // 🎭 Joker Hole: double points on the admin-designated hole for this round
          pts = applyJoker(pts, s.hole_number, r.joker_hole);
          roundTotal += pts;
        }
        playerRoundTotals[p.id][r.id] = { net: roundTotal, gross: roundTotal, display: roundTotal };
      }
    }
  }

  const leaderboard = activePlayers.map(p => {
    const roundScores = playerRoundTotals[p.id] || {};
    const roundScoresArray = Object.values(roundScores);
    const total = roundScoresArray.reduce((a, b) => a + b.net, 0);
    const roundsPlayed = roundScoresArray.length;
    const average = roundsPlayed > 0 ? total / roundsPlayed : 0;
    const hasScores = roundsPlayed > 0;
    const roundDetails = {};
    for (const r of rounds) {
      const score = roundScores[r.id];
      const key = `R${r.round_number} ${r.courses?.name || 'Unknown'}`;
      roundDetails[key] = score ? score.display : '-';
      // Add display name for header (without round number)
      roundDetails[`_display_${key}`] = r.courses?.name || 'Unknown';
    }
    // Return only fields needed for display (exclude internal sorting fields)
    return { player: p.name, ...roundDetails, total, _average: average, _hasScores: hasScores };
  });

  // Sort by average per round (both modes)
  // Stroke play: lower average is better
  // Stableford: higher average is better
  leaderboard.sort((a, b) => {
    // Players with scores come first
    if (a._hasScores && !b._hasScores) return -1;
    if (!a._hasScores && b._hasScores) return 1;
    // Both have scores: sort by average
    if (a._hasScores && b._hasScores) {
      if (mode === 'stroke') {
        return a._average - b._average; // Lower is better for stroke play
      } else {
        return b._average - a._average; // Higher is better for Stableford
      }
    }
    // Neither has scores: maintain original order
    return 0;
  });
  // Remove internal sorting fields from final output
  leaderboard.forEach(row => {
    delete row._average;
    delete row._hasScores;
  });
  assignTiedRanks(leaderboard, 'total');
  return { leaderboard: withRankFirst(leaderboard), rounds };
}

export async function getTeamLeaderboardData(mode = 'stableford') {
  // Fetch all scores with pagination to handle more than 1000 rows
  const allScores = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await withTimeout(
      supabase.from('scores').select('round_id, player_id, hole_number, strokes').range(from, from + pageSize - 1),
      15000,
      'scores-team'
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allScores.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const [rounds, players, teamsRes, exclusionsRes] = await Promise.all([
    getAllRounds(),
    getPlayers(),
    withTimeout(supabase.from('teams')
      .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)'), 15000, 'teams'),
    withTimeout(supabase.from('round_exclusions').select('round_id, player_id'), 10000, 'exclusions-team'),
  ]);
  const allTeams = teamsRes.data;
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);

  // Filter rounds to only include those with valid course data and holes
  const validRounds = rounds.filter(r => r.courses && r.course_id && (roundHolesMap[r.id]?.length > 0));

  const activePlayers = players.filter(p => p.is_active);
  const activePlayerIds = activePlayers.map(p => p.id);
  const includedByRound = buildIncludedByRound(validRounds, exclusionsRes.data || [], activePlayerIds);

  const playerMap = {};
  for (const p of activePlayers) playerMap[p.id] = p;

  const strokeMap = {}; // For stroke play: stores gross strokes per player per hole
  const stabMap = {}; // For stableford: stores points per player per hole
  const hcCache = {}; // key: roundId_playerId

  const roundMap = Object.fromEntries(validRounds.map(r => [r.id, r]));

  for (const s of allScores || []) {
    const hole = holesMap[`${s.round_id}_${s.hole_number}`];
    if (!hole) continue;

    const player = playerMap[s.player_id];
    if (!player) continue;

    const round = roundMap[s.round_id];
    if (!round) continue;

    const cacheKey = `${s.round_id}_${s.player_id}`;

    if (!hcCache[cacheKey]) {
      const ch = calcCourseHandicap(
        player.handicap,
        round.courses?.slope,
        round.courses?.rating,
        round.courses?.par
      );
      const holes = roundHolesMap[s.round_id] || [];
      hcCache[cacheKey] = distributeHandicapStrokes(ch, holes);
    }

    const hcStrokes = hcCache[cacheKey];
    const grossStrokes = s.strokes || 0;
    const hcStroke = hcStrokes[s.hole_number] || 0;
    const netStrokes = Math.max(0, grossStrokes - hcStroke);
    
    // Store for stroke play
    strokeMap[`${s.round_id}_${s.player_id}_${s.hole_number}`] = { gross: grossStrokes, net: netStrokes };
    
    // Store for stableford
    let pts = calcStablefordPoints(grossStrokes, hole.par, hcStrokes[s.hole_number] || 0);
    // 🎭 Joker Hole doubles points (team leaderboard uses same hole-level points)
    if (round.joker_hole && s.hole_number === round.joker_hole) pts *= 2;
    stabMap[`${s.round_id}_${s.player_id}_${s.hole_number}`] = pts;
  }

  // v5: Season-wide teams (round_id null) apply to ALL rounds,
  // unless a round has its own specific team(s) — which override season teams for that round.
  const seasonTeams = (allTeams || []).filter(t => t.round_id == null);
  const perRoundTeams = (allTeams || []).filter(t => t.round_id != null);
  const roundsWithSpecific = new Set(perRoundTeams.map(t => t.round_id));

  const teamPairsMap = {};
  // Key teams by the player-pair (order-independent) so same pairing across rounds shares a leaderboard row
  const addTeam = (t, roundId) => {
    const key = [t.player1?.id, t.player2?.id].sort().join('_');
    if (!teamPairsMap[key]) teamPairsMap[key] = { name: `${t.player1?.name} and ${t.player2?.name}`, p1Id: t.player1?.id, p2Id: t.player2?.id, roundIds: new Set() };
    teamPairsMap[key].roundIds.add(roundId);
  };
  for (const r of validRounds) {
    if (roundsWithSpecific.has(r.id)) {
      for (const t of perRoundTeams.filter(x => x.round_id === r.id)) addTeam(t, r.id);
    } else {
      for (const t of seasonTeams) addTeam(t, r.id);
    }
  }

  const teamLeaderboard = Object.values(teamPairsMap).map(team => {
    const roundScores = {};
    let totalNet = 0;
    let totalGross = 0;
    let roundsPlayed = 0;
    for (const r of validRounds) {
      if (!team.roundIds.has(r.id)) { 
        roundScores[r.courses?.name || `R${r.round_number}`] = '-';
        continue; 
      }
      const holes = roundHolesMap[r.id] || [];

      const p1Included = isPlayerIncluded(includedByRound, r.id, team.p1Id);
      const p2Included = isPlayerIncluded(includedByRound, r.id, team.p2Id);

      const p1HolesScored = p1Included ? holes.filter(h => strokeMap[`${r.id}_${team.p1Id}_${h.hole_number}`] || stabMap[`${r.id}_${team.p1Id}_${h.hole_number}`]).length : 0;
      const p2HolesScored = p2Included ? holes.filter(h => strokeMap[`${r.id}_${team.p2Id}_${h.hole_number}`] || stabMap[`${r.id}_${team.p2Id}_${h.hole_number}`]).length : 0;
      
      // Only count this round if at least one included player has scored
      if (p1HolesScored === 0 && p2HolesScored === 0) {
        roundScores[r.courses?.name || `R${r.round_number}`] = '-';
        continue;
      }

      let roundNet = 0;
      let roundGross = 0;
      for (const h of holes) {
        const p1key = `${r.id}_${team.p1Id}_${h.hole_number}`;
        const p2key = `${r.id}_${team.p2Id}_${h.hole_number}`;

        if (mode === 'stroke') {
          const p1 = p1Included ? strokeMap[p1key] : null;
          const p2 = p2Included ? strokeMap[p2key] : null;
          const p1net = p1?.net ?? 999;
          const p2net = p2?.net ?? 999;
          const p1gross = p1?.gross ?? 999;
          const p2gross = p2?.gross ?? 999;

          roundNet += Math.min(p1net, p2net);
          roundGross += Math.min(p1gross, p2gross);
        } else {
          const p1pts = p1Included ? (stabMap[p1key] || 0) : -1;
          const p2pts = p2Included ? (stabMap[p2key] || 0) : -1;
          roundNet += Math.max(p1pts, p2pts);
          roundGross += Math.max(p1pts, p2pts);
        }
      }
      
      if (mode === 'stroke') {
        // Show gross (net) for all rounds in stroke play
        const key = `R${r.round_number} ${r.courses?.name || 'Unknown'}`;
        roundScores[key] = `${roundGross} (${roundNet})`;
        // Add display name for header (without round number)
        roundScores[`_display_${key}`] = r.courses?.name || 'Unknown';
      } else {
        const key = `R${r.round_number} ${r.courses?.name || 'Unknown'}`;
        roundScores[key] = roundNet;
        // Add display name for header (without round number)
        roundScores[`_display_${key}`] = r.courses?.name || 'Unknown';
      }
      
      totalNet += roundNet;
      totalGross += roundGross;
      roundsPlayed++;
    }
    // Return only fields needed for display
    return { 
      player: team.name, 
      ...roundScores, 
      total: totalNet
    };
  });

  if (mode === 'stroke') {
    // Stroke play: prioritize teams with scores, then by total (ascending)
    // For team stroke play, round scores are strings like "72 (65)" or "-"
    teamLeaderboard.sort((a, b) => {
      const aRoundKeys = Object.keys(a).filter(k => k !== 'player' && k !== 'total');
      const bRoundKeys = Object.keys(b).filter(k => k !== 'player' && k !== 'total');
      // Check if team has actual round scores (strings that are not '-' and contain numbers)
      const aHasScores = aRoundKeys.some(k => {
        const val = a[k];
        return val !== '-' && val !== '' && typeof val === 'string' && /\d/.test(val);
      });
      const bHasScores = bRoundKeys.some(k => {
        const val = b[k];
        return val !== '-' && val !== '' && typeof val === 'string' && /\d/.test(val);
      });
      // Teams with scores come first
      if (aHasScores && !bHasScores) return -1;
      if (!aHasScores && bHasScores) return 1;
      // Both have scores: sort by total (lower is better for stroke play)
      if (aHasScores && bHasScores) return a.total - b.total;
      // Neither has scores: maintain original order
      return 0;
    });
  } else {
    // Stableford: prioritize teams with scores, then by total (descending)
    teamLeaderboard.sort((a, b) => {
      const aRoundKeys = Object.keys(a).filter(k => k !== 'player' && k !== 'total');
      const bRoundKeys = Object.keys(b).filter(k => k !== 'player' && k !== 'total');
      const aHasScores = aRoundKeys.some(k => a[k] !== '-' && typeof a[k] === 'number');
      const bHasScores = bRoundKeys.some(k => b[k] !== '-' && typeof b[k] === 'number');
      // Teams with scores come first
      if (aHasScores && !bHasScores) return -1;
      if (!aHasScores && bHasScores) return 1;
      // Both have scores: sort by total (higher is better for stableford)
      if (aHasScores && bHasScores) return b.total - a.total;
      // Neither has scores: maintain original order
      return 0;
    });
  }
  assignTiedRanks(teamLeaderboard, 'total');
  return { leaderboard: withRankFirst(teamLeaderboard), rounds };
}

export async function getPlayerStats() {
  // Fetch all scores with pagination to handle more than 1000 rows
  const allScores = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await withTimeout(
      supabase.from('scores').select('round_id, player_id, hole_number, strokes').range(from, from + pageSize - 1),
      15000,
      'scores-stats'
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allScores.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const [players, rounds] = await Promise.all([
    getPlayers(),
    getAllRounds(),
  ]);
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);

  const roundCourseMap = {};
  for (const r of rounds) roundCourseMap[r.id] = r.courses?.name || `Round ${r.round_number}`;

  const stats = [];
  for (const p of players) {
    const pScores = (allScores || []).filter(s => s.player_id === p.id);
    if (pScores.length === 0) continue;

    const roundsPlayed = new Set(pScores.map(s => s.round_id));
    let hio = 0, albatross = 0, eagles = 0, birdies = 0, pars = 0, bogeys = 0, dblPlus = 0;
    const roundTotals = {};

    const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

    for (const s of pScores) {
      const hole = holesMap[`${s.round_id}_${s.hole_number}`];
      if (!hole) continue;

      // Calculate net score using course handicap for accurate stats
      const round = roundMap[s.round_id];
      let netStrokes = s.strokes;
      if (round) {
        const ch = calcCourseHandicap(p.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
        const holes = roundHolesMap[s.round_id] || [];
        const hcStrokes = distributeHandicapStrokes(ch, holes);
        netStrokes = s.strokes - (hcStrokes[s.hole_number] || 0);

        // Stableford points calculation
        let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
        if (round.joker_hole && s.hole_number === round.joker_hole) pts *= 2;
        if (!roundTotals[s.round_id]) roundTotals[s.round_id] = 0;
        roundTotals[s.round_id] += pts;
      }

      // Use net score vs par for accurate eagle/birdie/par/bogey stats
      const diff = netStrokes - hole.par;
      if (s.strokes === 1) hio++; // Hole in one always counts
      else if (diff <= -3) albatross++;
      else if (diff === -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) pars++;
      else if (diff === 1) bogeys++;
      else dblPlus++;
    }

    const totalPts = Object.values(roundTotals).reduce((a, b) => a + b, 0);
    const rp = roundsPlayed.size;
    const hp = pScores.length;
    const bestEntry = Object.entries(roundTotals).sort((a, b) => b[1] - a[1])[0];

    stats.push({
      name: p.name, rank: 0, total_points: totalPts, rounds_played: rp, holes_played: hp,
      avg_per_round: rp > 0 ? Math.round(totalPts / rp * 10) / 10 : 0,
      avg_per_hole: hp > 0 ? Math.round(totalPts / hp * 100) / 100 : 0,
      best_round: bestEntry ? bestEntry[1] : 0,
      best_round_name: bestEntry ? roundCourseMap[parseInt(bestEntry[0])] || '' : '',
      hole_in_ones: hio, albatross, eagles, birdies, pars, bogeys, double_bogeys_plus: dblPlus,
      round_details: Object.entries(roundTotals).map(([rid, score]) => ({
        course: roundCourseMap[parseInt(rid)] || 'Round', score
      })),
    });
  }

  stats.sort((a, b) => b.total_points - a.total_points);
  assignTiedRanks(stats, 'total_points');
  return stats;
}

// ===== FUN AWARDS =====
// Computes per-round awards grouped by round/course, plus season summaries.
export async function getAwards() {
  // Fetch all scores with pagination to handle more than 1000 rows
  const allScores = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await withTimeout(
      supabase.from('scores').select('round_id, player_id, hole_number, strokes').range(from, from + pageSize - 1),
      15000,
      'scores-awards'
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allScores.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const [players, rounds, exclusionsRes] = await Promise.all([
    getAllPlayers(),
    getAllRounds(),
    withTimeout(supabase.from('round_exclusions').select('round_id, player_id'), 10000, 'exclusions'),
  ]);

  // If no scores, return empty awards
  if (allScores.length === 0) {
    console.log('No scores found in database for awards computation');
    return {
      season_complete: false,
      rounds_complete: 0,
      total_rounds: rounds.length,
      active_players: players.filter(p => p.is_active).length,
      per_round: [],
      season: {
        wooden_spoon_leader: [],
        joker_king: [],
        beer_king: [],
        golden_round: [],
      },
    };
  }
  const activePlayerIds = players.filter(p => p.is_active).map(p => p.id);
  const activePlayerIdSet = new Set(activePlayerIds);
  const includedByRound = buildIncludedByRound(rounds, exclusionsRes.data || [], activePlayerIds);
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);
  const nameById = Object.fromEntries(players.map(p => [p.id, p.name]));

  // Per-player, per-round Stableford totals and splits
  const perPR = {};
  for (const p of players) {
    perPR[p.id] = {};
    for (const r of rounds) {
      const holes = (roundHolesMap[r.id] || []).slice().sort((a, b) => a.hole_number - b.hole_number);
      if (holes.length === 0) continue;
      const ch = calcCourseHandicap(p.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
      const hcStrokes = distributeHandicapStrokes(ch, holes);
      const pScores = allScores.filter(s => s.player_id === p.id && s.round_id === r.id);
      if (pScores.length === 0) continue;

      let total = 0, front = 0, back = 0, first3 = 0, last3 = 0;
      const totalHoles = holes.length;
      for (const s of pScores) {
        const h = holesMap[`${r.id}_${s.hole_number}`];
        if (!h) continue;
        let pts = calcStablefordPoints(s.strokes, h.par, hcStrokes[s.hole_number] || 0);
        pts = applyJoker(pts, s.hole_number, r.joker_hole);
        total += pts;
        if (s.hole_number <= 9) front += pts; else back += pts;
        if (s.hole_number <= 3) first3 += pts;
        if (s.hole_number > totalHoles - 3) last3 += pts;
      }
      perPR[p.id][r.id] = { total, front, back, first3, last3 };
    }
  }

  // ===== PER-ROUND AWARDS =====
  // For each round, compute each award winner
  const perRoundAwards = [];
  for (const r of rounds) {
    const entrants = players
      .filter(p => p.is_active && isPlayerIncluded(includedByRound, r.id, p.id))
      .map(p => ({ playerId: p.id, name: p.name, ...perPR[p.id]?.[r.id] }))
      .filter(e => e.total != null);
    if (entrants.length === 0) {
      perRoundAwards.push({
        round_id: r.id,
        round_number: r.round_number,
        course: r.courses?.name || `Round ${r.round_number}`,
        beer_hole: r.beer_hole,
        joker_hole: r.joker_hole,
        has_scores: false,
      });
      continue;
    }

    // 🥄 Wooden Spoon — worst total
    const spoon = [...entrants].sort((a, b) => a.total - b.total)[0];
    // 🧊 Freeze — biggest front→back drop (positive = collapse)
    const freeze = [...entrants].sort((a, b) => (b.front - b.back) - (a.front - a.back))[0];
    // 🔥 Heater — biggest back→front improvement
    const heater = [...entrants].sort((a, b) => (b.back - b.front) - (a.back - a.front))[0];
    // 🐢 Slow Starter — worst first 3 holes
    const slow = [...entrants].sort((a, b) => a.first3 - b.first3)[0];
    // 🎯 Clutch King — best last 3 holes
    const clutch = [...entrants].sort((a, b) => b.last3 - a.last3)[0];

    // 🍺 Beer Hole — worst strokes on the designated beer hole (everyone tied is liable)
    let beer = null;
    if (r.beer_hole) {
      const scoresOnHole = allScores.filter(s => s.round_id === r.id && s.hole_number === r.beer_hole && isPlayerIncluded(includedByRound, r.id, s.player_id) && activePlayerIdSet.has(s.player_id));
      if (scoresOnHole.length > 0) {
        const worstStrokes = Math.max(...scoresOnHole.map(s => s.strokes));
        const tied = scoresOnHole.filter(s => s.strokes === worstStrokes).map(s => nameById[s.player_id] || '?');
        beer = { names: tied, strokes: worstStrokes, tied: tied.length > 1 };
      }
    }

    // 🎭 Joker Hole — most bonus points earned (base stableford points on joker hole)
    let joker = null;
    if (r.joker_hole) {
      const holesForRound = roundHolesMap[r.id] || [];
      const hole = holesForRound.find(h => h.hole_number === r.joker_hole);
      if (hole) {
        const jokerScores = allScores.filter(s => s.round_id === r.id && s.hole_number === r.joker_hole && isPlayerIncluded(includedByRound, r.id, s.player_id) && activePlayerIdSet.has(s.player_id));
        let best = null;
        for (const s of jokerScores) {
          const player = players.find(p => p.id === s.player_id);
          if (!player) continue;
          const ch = calcCourseHandicap(player.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
          const hcMap = distributeHandicapStrokes(ch, holesForRound);
          const basePts = calcStablefordPoints(s.strokes, hole.par, hcMap[s.hole_number] || 0);
          if (!best || basePts > best.bonus) best = { name: nameById[s.player_id] || '?', bonus: basePts };
        }
        joker = best;
      }
    }

    perRoundAwards.push({
      round_id: r.id,
      round_number: r.round_number,
      course: r.courses?.name || `Round ${r.round_number}`,
      beer_hole: r.beer_hole,
      joker_hole: r.joker_hole,
      has_scores: true,
      excluded: players.filter(p => p.is_active && !isPlayerIncluded(includedByRound, r.id, p.id)).map(p => p.name),
      wooden_spoon: { player: spoon.name, points: spoon.total },
      freeze: { player: freeze.name, drop: freeze.front - freeze.back },
      heater: { player: heater.name, gain: heater.back - heater.front },
      slow_starter: { player: slow.name, points: slow.first3 },
      clutch_king: { player: clutch.name, points: clutch.last3 },
      beer_hole_winner: beer,
      joker_hole_winner: joker,
    });
  }

  // ===== SEASON SUMMARIES =====
  // Season-wide beer-hole tally: how many times each player bought drinks (ties all count)
  const beerTally = {};
  for (const r of rounds) {
    if (!r.beer_hole) continue;
    const scoresOnHole = allScores.filter(s => s.round_id === r.id && s.hole_number === r.beer_hole && isPlayerIncluded(includedByRound, r.id, s.player_id) && activePlayerIdSet.has(s.player_id));
    if (scoresOnHole.length === 0) continue;
    const worstStrokes = Math.max(...scoresOnHole.map(s => s.strokes));
    for (const s of scoresOnHole) {
      if (s.strokes === worstStrokes) beerTally[s.player_id] = (beerTally[s.player_id] || 0) + 1;
    }
  }
  const beerList = Object.entries(beerTally)
    .map(([pid, count]) => ({ player: nameById[+pid] || '?', count }))
    .sort((a, b) => b.count - a.count);

  // ===== SEASON-WIDE JOKER HOLE =====
  // Track total bonus points across ALL joker holes — "king of the joker"
  // Bonus points = points earned on joker hole (doubled points minus base points = base points)
  const jokerTotalBonus = {}; // playerId -> { totalBonus, rounds[] }
  for (const r of rounds) {
    if (!r.joker_hole) continue;
    const holesForRound = roundHolesMap[r.id] || [];
    const hole = holesForRound.find(h => h.hole_number === r.joker_hole);
    if (!hole) continue;
    const jokerScores = allScores.filter(s => s.round_id === r.id && s.hole_number === r.joker_hole && isPlayerIncluded(includedByRound, r.id, s.player_id));
    for (const s of jokerScores) {
      const player = players.find(p => p.id === s.player_id);
      if (!player) continue;
      const ch = calcCourseHandicap(player.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
      const hcMap = distributeHandicapStrokes(ch, holesForRound);
      const basePts = calcStablefordPoints(s.strokes, hole.par, hcMap[s.hole_number] || 0);
      // Bonus is the base points (since joker doubles: total = base*2, so bonus = base)
      const bonus = basePts;
      if (!jokerTotalBonus[s.player_id]) {
        jokerTotalBonus[s.player_id] = { totalBonus: 0, rounds: [] };
      }
      jokerTotalBonus[s.player_id].totalBonus += bonus;
      jokerTotalBonus[s.player_id].rounds.push({
        round: r.round_number,
        course: r.courses?.name || `R${r.round_number}`,
        hole: r.joker_hole,
        bonus: bonus
      });
    }
  }
  // Sort by total bonus and handle ties
  const jokerSorted = Object.entries(jokerTotalBonus)
    .map(([pid, d]) => ({ playerId: +pid, player: nameById[+pid] || '?', totalBonus: d.totalBonus, rounds: d.rounds }))
    .sort((a, b) => b.totalBonus - a.totalBonus);
  const jokerKing = jokerSorted.length > 0 ? jokerSorted[0].totalBonus > 0 ? jokerSorted.filter(p => p.totalBonus === jokerSorted[0].totalBonus) : [] : [];

  // ===== SEASON-WIDE BEST ROUND (Golden Round) =====
  // Track best single round performance across all rounds
  const bestRoundByPlayer = {}; // playerId -> best round total
  for (const p of players) {
    let best = null;
    for (const r of rounds) {
      const d = perPR[p.id]?.[r.id];
      if (!d) continue;
      if (!best || d.total > best.total) {
        best = { total: d.total, round: r.round_number, course: r.courses?.name || `R${r.round_number}` };
      }
    }
    if (best) {
      bestRoundByPlayer[p.id] = best;
    }
  }
  const bestRoundSorted = Object.entries(bestRoundByPlayer)
    .map(([pid, d]) => ({ playerId: +pid, player: nameById[+pid] || '?', ...d }))
    .sort((a, b) => b.total - a.total);
  const goldenRound = bestRoundSorted.length > 0 ? bestRoundSorted.filter(p => p.total === bestRoundSorted[0].total) : [];

  // ===== SEASON-WIDE WOODEN SPOON (Lowest Average) =====
  // Calculate average across only rounds where player played (excluded rounds don't count)
  const spoonAverages = {}; // playerId -> { total, count, average }
  for (const p of players) {
    let totalPoints = 0;
    let roundsPlayed = 0;
    for (const r of rounds) {
      if (!isPlayerIncluded(includedByRound, r.id, p.id)) continue;
      const d = perPR[p.id]?.[r.id];
      if (d) {
        totalPoints += d.total;
        roundsPlayed++;
      }
    }
    if (roundsPlayed > 0) {
      spoonAverages[p.id] = {
        playerId: p.id,
        player: p.name,
        total: totalPoints,
        rounds: roundsPlayed,
        average: totalPoints / roundsPlayed
      };
    }
  }
  const spoonSorted = Object.values(spoonAverages).sort((a, b) => a.average - b.average);
  const woodenSpoonWinner = spoonSorted.length > 0 ? spoonSorted.filter(p => p.average === spoonSorted[0].average) : [];

  // Season completion (only players marked as playing this round need scores)
  let roundsComplete = 0;
  for (const r of rounds) {
    const expectedCount = (includedByRound[r.id] || new Set()).size;
    const playersWithScores = new Set(
      allScores.filter(s => s.round_id === r.id && isPlayerIncluded(includedByRound, r.id, s.player_id)).map(s => s.player_id),
    );
    if (expectedCount > 0 && playersWithScores.size >= expectedCount) roundsComplete++;
  }
  const activePlayerCount = activePlayerIds.length;
  const seasonComplete = rounds.length > 0 && roundsComplete === rounds.length;

  return {
    season_complete: seasonComplete,
    rounds_complete: roundsComplete,
    total_rounds: rounds.length,
    active_players: activePlayerCount,
    per_round: perRoundAwards,
    season: {
      wooden_spoon_leader: woodenSpoonWinner,
      joker_king: jokerKing,
      beer_king: beerList.length > 0 ? beerList.filter(p => p.count === beerList[0].count && p.count > 0) : [],
      golden_round: goldenRound,
    },
  };
}

export async function getSeasonOverview() {
  // Parallelize all heavy fetches instead of awaiting sequentially (was ~20 sequential DB calls)
  const [allRounds, allPlayers, stats, lbRes, teamLbRes, scoresRes] = await Promise.all([
    getAllRounds(),
    getPlayers(),
    getPlayerStats(),
    getLeaderboardData(),
    getTeamLeaderboardData(),
    supabase.from('scores').select('player_id')
  ]);
  const { leaderboard, rounds } = lbRes;
  const { leaderboard: teamLb } = teamLbRes;
  
  // Active players = anyone with at least one score entered (not just completed rounds)
  const uniquePlayerIdsWithScores = new Set((scoresRes.data || []).map(s => s.player_id));
  const activePlayers = uniquePlayerIdsWithScores.size;
  const coursesPlayed = rounds.map(r => r.courses?.name).filter(Boolean);
  const bestRound = stats.reduce((best, s) => s.best_round > best.score ? { player: s.name, score: s.best_round, course: s.best_round_name } : best, { player: '', score: 0, course: '' });
  const eagleLeader = stats.reduce((best, s) => s.eagles > best.count ? { player: s.name, count: s.eagles } : best, { player: '', count: 0 });
  const birdieLeader = stats.reduce((best, s) => s.birdies > best.count ? { player: s.name, count: s.birdies } : best, { player: '', count: 0 });
  const hioLeader = stats.reduce((best, s) => s.hole_in_ones > best.count ? { player: s.name, count: s.hole_in_ones } : best, { player: '', count: 0 });

  const result = {
    top_players: leaderboard.slice(0, 3).map(p => ({ name: p.player, total: p.total, rank: p.rank })),
    top_team: teamLb[0] ? { name: teamLb[0].player, total: teamLb[0].total } : null,
    active_players: activePlayers, total_players: allPlayers.length,
    courses_played: coursesPlayed, total_courses: rounds.length, total_round_slots: allRounds.length,
    best_round: bestRound, eagle_leader: eagleLeader, birdie_leader: birdieLeader, hio_leader: hioLeader,
    total_holes_played: stats.reduce((a, s) => a + s.holes_played, 0),
    total_rounds_played: stats.reduce((a, s) => a + s.rounds_played, 0),
    last_updated: new Date().toISOString(),
  };
  return result;
}

// Fetch holes for a single round: course_holes first, round_holes fallback
async function holesForRound(round) {
  if (round?.course_id) {
    const { data: ch } = await supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number');
    if (ch && ch.length > 0) return ch;
  }
  const { data: rh } = await supabase.from('round_holes').select('*').eq('round_id', round.id).order('hole_number');
  return rh || [];
}

// ===== STABLEFORD/STROKE ROUND VIEW =====
export async function getStablefordRoundData(roundId, mode = 'stableford') {
  try {
    const { data: round } = await supabase.from('rounds').select('*, courses(*)').eq('id', roundId).single();
    if (!round) {
      return { name: '', display_name: '', data: [] };
    }
    
    const [holes, scoresRes, participantIds] = await Promise.all([
      holesForRound(round),
      supabase.from('scores').select('*, players(name, handicap)').eq('round_id', roundId),
      getRoundParticipants(roundId),
    ]);
    const scores = scoresRes.data || [];

    if (!holes || holes.length === 0) {
      return { name: '', display_name: '', data: [] };
    }

    const participantSet = new Set(participantIds);
    const allPlayers = await getAllPlayers();
    const activePlayerIds = new Set(allPlayers.filter(p => p.is_active).map(p => p.id));
    const activeScores = scores.filter(s => activePlayerIds.has(s.player_id) && participantSet.has(s.player_id));
    const playerNames = [...new Set(activeScores.map(s => s.players.name))];

  // Build maps for both stableford points and stroke play
  const stabMap = {};
  const strokeMap = {}; // For stroke play: stores {gross, net}
  const playerCourseHandicaps = {}; // Store course handicap per player
  
  for (const s of activeScores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    
    // Store course handicap for this player (only once per player)
    if (!playerCourseHandicaps[s.players.name]) {
      playerCourseHandicaps[s.players.name] = ch;
    }
    
    // Calculate stableford points
    let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
    if (round.joker_hole && s.hole_number === round.joker_hole) pts *= 2;
    stabMap[`${s.players.name}_${s.hole_number}`] = pts;
    
    // Calculate stroke play values (with handicap adjustment)
    const grossStrokes = s.strokes || 0;
    const hcStroke = hcStrokes[s.hole_number] || 0;
    const netStrokes = Math.max(0, grossStrokes - hcStroke);
    strokeMap[`${s.players.name}_${s.hole_number}`] = { gross: grossStrokes, net: netStrokes };
  }

  const playerTotals = {};
  playerNames.forEach(p => {
    if (mode === 'stroke') {
      // Sum of net strokes for stroke play
      playerTotals[p] = holes.reduce((sum, h) => {
        const stroke = strokeMap[`${p}_${h.hole_number}`];
        return sum + (stroke?.net || 0);
      }, 0);
    } else {
      // Sum of stableford points
      playerTotals[p] = holes.reduce((sum, h) => sum + (stabMap[`${p}_${h.hole_number}`] || 0), 0);
    }
  });
  
  // Sort players - for stroke play lower is better, for stableford higher is better
  const sortedPlayers = [...playerNames].sort((a, b) => {
    if (mode === 'stroke') {
      return (playerTotals[a] || 0) - (playerTotals[b] || 0);
    }
    return (playerTotals[b] || 0) - (playerTotals[a] || 0);
  });

  const tableData = holes.map(h => {
    const parValue = parseInt(h.par, 10) || parseInt(h.hole_par, 10) || 0;
    const row = { Hole: h.hole_number, Par: parValue, SI: h.stroke_index };
    for (const p of sortedPlayers) {
      if (mode === 'stroke') {
        const stroke = strokeMap[`${p}_${h.hole_number}`];
        // For stroke play, show only net strokes (number)
        row[p] = stroke ? stroke.net : '';
      } else {
        row[p] = stabMap[`${p}_${h.hole_number}`] ?? '';
      }
    }
    return row;
  });
  
  const totalRow = { Hole: 'TOTAL', Par: holes.reduce((s, h) => s + h.par, 0), SI: '' };
  for (const p of sortedPlayers) totalRow[p] = playerTotals[p] || 0;
  tableData.push(totalRow);

  return {
    name: mode === 'stroke' ? `Stroke_${round.round_number}` : `Stableford_${round.round_number}`,
    display_name: `${mode === 'stroke' ? 'Stroke Play' : 'Stableford'} - ${round.courses?.name || `Round ${round.round_number}`}`,
    data: tableData,
    joker_hole: round.joker_hole,
    beer_hole: round.beer_hole,
    player_handicaps: playerCourseHandicaps,
  };
  } catch (error) {
    return { name: '', display_name: '', data: [] };
  }
}

// ===== TEAM ROUND VIEW =====
export async function getTeamRoundData(roundId, mode = 'stableford') {
  const { data: round } = await supabase.from('rounds').select('*, courses(*)').eq('id', roundId).single();
  if (!round) return { name: '', display_name: '', data: [] };
  // Fetch per-round teams first; fall back to season teams if none
  const { data: specificTeams } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)')
    .eq('round_id', roundId);
  let teams = specificTeams || [];
  if (teams.length === 0) {
    const { data: seasonTeams } = await supabase.from('teams')
      .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)')
      .is('round_id', null);
    teams = seasonTeams || [];
  }
  const [holes, scoresRes, participantIds] = await Promise.all([
    holesForRound(round),
    supabase.from('scores').select('*, players(id, name, handicap)').eq('round_id', roundId),
    getRoundParticipants(roundId),
  ]);
  const scores = scoresRes.data || [];

  const participantSet = new Set(participantIds);
  const allPlayers = await getAllPlayers();
  const activePlayerIds = new Set(allPlayers.filter(p => p.is_active).map(p => p.id));
  const activeScores = scores.filter(s => activePlayerIds.has(s.player_id) && participantSet.has(s.player_id));

  if (!holes || holes.length === 0) return { name: '', display_name: '', data: [] };

  // Build maps for both stableford points and stroke play
  const stabMap = {};
  const strokeMap = {};
  const playerCourseHandicaps = {}; // Store course handicap per player
  
  for (const s of activeScores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    
    // Store course handicap for this player (keyed by player_id for teams)
    if (!playerCourseHandicaps[s.player_id]) {
      playerCourseHandicaps[s.player_id] = { name: s.players.name, handicap: ch };
    }
    
    // Calculate stableford points
    let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
    if (round.joker_hole && s.hole_number === round.joker_hole) {
      pts *= 2;
    }
    stabMap[`${s.player_id}_${s.hole_number}`] = pts;
    
    // Calculate stroke play values (with handicap adjustment)
    const grossStrokes = s.strokes || 0;
    const hcStroke = hcStrokes[s.hole_number] || 0;
    const netStrokes = Math.max(0, grossStrokes - hcStroke);
    strokeMap[`${s.player_id}_${s.hole_number}`] = { gross: grossStrokes, net: netStrokes };
  }

  const teamNames = teams.map(t => ({ 
    name: `${t.player1?.name} and ${t.player2?.name}`, 
    p1: t.player1?.id, 
    p2: t.player2?.id,
    p1Name: t.player1?.name,
    p2Name: t.player2?.name,
    p1Handicap: playerCourseHandicaps[t.player1?.id]?.handicap || 0,
    p2Handicap: playerCourseHandicaps[t.player2?.id]?.handicap || 0
  }));
  const teamTotals = {};

  const tableData = holes.map(h => {
    // Debug: log hole properties to check what par field is available
    // console.log('Hole data:', h);
    const parValue = parseInt(h.par, 10) || parseInt(h.hole_par, 10) || 0;
    const holeRow = { Team: `H${h.hole_number}`, Par: parValue };
    for (const t of teamNames) {
      if (mode === 'stroke') {
        // Stroke Play: best ball (lowest net strokes)
        const p1 = strokeMap[`${t.p1}_${h.hole_number}`];
        const p2 = strokeMap[`${t.p2}_${h.hole_number}`];
        const p1net = p1?.net ?? 999;
        const p2net = p2?.net ?? 999;
        
        if (p1net === 999 && p2net === 999) {
          holeRow[t.name] = '';
          holeRow[`${t.name}_contributor`] = '';
        } else {
          const bestNet = Math.min(p1net, p2net);
          // Show only net strokes for stroke play
          holeRow[t.name] = bestNet;
          // Indicate which player contributed (1 or 2)
          if (p1net < p2net) {
            holeRow[`${t.name}_contributor`] = '1';
          } else if (p2net < p1net) {
            holeRow[`${t.name}_contributor`] = '2';
          } else {
            holeRow[`${t.name}_contributor`] = 'T'; // Tie
          }
          teamTotals[t.name] = (teamTotals[t.name] || 0) + bestNet;
        }
      } else {
        // Stableford: best ball (highest points)
        const p1pts = stabMap[`${t.p1}_${h.hole_number}`] ?? null;
        const p2pts = stabMap[`${t.p2}_${h.hole_number}`] ?? null;
        
        if (p1pts === null && p2pts === null) {
          // No scores entered for this hole
          holeRow[t.name] = '';
          holeRow[`${t.name}_contributor`] = '';
        } else {
          const bestPts = Math.max(p1pts || 0, p2pts || 0);
          holeRow[t.name] = bestPts;
          // Indicate which player contributed (1, 2, or T for tie)
          if (p1pts > p2pts) {
            holeRow[`${t.name}_contributor`] = '1';
          } else if (p2pts > p1pts) {
            holeRow[`${t.name}_contributor`] = '2';
          } else {
            holeRow[`${t.name}_contributor`] = 'T'; // Tie
          }
          teamTotals[t.name] = (teamTotals[t.name] || 0) + bestPts;
        }
      }
    }
    return holeRow;
  });

  // Sort teams - for stroke play lower is better, for stableford higher is better
  // For stroke play: prioritize teams with scores, then sort by total ascending
  const sortedTeams = [...teamNames].sort((a, b) => {
    const aHasScores = teamTotals[a.name] > 0;
    const bHasScores = teamTotals[b.name] > 0;
    
    if (mode === 'stroke') {
      // Teams with scores come first
      if (aHasScores && !bHasScores) return -1;
      if (!aHasScores && bHasScores) return 1;
      // Both have scores: sort by total (lower is better)
      if (aHasScores && bHasScores) return teamTotals[a.name] - teamTotals[b.name];
      // Neither has scores: maintain original order
      return 0;
    } else {
      // Stableford: higher is better
      return (teamTotals[b.name] || 0) - (teamTotals[a.name] || 0);
    }
  });
  
  const sortedData = tableData.map(row => {
    const newRow = { Team: row.Team, Par: row.Par };
    for (const t of sortedTeams) newRow[t.name] = row[t.name];
    return newRow;
  });
  const totalRow = { Team: 'Total' };
  for (const t of sortedTeams) totalRow[t.name] = teamTotals[t.name] || 0;
  sortedData.push(totalRow);

  // Build team handicaps object for display
  const teamHandicaps = {};
  for (const t of teamNames) {
    teamHandicaps[t.name] = {
      p1: { name: t.p1Name, handicap: t.p1Handicap },
      p2: { name: t.p2Name, handicap: t.p2Handicap }
    };
  }

  return {
    name: mode === 'stroke' ? `Teams_Stroke_${round.round_number}` : `Teams_${round.round_number}`,
    display_name: `${mode === 'stroke' ? 'Teams Stroke Play' : 'Teams'} - ${round.courses?.name || `Round ${round.round_number}`}`,
    data: sortedData,
    joker_hole: round.joker_hole,
    beer_hole: round.beer_hole,
    player_handicaps: teamHandicaps,
  };
}

// ===== SEASONS (v8) =====
// One active season + archive of past seasons with full snapshot payloads.

// Supabase-js can throw "body stream already read" when the REST endpoint
// returns an error (e.g. the table doesn't exist yet). We normalise that
// to "table missing" and return a friendly result so the UI can prompt
// the admin to run SUPABASE_SETUP.sql.
function isTableMissing(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes("could not find the table") ||
         msg.includes('public.seasons') ||
         msg.includes('body stream already read') ||
         err?.code === 'PGRST205' ||
         err?.code === '42P01';
}

export async function getCurrentSeason() {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data; // may be null if none seeded yet
  } catch (e) {
    if (isTableMissing(e)) return null;
    throw e;
  }
}

export async function getAllSeasons() {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('is_active', { ascending: false })
      .order('ended_at', { ascending: false, nullsFirst: false })
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getArchivedSeasons() {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('id, name, started_at, ended_at, summary_json')
      .eq('is_active', false)
      .order('ended_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

// Lightweight probe: true if the seasons table is reachable.
// Uses raw fetch so supabase-js body-stream bugs don't surface here.
export async function seasonsTableExists() {
  try {
    const url = process.env.REACT_APP_SUPABASE_URL;
    const key = process.env.REACT_APP_SUPABASE_KEY;
    if (!url || !key) return true;
    const res = await fetch(`${url}/rest/v1/seasons?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.status === 404) return false;
    if (res.ok) return true;
    const body = await res.text();
    if (/could not find the table|PGRST205|42P01/i.test(body)) return false;
    return true;
  } catch (e) {
    if (isTableMissing(e)) return false;
    return true;
  }
}

export async function updateCurrentSeasonName(name) {
  const current = await getCurrentSeason();
  if (!current) throw new Error('No active season to rename.');
  const { error } = await supabase.from('seasons').update({ name }).eq('id', current.id);
  if (error) throw error;
}

export async function setCurrentRound(roundId) {
  const current = await getCurrentSeason();
  if (!current) throw new Error('No active season.');
  const { error } = await supabase.from('seasons').update({ current_round_id: roundId }).eq('id', current.id);
  if (error) throw error;
}

export async function getCurrentRound() {
  const current = await getCurrentSeason();
  if (!current?.current_round_id) return null;
  
  const { data, error } = await supabase
    .from('rounds')
    .select('*, courses(*)')
    .eq('id', current.current_round_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Helper: delete all rows from a table with retry on supabase-js body-stream errors.
async function safeDelete(table, column = 'id', notEqual = 0, attempts = 3) {
  const isStreamError = (e) => {
    const m = (e?.message || '').toLowerCase();
    return m.includes('body stream') || m.includes('already read');
  };
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const { error } = await supabase.from(table).delete().neq(column, notEqual);
      if (error) {
        if (isStreamError(error) && attempt < attempts - 1) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        throw error;
      }
      return;
    } catch (e) {
      if (!isStreamError(e)) throw e;
      if (attempt === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

// Archive the current season and start a new one with `newName`.
// Snapshot is computed live from the current state, then all rounds/scores/teams/exclusions
// are wiped (players, courses and course_holes are preserved).
export async function archiveAndStartNewSeason(newName) {
  if (!newName || !newName.trim()) throw new Error('New season name is required.');

  // 1. Compute the full snapshot from current data
  const [overview, leaderboardData, teamLb, stats, awards] = await Promise.all([
    getSeasonOverview(),
    getLeaderboardData(),
    getTeamLeaderboardData(),
    getPlayerStats(),
    getAwards(),
  ]);

  const summary = {
    captured_at: new Date().toISOString(),
    overview,
    leaderboard: leaderboardData?.leaderboard || [],
    team_leaderboard: teamLb?.leaderboard || [],
    player_stats: stats,
    awards,
    // Convenience lookups so the history card doesn't have to reparse
    champion: leaderboardData?.leaderboard?.[0] || null,
    champion_team: teamLb?.leaderboard?.[0] || null,
  };

  // 2. Close the current season
  const current = await getCurrentSeason();
  if (current) {
    const { error: e1 } = await supabase
      .from('seasons')
      .update({ is_active: false, ended_at: new Date().toISOString(), summary_json: summary })
      .eq('id', current.id);
    if (e1) throw new Error(`Failed to archive current season: ${e1.message}`);
  }

  // 3. Wipe scores/teams/round_exclusions/rounds (keep players, courses, course_holes)
  //    Legacy round_holes table is also cleaned if it still exists.
  //    First clear foreign key references to avoid constraint violations.
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Clear current_round_id reference from ALL seasons before deleting rounds
  const { error: eClearRef } = await supabase
    .from('seasons')
    .update({ current_round_id: null })
    .neq('id', 0);
  if (eClearRef) throw new Error(`Failed to clear round references: ${eClearRef.message}`);
  await delay(150);

  await safeDelete('scores', 'id', 0);
  await delay(150);

  await safeDelete('teams', 'id', 0);
  await delay(150);

  await safeDelete('round_exclusions', 'round_id', 0);
  await delay(150);

  await safeDelete('round_holes', 'id', 0);
  await delay(150);

  await safeDelete('rounds', 'id', 0);
  await delay(150);

  // 4. Insert the new active season
  const { data: created, error: eNew } = await supabase
    .from('seasons')
    .insert({ name: newName.trim(), is_active: true, started_at: new Date().toISOString() })
    .select()
    .single();
  if (eNew) throw new Error(`Failed to start new season: ${eNew.message}`);

  return { archived: current, started: created, summary };
}

// ===== FINES =====
export async function getFinesForRound(roundId) {
  const { data, error } = await supabase
    .from('fines')
    .select('*, players(name)')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addFine(fine) {
  const { data, error } = await supabase
    .from('fines')
    .insert(fine)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFine(fineId) {
  const { error } = await supabase
    .from('fines')
    .delete()
    .eq('id', fineId);
  if (error) throw error;
}

export async function settleFine(fineId, settled = true) {
  const { data, error } = await supabase
    .from('fines')
    .update({ settled })
    .eq('id', fineId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFinesSummary(roundId) {
  const fines = await getFinesForRound(roundId);
  const summary = {};
  fines.forEach(fine => {
    const playerName = fine.players?.name || 'Unknown';
    if (!summary[playerName]) {
      summary[playerName] = { shots: 0, beers: 0, hats: [], totalFines: 0 };
    }
    summary[playerName].totalFines++;
    switch (fine.fine_type) {
      case 'ThreePutt':
      case 'BunkerToBunker':
      case 'RestingOnClub':
      case 'Shank':
      case 'NotPastLadies':
      case 'SandSpecialist':
        summary[playerName].shots += 1;
        break;
      case 'FourPutt':
        summary[playerName].beers += 1;
        break;
      case 'WorstNett':
        summary[playerName].hats.push('Funky Hat');
        break;
      case 'WorstGross':
        summary[playerName].hats.push('Special Hat');
        break;
    }
  });
  return summary;
}

