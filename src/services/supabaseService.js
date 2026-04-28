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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Friendly messages
    const m = error.message?.toLowerCase() || '';
    if (m.includes('email not confirmed') || m.includes('not confirmed')) {
      throw new Error('Your email isn\'t confirmed yet. Please check your inbox for the confirmation link, or ask an admin to approve your account.');
    }
    if (m.includes('invalid login') || m.includes('invalid credentials')) {
      throw new Error('Incorrect email or password.');
    }
    throw error;
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
  // Soft-delete the player
  const { error } = await supabase.from('players').update({ is_active: false }).eq('id', id);
  if (error) throw error;
  // Cascade: remove their scores and any teams they're in (teams become meaningless with one player)
  await supabase.from('scores').delete().eq('player_id', id);
  const { error: t1 } = await supabase.from('teams').delete().eq('player1_id', id);
  if (t1) throw t1;
  const { error: t2 } = await supabase.from('teams').delete().eq('player2_id', id);
  if (t2) throw t2;
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
  // Cascade delete: scores → round_holes → teams → exclusions → round
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

// ===== ROUND EXCLUSIONS (v7) =====
// Mark players who didn't compete in a specific round so the season
// completion gate and awards treat them correctly.
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

// Admin: clear scores for a single round (keeps the round + holes + teams)
export async function clearRoundScores(roundId) {
  const { error } = await supabase.from('scores').delete().eq('round_id', roundId);
  if (error) throw error;
}

// Admin: wipe all season data (scores + teams + round_holes + rounds) — players & courses kept
// Returns counts of deleted rows so we can detect RLS-silent-failures
export async function resetSeasonData() {
  const { data: scoresDel } = await supabase.from('scores').delete().neq('id', 0).select('id');
  const { data: teamsDel } = await supabase.from('teams').delete().neq('id', 0).select('id');
  const { data: holesDel } = await supabase.from('round_holes').delete().neq('id', 0).select('id');
  const { data: roundsDel, error } = await supabase.from('rounds').delete().neq('id', 0).select('id');
  if (error) throw error;
  return {
    scores: scoresDel?.length || 0,
    teams: teamsDel?.length || 0,
    holes: holesDel?.length || 0,
    rounds: roundsDel?.length || 0,
  };
}

// Admin: clear ALL scores across the league (keep rounds / holes / teams)
export async function clearAllScores() {
  const { data, error } = await supabase.from('scores').delete().neq('id', 0).select('id');
  if (error) throw error;
  return data?.length || 0;
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
  const isStreamError = (e) => {
    const m = (e?.message || '').toLowerCase();
    return m.includes('body stream') || m.includes('already read');
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.from('scores').upsert(scores, { onConflict: 'round_id,player_id,hole_number' }).select();
      if (error) {
        if (isStreamError(error) && attempt < 2) { await new Promise(r => setTimeout(r, 500)); continue; }
        throw error;
      }
      return data;
    } catch (e) {
      if (!isStreamError(e)) throw e;
      // Stream error: wait, then verify by reading back
      await new Promise(r => setTimeout(r, 500));
      try {
        const roundId = scores[0]?.round_id;
        const playerId = scores[0]?.player_id;
        if (roundId && playerId) {
          const { data: verify } = await supabase.from('scores')
            .select('hole_number, strokes')
            .eq('round_id', roundId)
            .eq('player_id', playerId);
          if (verify && verify.length >= scores.length) {
            const wrote = scores.every(s => verify.find(v => v.hole_number === s.hole_number && v.strokes === s.strokes));
            if (wrote) return verify;
          }
        }
      } catch (_) {}
      if (attempt === 2) throw e;
    }
  }
  throw new Error('Failed to save scores after 3 attempts. Please refresh and try again.');
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

// Remove user: mark as 'removed' in our profile table (we can't delete from auth.users with anon key — admin must do that separately in Supabase dashboard).
export async function removeUser(userId) {
  const { data, error } = await supabase.from('user_profiles').update({ role: 'removed' }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
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

export async function getLeaderboardData() {
  const [rounds, players, scoresRes] = await Promise.all([
    getSetUpRounds(),
    getPlayers(),
    withTimeout(supabase.from('scores').select('round_id, player_id, hole_number, strokes'), 15000, 'scores'),
  ]);
  const allScores = scoresRes.data;
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);

  const playerRoundTotals = {};
  for (const p of players) {
    playerRoundTotals[p.id] = {};
    for (const r of rounds) {
      const courseHandicap = calcCourseHandicap(p.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
      const holes = roundHolesMap[r.id] || [];
      const handicapStrokes = distributeHandicapStrokes(courseHandicap, holes);

      const pScores = (allScores || []).filter(s => s.player_id === p.id && s.round_id === r.id);
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
      if (pScores.length > 0) playerRoundTotals[p.id][r.id] = roundTotal;
    }
  }

  const leaderboard = players.map(p => {
    const roundScores = playerRoundTotals[p.id] || {};
    const total = Object.values(roundScores).reduce((a, b) => a + b, 0);
    const roundDetails = {};
    for (const r of rounds) {
      roundDetails[r.courses?.name || `Round ${r.round_number}`] = roundScores[r.id] || 0;
    }
    return { player: p.name, ...roundDetails, total };
  });

  leaderboard.sort((a, b) => b.total - a.total);
  assignTiedRanks(leaderboard, 'total');
  return { leaderboard: withRankFirst(leaderboard), rounds };
}

export async function getTeamLeaderboardData() {
  const [rounds, players, teamsRes, scoresRes] = await Promise.all([
    getSetUpRounds(),
    getPlayers(),
    withTimeout(supabase.from('teams')
      .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)'), 15000, 'teams'),
    withTimeout(supabase.from('scores').select('round_id, player_id, hole_number, strokes'), 15000, 'scores-team'),
  ]);
  const allTeams = teamsRes.data;
  const allScores = scoresRes.data;
  const { holesMap, roundHolesMap } = await fetchHolesForRounds(rounds);

  // Stableford per player per round per hole (with handicap)
  const playerMap = {};
  for (const p of players) playerMap[p.id] = p;

  const stabMap = {};
  const hcCache = {}; // key: roundId_playerId

  const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

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
    let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
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
  for (const r of rounds) {
    if (roundsWithSpecific.has(r.id)) {
      for (const t of perRoundTeams.filter(x => x.round_id === r.id)) addTeam(t, r.id);
    } else {
      for (const t of seasonTeams) addTeam(t, r.id);
    }
  }

  const teamLeaderboard = Object.values(teamPairsMap).map(team => {
    const roundScores = {};
    let total = 0;
    for (const r of rounds) {
      if (!team.roundIds.has(r.id)) { roundScores[r.courses?.name || `R${r.round_number}`] = 0; continue; }
      const holes = roundHolesMap[r.id] || [];
      let roundTotal = 0;
      for (const h of holes) {
        const p1key = `${r.id}_${team.p1Id}_${h.hole_number}`;
        const p2key = `${r.id}_${team.p2Id}_${h.hole_number}`;

        const p1pts = stabMap[p1key];
        const p2pts = stabMap[p2key];

        if (p1pts == null && p2pts == null) continue;

        roundTotal += Math.max(p1pts || 0, p2pts || 0);
      }
      roundScores[r.courses?.name || `R${r.round_number}`] = roundTotal;
      total += roundTotal;
    }
    return { player: team.name, ...roundScores, total };
  });

  teamLeaderboard.sort((a, b) => b.total - a.total);
  assignTiedRanks(teamLeaderboard, 'total');
  return { leaderboard: withRankFirst(teamLeaderboard), rounds };
}

export async function getPlayerStats() {
  const [players, rounds, scoresRes] = await Promise.all([
    getPlayers(),
    getSetUpRounds(),
    withTimeout(supabase.from('scores').select('round_id, player_id, hole_number, strokes'), 15000, 'scores-stats'),
  ]);
  const allScores = scoresRes.data;
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
      const diff = s.strokes - hole.par; // Raw diff (no handicap for stats display)
      if (s.strokes === 1) hio++;
      else if (diff <= -3) albatross++;
      else if (diff === -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) pars++;
      else if (diff === 1) bogeys++;
      else dblPlus++;

      // Stableford with handicap
      const round = roundMap[s.round_id];
      if (round) {
        const ch = calcCourseHandicap(p.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
        const holes = roundHolesMap[s.round_id] || [];
        const hcStrokes = distributeHandicapStrokes(ch, holes);
        let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
        if (round.joker_hole && s.hole_number === round.joker_hole) pts *= 2;
        if (!roundTotals[s.round_id]) roundTotals[s.round_id] = 0;
        roundTotals[s.round_id] += pts;
      }
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
  const [players, rounds, scoresRes, exclusionsRes] = await Promise.all([
    getPlayers(),
    getSetUpRounds(),
    withTimeout(supabase.from('scores').select('round_id, player_id, hole_number, strokes'), 15000, 'scores-awards'),
    withTimeout(supabase.from('round_exclusions').select('round_id, player_id'), 10000, 'exclusions'),
  ]);
  const allScores = scoresRes.data || [];
  // Map of roundId -> Set of excluded playerIds
  const excludedByRound = {};
  for (const e of (exclusionsRes.data || [])) {
    if (!excludedByRound[e.round_id]) excludedByRound[e.round_id] = new Set();
    excludedByRound[e.round_id].add(e.player_id);
  }
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
    const excludedSet = excludedByRound[r.id] || new Set();
    const entrants = players
      .filter(p => !excludedSet.has(p.id))
      .map(p => ({ playerId: p.id, name: p.name, ...perPR[p.id]?.[r.id] }))
      .filter(e => e.total != null);
    if (entrants.length === 0) {
      perRoundAwards.push({
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
      const scoresOnHole = allScores.filter(s => s.round_id === r.id && s.hole_number === r.beer_hole && !excludedSet.has(s.player_id));
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
        const jokerScores = allScores.filter(s => s.round_id === r.id && s.hole_number === r.joker_hole && !excludedSet.has(s.player_id));
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
      round_number: r.round_number,
      course: r.courses?.name || `Round ${r.round_number}`,
      beer_hole: r.beer_hole,
      joker_hole: r.joker_hole,
      has_scores: true,
      excluded: [...(excludedByRound[r.id] || [])].map(id => nameById[id] || '?'),
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
  // Wooden Spoon season tally (excluded players can't win the spoon for a round they sat out)
  const spoonCounts = {};
  const spoonHistory = [];
  for (const r of rounds) {
    const excludedSet = excludedByRound[r.id] || new Set();
    let worst = null;
    for (const p of players) {
      if (excludedSet.has(p.id)) continue;
      const d = perPR[p.id]?.[r.id];
      if (!d) continue;
      if (!worst || d.total < worst.total) worst = { playerId: p.id, total: d.total, roundId: r.id };
    }
    if (worst) {
      spoonCounts[worst.playerId] = (spoonCounts[worst.playerId] || 0) + 1;
      spoonHistory.push({ ...worst, name: nameById[worst.playerId], round_number: r.round_number, course: r.courses?.name || `R${r.round_number}` });
    }
  }
  const spoonList = Object.entries(spoonCounts)
    .map(([pid, count]) => ({ player: nameById[+pid] || 'Unknown', count }))
    .sort((a, b) => b.count - a.count);
  let longestStreak = { player: '', streak: 0 };
  let currentStreak = { playerId: null, len: 0 };
  for (const h of spoonHistory) {
    if (h.playerId === currentStreak.playerId) currentStreak.len++;
    else currentStreak = { playerId: h.playerId, len: 1 };
    if (currentStreak.len > longestStreak.streak) {
      longestStreak = { player: nameById[currentStreak.playerId] || '-', streak: currentStreak.len };
    }
  }

  // Season-wide beer-hole tally: how many times each player bought drinks (ties all count)
  const beerTally = {};
  for (const r of rounds) {
    if (!r.beer_hole) continue;
    const excludedSet = excludedByRound[r.id] || new Set();
    const scoresOnHole = allScores.filter(s => s.round_id === r.id && s.hole_number === r.beer_hole && !excludedSet.has(s.player_id));
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
  // Track best joker hole bonus across ALL rounds — "king of the joker"
  const jokerBestBonus = {}; // playerId -> best base points earned on any joker hole
  for (const r of rounds) {
    if (!r.joker_hole) continue;
    const excludedSet = excludedByRound[r.id] || new Set();
    const holesForRound = roundHolesMap[r.id] || [];
    const hole = holesForRound.find(h => h.hole_number === r.joker_hole);
    if (!hole) continue;
    const jokerScores = allScores.filter(s => s.round_id === r.id && s.hole_number === r.joker_hole && !excludedSet.has(s.player_id));
    for (const s of jokerScores) {
      const player = players.find(p => p.id === s.player_id);
      if (!player) continue;
      const ch = calcCourseHandicap(player.handicap, r.courses?.slope, r.courses?.rating, r.courses?.par);
      const hcMap = distributeHandicapStrokes(ch, holesForRound);
      const basePts = calcStablefordPoints(s.strokes, hole.par, hcMap[s.hole_number] || 0);
      if (!jokerBestBonus[s.player_id] || basePts > jokerBestBonus[s.player_id].bonus) {
        jokerBestBonus[s.player_id] = {
          bonus: basePts,
          round: r.round_number,
          course: r.courses?.name || `R${r.round_number}`,
          hole: r.joker_hole,
        };
      }
    }
  }
  const jokerKing = Object.entries(jokerBestBonus)
    .map(([pid, d]) => ({ player: nameById[+pid] || '?', ...d }))
    .sort((a, b) => b.bonus - a.bonus)[0] || null;

  // Season completion (honouring exclusions)
  const activePlayerCount = players.length;
  let roundsComplete = 0;
  for (const r of rounds) {
    const excluded = excludedByRound[r.id] || new Set();
    const expectedCount = activePlayerCount - excluded.size;
    const playersWithScores = new Set(allScores.filter(s => s.round_id === r.id).map(s => s.player_id));
    if (expectedCount > 0 && playersWithScores.size >= expectedCount) roundsComplete++;
  }
  const seasonComplete = rounds.length > 0 && roundsComplete === rounds.length;

  return {
    season_complete: seasonComplete,
    rounds_complete: roundsComplete,
    total_rounds: rounds.length,
    active_players: activePlayerCount,
    per_round: perRoundAwards,
    season: {
      wooden_spoon_leader: spoonList[0] || { player: '-', count: 0 },
      longest_streak: longestStreak,
      joker_king: jokerKing,
    },
  };
}

export async function getSeasonOverview() {
  // Parallelize all heavy fetches instead of awaiting sequentially (was ~20 sequential DB calls)
  const [allRounds, allPlayers, stats, lbRes, teamLbRes] = await Promise.all([
    getRounds(),
    getPlayers(),
    getPlayerStats(),
    getLeaderboardData(),
    getTeamLeaderboardData(),
  ]);
  const { leaderboard, rounds } = lbRes;
  const { leaderboard: teamLb } = teamLbRes;

  const activePlayers = leaderboard.filter(p => p.total > 0).length;
  const coursesPlayed = rounds.map(r => r.courses?.name).filter(Boolean);
  const bestRound = stats.reduce((best, s) => s.best_round > best.score ? { player: s.name, score: s.best_round, course: s.best_round_name } : best, { player: '', score: 0, course: '' });
  const eagleLeader = stats.reduce((best, s) => s.eagles > best.count ? { player: s.name, count: s.eagles } : best, { player: '', count: 0 });
  const birdieLeader = stats.reduce((best, s) => s.birdies > best.count ? { player: s.name, count: s.birdies } : best, { player: '', count: 0 });
  const hioLeader = stats.reduce((best, s) => s.hole_in_ones > best.count ? { player: s.name, count: s.hole_in_ones } : best, { player: '', count: 0 });

  return {
    top_players: leaderboard.slice(0, 3).map(p => ({ name: p.player, total: p.total, rank: p.rank })),
    top_team: teamLb[0] ? { name: teamLb[0].player, total: teamLb[0].total } : null,
    active_players: activePlayers, total_players: allPlayers.length,
    courses_played: coursesPlayed, total_courses: rounds.length, total_round_slots: allRounds.length,
    best_round: bestRound, eagle_leader: eagleLeader, birdie_leader: birdieLeader, hio_leader: hioLeader,
    total_holes_played: stats.reduce((a, s) => a + s.holes_played, 0),
    total_rounds_played: stats.reduce((a, s) => a + s.rounds_played, 0),
    last_updated: new Date().toISOString(),
  };
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

// ===== STABLEFORD ROUND VIEW =====
export async function getStablefordRoundData(roundId) {
  const { data: round } = await supabase.from('rounds').select('*, courses(*)').eq('id', roundId).single();
  if (!round) return { name: '', display_name: '', data: [] };
  const [holes, scoresRes] = await Promise.all([
    holesForRound(round),
    supabase.from('scores').select('*, players(name, handicap)').eq('round_id', roundId),
  ]);
  const scores = scoresRes.data || [];

  if (!holes || holes.length === 0) return { name: '', display_name: '', data: [] };

  const playerNames = [...new Set(scores.map(s => s.players.name))];

  const stabMap = {};
  for (const s of scores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
    if (round.joker_hole && s.hole_number === round.joker_hole) pts *= 2;
    stabMap[`${s.players.name}_${s.hole_number}`] = pts;
  }

  const playerTotals = {};
  playerNames.forEach(p => {
    playerTotals[p] = holes.reduce((sum, h) => sum + (stabMap[`${p}_${h.hole_number}`] || 0), 0);
  });
  const sortedPlayers = [...playerNames].sort((a, b) => (playerTotals[b] || 0) - (playerTotals[a] || 0));

  const tableData = holes.map(h => {
    const row = { Hole: h.hole_number, Par: h.par, SI: h.stroke_index };
    for (const p of sortedPlayers) row[p] = stabMap[`${p}_${h.hole_number}`] ?? '';
    return row;
  });
  const totalRow = { Hole: 'TOTAL', Par: holes.reduce((s, h) => s + h.par, 0), SI: '' };
  for (const p of sortedPlayers) totalRow[p] = playerTotals[p] || 0;
  tableData.push(totalRow);

  return {
    name: `Stableford_${round.round_number}`,
    display_name: `Stableford - ${round.courses?.name || `Round ${round.round_number}`}`,
    data: tableData,
  };
}

// ===== TEAM ROUND VIEW =====
export async function getTeamRoundData(roundId) {
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
  const [holes, scoresRes] = await Promise.all([
    holesForRound(round),
    supabase.from('scores').select('*, players(id, name, handicap)').eq('round_id', roundId),
  ]);
  const scores = scoresRes.data || [];

  if (!holes || holes.length === 0) return { name: '', display_name: '', data: [] };

  const stabMap = {};
  for (const s of scores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    let pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
    if (round.joker_hole && s.hole_number === round.joker_hole) {
      pts *= 2;
    }
    stabMap[`${s.player_id}_${s.hole_number}`] = pts;
  }

  const teamNames = teams.map(t => ({ name: `${t.player1?.name} and ${t.player2?.name}`, p1: t.player1?.id, p2: t.player2?.id }));
  const teamTotals = {};

  const tableData = holes.map(h => {
    const holeRow = { Team: `H${h.hole_number}` };
    for (const t of teamNames) {
      const p1pts = stabMap[`${t.p1}_${h.hole_number}`] || 0;
      const p2pts = stabMap[`${t.p2}_${h.hole_number}`] || 0;
      holeRow[t.name] = Math.max(p1pts, p2pts);
      teamTotals[t.name] = (teamTotals[t.name] || 0) + Math.max(p1pts, p2pts);
    }
    return holeRow;
  });

  const sortedTeams = [...teamNames].sort((a, b) => (teamTotals[b.name] || 0) - (teamTotals[a.name] || 0));
  const sortedData = tableData.map(row => {
    const newRow = { Team: row.Team };
    for (const t of sortedTeams) newRow[t.name] = row[t.name];
    return newRow;
  });
  const totalRow = { Team: 'Total' };
  for (const t of sortedTeams) totalRow[t.name] = teamTotals[t.name] || 0;
  sortedData.push(totalRow);

  return {
    name: `Teams_${round.round_number}`,
    display_name: `Teams - ${round.courses?.name || `Round ${round.round_number}`}`,
    data: sortedData,
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
  const { error: eScores } = await supabase.from('scores').delete().neq('id', 0);
  if (eScores) throw new Error(`Failed to wipe scores: ${eScores.message}`);
  const { error: eTeams } = await supabase.from('teams').delete().neq('id', 0);
  if (eTeams) throw new Error(`Failed to wipe teams: ${eTeams.message}`);
  // round_exclusions cascades when rounds are deleted, but clear explicitly for safety
  await supabase.from('round_exclusions').delete().neq('round_id', 0);
  await supabase.from('round_holes').delete().neq('id', 0);
  const { error: eRounds } = await supabase.from('rounds').delete().neq('id', 0);
  if (eRounds) throw new Error(`Failed to wipe rounds: ${eRounds.message}`);

  // 4. Insert the new active season
  const { data: created, error: eNew } = await supabase
    .from('seasons')
    .insert({ name: newName.trim(), is_active: true, started_at: new Date().toISOString() })
    .select()
    .single();
  if (eNew) throw new Error(`Failed to start new season: ${eNew.message}`);

  return { archived: current, started: created, summary };
}

