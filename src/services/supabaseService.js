import { supabase } from './supabaseClient';

// ===== AUTH =====
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: window.location.origin,
    }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Dedupe concurrent profile fetches to avoid supabase-js body-stream race
let _profilePromise = null;
export async function getUserProfile() {
  if (_profilePromise) return _profilePromise;
  _profilePromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (error) return null;
      if (!data) {
        const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || '';
        const { data: created, error: createErr } = await supabase
          .from('user_profiles')
          .upsert({ id: session.user.id, email: session.user.email, display_name: displayName, role: 'pending' }, { onConflict: 'id' })
          .select()
          .maybeSingle();
        if (createErr) return null;
        return created;
      }
      return data;
    } finally {
      // Allow future calls after this one resolves
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
  const { data, error } = await supabase.from('players').select('*').eq('is_active', true).order('name');
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
  const { error } = await supabase.from('players').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// ===== COURSES =====
export async function getCourses() {
  const { data, error } = await supabase.from('courses').select('*').eq('is_active', true).order('name');
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

// ===== ROUNDS =====
export async function getRounds() {
  const { data, error } = await supabase.from('rounds').select('*, courses(*)').order('round_number');
  if (error) throw error;
  return data;
}

export async function getSetUpRounds() {
  const { data, error } = await supabase.from('rounds').select('*, courses(*)').eq('is_setup', true).order('round_number');
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

// ===== ROUND HOLES =====
export async function getRoundHoles(roundId) {
  const { data, error } = await supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number');
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase.from('scores').upsert(scores, { onConflict: 'round_id,player_id,hole_number' }).select();
  if (error) throw error;
  return data;
}

// ===== TEAMS =====
export async function getTeamsForRound(roundId) {
  const { data, error } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name)')
    .eq('round_id', roundId);
  if (error) throw error;
  return data;
}

export async function getAllTeams() {
  const { data, error } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name), player2:players!teams_player2_id_fkey(id, name), rounds(round_number, courses(name))');
  if (error) throw error;
  return data;
}

export async function createTeam(team) {
  const { data, error } = await supabase.from('teams').insert(team).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
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
  const diff = netScore - par;
  if (diff <= -3) return 5; // Albatross or better
  if (diff === -2) return 4; // Eagle
  if (diff === -1) return 3; // Birdie
  if (diff === 0) return 2;  // Par
  if (diff === 1) return 1;  // Bogey
  return 0; // Double bogey or worse
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
      strokesPerHole[hole.hole_number] = pass + 1;
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

export async function getLeaderboardData() {
  const rounds = await getSetUpRounds();
  const players = await getPlayers();
  const { data: allScores } = await supabase.from('scores').select('round_id, player_id, hole_number, strokes');
  const { data: allHoles } = await supabase.from('round_holes').select('round_id, hole_number, par, stroke_index');

  const holesMap = {};
  const roundHolesMap = {};
  for (const h of allHoles || []) {
    holesMap[`${h.round_id}_${h.hole_number}`] = h;
    if (!roundHolesMap[h.round_id]) roundHolesMap[h.round_id] = [];
    roundHolesMap[h.round_id].push(h);
  }

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
        roundTotal += calcStablefordPoints(s.strokes, hole.par, hcStrokes);
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
  leaderboard.forEach((p, i) => { p.rank = i + 1; });
  return { leaderboard, rounds };
}

export async function getTeamLeaderboardData() {
  const rounds = await getSetUpRounds();
  const players = await getPlayers();
  const { data: allTeams } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)');
  const { data: allScores } = await supabase.from('scores').select('round_id, player_id, hole_number, strokes');
  const { data: allHoles } = await supabase.from('round_holes').select('round_id, hole_number, par, stroke_index');

  const holesMap = {};
  const roundHolesMap = {};
  for (const h of allHoles || []) {
    holesMap[`${h.round_id}_${h.hole_number}`] = h;
    if (!roundHolesMap[h.round_id]) roundHolesMap[h.round_id] = [];
    roundHolesMap[h.round_id].push(h);
  }

  // Stableford per player per round per hole (with handicap)
  const playerMap = {};
  for (const p of players) playerMap[p.id] = p;

  const stabMap = {};
  for (const s of allScores || []) {
    const hole = holesMap[`${s.round_id}_${s.hole_number}`];
    if (!hole) continue;
    const player = playerMap[s.player_id];
    if (!player) continue;
    const round = rounds.find(r => r.id === s.round_id);
    if (!round) continue;
    const ch = calcCourseHandicap(player.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const holes = roundHolesMap[s.round_id] || [];
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    const pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
    stabMap[`${s.round_id}_${s.player_id}_${s.hole_number}`] = pts;
  }

  const teamPairsMap = {};
  for (const t of allTeams || []) {
    const key = [t.player1?.name, t.player2?.name].sort().join(' and ');
    if (!teamPairsMap[key]) teamPairsMap[key] = { name: `${t.player1?.name} and ${t.player2?.name}`, p1Id: t.player1?.id, p2Id: t.player2?.id, roundIds: new Set() };
    teamPairsMap[key].roundIds.add(t.round_id);
  }

  const teamLeaderboard = Object.values(teamPairsMap).map(team => {
    const roundScores = {};
    let total = 0;
    for (const r of rounds) {
      if (!team.roundIds.has(r.id)) { roundScores[r.courses?.name || `R${r.round_number}`] = 0; continue; }
      const holes = roundHolesMap[r.id] || [];
      let roundTotal = 0;
      for (const h of holes) {
        const p1pts = stabMap[`${r.id}_${team.p1Id}_${h.hole_number}`] || 0;
        const p2pts = stabMap[`${r.id}_${team.p2Id}_${h.hole_number}`] || 0;
        roundTotal += Math.max(p1pts, p2pts);
      }
      roundScores[r.courses?.name || `R${r.round_number}`] = roundTotal;
      total += roundTotal;
    }
    return { player: team.name, ...roundScores, total };
  });

  teamLeaderboard.sort((a, b) => b.total - a.total);
  teamLeaderboard.forEach((t, i) => { t.rank = i + 1; });
  return { leaderboard: teamLeaderboard, rounds };
}

export async function getPlayerStats() {
  const players = await getPlayers();
  const rounds = await getSetUpRounds();
  const { data: allScores } = await supabase.from('scores').select('round_id, player_id, hole_number, strokes');
  const { data: allHoles } = await supabase.from('round_holes').select('round_id, hole_number, par, stroke_index');

  const holesMap = {};
  const roundHolesMap = {};
  for (const h of allHoles || []) {
    holesMap[`${h.round_id}_${h.hole_number}`] = h;
    if (!roundHolesMap[h.round_id]) roundHolesMap[h.round_id] = [];
    roundHolesMap[h.round_id].push(h);
  }

  const roundCourseMap = {};
  for (const r of rounds) roundCourseMap[r.id] = r.courses?.name || `Round ${r.round_number}`;

  const stats = [];
  for (const p of players) {
    const pScores = (allScores || []).filter(s => s.player_id === p.id);
    if (pScores.length === 0) continue;

    const roundsPlayed = new Set(pScores.map(s => s.round_id));
    let hio = 0, albatross = 0, eagles = 0, birdies = 0, pars = 0, bogeys = 0, dblPlus = 0;
    const roundTotals = {};

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
      const round = rounds.find(r => r.id === s.round_id);
      if (round) {
        const ch = calcCourseHandicap(p.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
        const holes = roundHolesMap[s.round_id] || [];
        const hcStrokes = distributeHandicapStrokes(ch, holes);
        const pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
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
  stats.forEach((s, i) => { s.rank = i + 1; });
  return stats;
}

export async function getSeasonOverview() {
  const rounds = await getSetUpRounds();
  const allRounds = await getRounds();
  const players = await getPlayers();
  const stats = await getPlayerStats();
  const { leaderboard } = await getLeaderboardData();
  const { leaderboard: teamLb } = await getTeamLeaderboardData();

  const activePlayers = leaderboard.filter(p => p.total > 0).length;
  const coursesPlayed = rounds.map(r => r.courses?.name).filter(Boolean);
  const bestRound = stats.reduce((best, s) => s.best_round > best.score ? { player: s.name, score: s.best_round, course: s.best_round_name } : best, { player: '', score: 0, course: '' });
  const eagleLeader = stats.reduce((best, s) => s.eagles > best.count ? { player: s.name, count: s.eagles } : best, { player: '', count: 0 });
  const birdieLeader = stats.reduce((best, s) => s.birdies > best.count ? { player: s.name, count: s.birdies } : best, { player: '', count: 0 });
  const hioLeader = stats.reduce((best, s) => s.hole_in_ones > best.count ? { player: s.name, count: s.hole_in_ones } : best, { player: '', count: 0 });

  return {
    top_players: leaderboard.slice(0, 3).map(p => ({ name: p.player, total: p.total, rank: p.rank })),
    top_team: teamLb[0] ? { name: teamLb[0].player, total: teamLb[0].total } : null,
    active_players: activePlayers, total_players: players.length,
    courses_played: coursesPlayed, total_courses: rounds.length, total_round_slots: allRounds.length,
    best_round: bestRound, eagle_leader: eagleLeader, birdie_leader: birdieLeader, hio_leader: hioLeader,
    total_holes_played: stats.reduce((a, s) => a + s.holes_played, 0),
    total_rounds_played: stats.reduce((a, s) => a + s.rounds_played, 0),
    last_updated: new Date().toISOString(),
  };
}

// ===== STABLEFORD ROUND VIEW =====
export async function getStablefordRoundData(roundId) {
  const { data: holes } = await supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number');
  const { data: scores } = await supabase.from('scores').select('*, players(name, handicap)').eq('round_id', roundId);
  const { data: round } = await supabase.from('rounds').select('*, courses(*)').eq('id', roundId).single();

  if (!holes || !round) return { name: '', display_name: '', data: [] };

  const playerNames = [...new Set(scores.map(s => s.players.name))];
  const playerHandicaps = {};
  scores.forEach(s => { playerHandicaps[s.players.name] = s.players.handicap; });

  const stabMap = {};
  for (const s of scores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    const pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
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
  const { data: holes } = await supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number');
  const { data: scores } = await supabase.from('scores').select('*, players(id, name, handicap)').eq('round_id', roundId);
  const { data: teams } = await supabase.from('teams')
    .select('*, player1:players!teams_player1_id_fkey(id, name, handicap), player2:players!teams_player2_id_fkey(id, name, handicap)')
    .eq('round_id', roundId);
  const { data: round } = await supabase.from('rounds').select('*, courses(*)').eq('id', roundId).single();

  if (!holes || !round || !teams) return { name: '', display_name: '', data: [] };

  const stabMap = {};
  for (const s of scores) {
    const hole = holes.find(h => h.hole_number === s.hole_number);
    if (!hole) continue;
    const ch = calcCourseHandicap(s.players.handicap, round.courses?.slope, round.courses?.rating, round.courses?.par);
    const hcStrokes = distributeHandicapStrokes(ch, holes);
    const pts = calcStablefordPoints(s.strokes, hole.par, hcStrokes[s.hole_number] || 0);
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
