import * as XLSX from 'xlsx';

const EXCLUDED_SHEETS = ['setup', 'teams', 'round_1', 'round_2', 'round_3', 'round_4', 'round_5'];
const ROUND_SHEETS = ['round_1', 'round_2', 'round_3', 'round_4', 'round_5'];

let cache = { workbook: null, sheets: null, lastUpdated: null, courseMap: {} };

// --- Helpers ---
function shouldExclude(name) { return EXCLUDED_SHEETS.includes(name.toLowerCase()); }
function isRoundSheet(name) { return ROUND_SHEETS.includes(name.toLowerCase()); }
function isPlaceholderPlayer(name) { return /^Player\s*\d+$/i.test(String(name).trim()); }

function formatSheetName(name, courseMap) {
  const match = name.match(/^(Stableford|Teams)_(\d+)$/i);
  if (match && courseMap) {
    const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const course = courseMap[match[2]];
    if (!course) return null; // Round not set up — skip
    return `${prefix} - ${course}`;
  }
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function parseSheet(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.filter(row => Object.values(row).some(v => String(v).trim() !== ''));
}

function filterPlaceholderColumns(data) {
  if (!data.length) return data;
  const placeholderCols = Object.keys(data[0]).filter(k => isPlaceholderPlayer(k));
  if (!placeholderCols.length) return data;
  return data.map(row => {
    const newRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (!isPlaceholderPlayer(k)) newRow[k] = v;
    }
    return newRow;
  });
}

function filterPlaceholderRows(data) {
  if (!data.length) return data;
  const playerKey = Object.keys(data[0]).find(k => k.toLowerCase() === 'player');
  if (!playerKey) return data;
  return data.filter(row => !isPlaceholderPlayer(row[playerKey]));
}

function filterTeamPlaceholderRows(data) {
  // For Team Leaderboard and Teams_ sheets: exclude rows where the team name contains "Player" placeholder names
  if (!data.length) return data;
  const playerKey = Object.keys(data[0]).find(k => k.toLowerCase() === 'player' || k.toLowerCase() === 'team');
  if (!playerKey) return data;
  return data.filter(row => {
    const val = String(row[playerKey] || '');
    // Check if ANY part of the team name matches "Player XX"
    return !/Player\s*\d+/i.test(val);
  });
}

function parseRoundSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const allRows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : null);
    }
    allRows.push(row);
  }

  // Extract metadata
  const courseName = allRows[0]?.[1] ? String(allRows[0][1]).trim() : '';
  const courseRating = allRows[1]?.[1];
  const slopeRating = allRows[2]?.[1];
  const coursePar = allRows[3]?.[1];

  // Skip if round is not set up (no course name or no ratings)
  if (!courseName || !courseRating || !slopeRating || !coursePar) {
    return { courseName: '', playerHoles: {}, isSetUp: false };
  }

  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i][0] && String(allRows[i][0]).trim().toLowerCase() === 'hole') { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { courseName, playerHoles: {}, isSetUp: false };

  const headers = allRows[headerIdx].map((h, i) => h ? String(h) : `Col_${i}`);
  const fixed = new Set(['Hole', 'Par', 'SI']);
  const playerCols = headers.filter(h => !fixed.has(h) && !h.startsWith('Col_') && !isPlaceholderPlayer(h));
  const parIdx = headers.indexOf('Par');

  const playerHoles = {};
  playerCols.forEach(p => { playerHoles[p] = []; });

  for (let r = headerIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row[0]) continue;
    const holeVal = String(row[0]).trim().toUpperCase();
    if (holeVal === 'TOTAL' || holeVal === '') continue;
    const par = parIdx >= 0 ? row[parIdx] : null;
    if (par == null) continue;
    const parNum = parseInt(par);
    if (isNaN(parNum)) continue;

    for (const player of playerCols) {
      const pIdx = headers.indexOf(player);
      const score = row[pIdx];
      if (score == null || score === '' || score === 0) continue;
      const scoreNum = parseInt(score);
      if (isNaN(scoreNum)) continue;
      playerHoles[player].push({
        round: String(allRows[0][1] || r), hole: row[0], par: parNum,
        score: scoreNum, vs_par: scoreNum - parNum,
      });
    }
  }
  return { courseName, playerHoles, isSetUp: true, courseRating, slopeRating, coursePar };
}

// --- Core: Fetch & Parse ---
async function fetchAndParse() {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const PROXY_URL = backendUrl ? `${backendUrl}/api/excel-proxy` : `/api/excel-proxy`;
  const response = await fetch(`${PROXY_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`Proxy fetch failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  // Build course map from League Leaderboard (only courses that are set up)
  const courseMap = {};
  const validRounds = new Set();
  if (wb.SheetNames.includes('League Leaderboard')) {
    const lbWs = wb.Sheets['League Leaderboard'];
    const lbData = XLSX.utils.sheet_to_json(lbWs, { defval: '' });
    if (lbData.length > 0) {
      const keys = Object.keys(lbData[0]).filter(k => !['Player', 'Total', 'Rank'].includes(k));
      keys.forEach((k, i) => { courseMap[String(i + 1)] = k; });
    }
  }

  // Check which rounds are actually set up (have course name + ratings)
  for (const name of wb.SheetNames) {
    if (!isRoundSheet(name)) continue;
    const num = name.split('_')[1];
    const ws = wb.Sheets[name];
    const parsed = parseRoundSheet(ws);
    if (parsed.isSetUp) validRounds.add(num);
  }

  // Remove unset rounds from courseMap
  for (const num of Object.keys(courseMap)) {
    if (!validRounds.has(num)) delete courseMap[num];
  }

  // Parse display sheets (skip Stableford/Teams for rounds not set up)
  const sheetsData = {};
  const sheetList = [];
  for (const name of wb.SheetNames) {
    if (shouldExclude(name)) continue;
    const displayName = formatSheetName(name, courseMap);
    if (displayName === null) continue; // Round not set up
    const ws = wb.Sheets[name];
    let data = parseSheet(ws);
    // Filter placeholder players from all sheets
    data = filterPlaceholderColumns(data);
    data = filterPlaceholderRows(data);
    // Filter team rows containing placeholder player names
    if (name.toLowerCase().includes('team')) {
      data = filterTeamPlaceholderRows(data);
    }
    sheetsData[name] = { name, display_name: displayName, data };
    sheetList.push({ name, display_name: displayName });
  }

  // Parse round sheets for stroke data (only set-up rounds)
  const roundData = {};
  for (const name of wb.SheetNames) {
    if (!isRoundSheet(name)) continue;
    const num = name.split('_')[1];
    if (!validRounds.has(num)) continue;
    const ws = wb.Sheets[name];
    const parsed = parseRoundSheet(ws);
    if (parsed.isSetUp) roundData[num] = parsed;
  }

  cache = {
    workbook: wb, sheets: { sheetsData, sheetList, roundData, courseMap },
    lastUpdated: new Date().toISOString(), courseMap,
    validRoundCount: validRounds.size,
    totalRoundSlots: ROUND_SHEETS.length,
  };
  return cache;
}

// --- Public API ---

export async function getSheets() {
  if (!cache.sheets) await fetchAndParse();
  return { sheets: cache.sheets.sheetList, last_updated: cache.lastUpdated };
}

export async function getSheetData(sheetName) {
  if (!cache.sheets) await fetchAndParse();
  const sd = cache.sheets.sheetsData[sheetName];
  if (!sd) throw new Error('Sheet not found');
  let data = [...sd.data];

  if (sheetName.toLowerCase().includes('leaderboard')) {
    const rankKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('rank'));
    if (rankKey) data.sort((a, b) => (parseInt(a[rankKey]) || 999) - (parseInt(b[rankKey]) || 999));
  }
  if (sheetName.toLowerCase().startsWith('teams_')) {
    if (data.length && data[0].Total !== undefined) data.sort((a, b) => (parseFloat(b.Total) || 0) - (parseFloat(a.Total) || 0));
  }
  if (sheetName.toLowerCase().startsWith('stableford_')) {
    const totalRow = data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (totalRow) {
      const fixedCols = ['Hole', 'Par', 'SI'];
      const playerCols = Object.keys(data[0]).filter(k => !fixedCols.includes(k));
      const sorted = [...playerCols].sort((a, b) => (parseFloat(totalRow[b]) || 0) - (parseFloat(totalRow[a]) || 0));
      data = data.map(row => {
        const newRow = {};
        fixedCols.forEach(c => { if (c in row) newRow[c] = row[c]; });
        sorted.forEach(c => { newRow[c] = row[c] ?? ''; });
        return newRow;
      });
    }
  }
  return { sheet: { ...sd, data }, last_updated: cache.lastUpdated };
}

export async function getPlayerStats() {
  if (!cache.sheets) await fetchAndParse();
  const { sheetsData, roundData, courseMap } = cache.sheets;

  const allPlayers = {};
  const lbData = sheetsData['League Leaderboard']?.data || [];
  for (const row of lbData) {
    const name = row.Player;
    if (name && !isPlaceholderPlayer(name)) {
      allPlayers[name] = { name, total_points: row.Total || 0, rank: row.Rank || '', round_scores: {}, holes_data: [] };
    }
  }

  const courseNames = {};
  for (const [sName, sInfo] of Object.entries(sheetsData)) {
    if (!sName.toLowerCase().startsWith('stableford_')) continue;
    const rNum = sName.split('_')[1];
    courseNames[rNum] = sInfo.display_name;
    const totalRow = sInfo.data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (!totalRow) continue;
    const fixedCols = new Set(['Hole', 'Par', 'SI']);
    for (const [player, val] of Object.entries(totalRow)) {
      if (fixedCols.has(player) || isPlaceholderPlayer(player)) continue;
      if (!allPlayers[player]) allPlayers[player] = { name: player, total_points: 0, rank: '', round_scores: {}, holes_data: [] };
      const score = parseFloat(val) || 0;
      if (score > 0) allPlayers[player].round_scores[rNum] = score;
    }
  }

  for (const [rNum, rData] of Object.entries(roundData)) {
    if (!courseNames[rNum]) courseNames[rNum] = rData.courseName || `Round ${rNum}`;
    for (const [player, holes] of Object.entries(rData.playerHoles)) {
      if (isPlaceholderPlayer(player)) continue;
      if (!allPlayers[player]) allPlayers[player] = { name: player, total_points: 0, rank: '', round_scores: {}, holes_data: [] };
      allPlayers[player].holes_data.push(...holes);
    }
  }

  const playerStats = [];
  for (const pdata of Object.values(allPlayers)) {
    const roundsPlayed = Object.keys(pdata.round_scores).length;
    const totalPts = Object.values(pdata.round_scores).reduce((a, b) => a + b, 0);
    const holes = pdata.holes_data;
    const holesPlayed = holes.length;
    if (holesPlayed === 0 && totalPts === 0) continue;

    // Scoring categories with Hole-in-One and Albatross
    const holeInOnes = holes.filter(h => h.score === 1).length;
    const albatross = holes.filter(h => h.vs_par <= -3 && h.score > 1).length;
    const eagles = holes.filter(h => h.vs_par === -2 && h.score > 1).length;
    const birdies = holes.filter(h => h.vs_par === -1).length;
    const pars = holes.filter(h => h.vs_par === 0).length;
    const bogeys = holes.filter(h => h.vs_par === 1).length;
    const doublePlus = holes.filter(h => h.vs_par >= 2).length;

    const avgPerRound = roundsPlayed > 0 ? Math.round((totalPts / roundsPlayed) * 10) / 10 : 0;
    const avgPerHole = holesPlayed > 0 ? Math.round((totalPts / holesPlayed) * 100) / 100 : 0;
    const bestRound = Object.values(pdata.round_scores).length ? Math.max(...Object.values(pdata.round_scores)) : 0;
    let bestRoundName = '';
    if (Object.keys(pdata.round_scores).length) {
      const bestNum = Object.entries(pdata.round_scores).sort((a, b) => b[1] - a[1])[0][0];
      bestRoundName = courseNames[bestNum] || `Round ${bestNum}`;
    }
    const roundDetails = Object.entries(pdata.round_scores).sort(([a], [b]) => a.localeCompare(b))
      .map(([rn, rs]) => ({ round: rn, course: courseNames[rn] || `Round ${rn}`, score: rs }));

    playerStats.push({
      name: pdata.name, rank: pdata.rank, total_points: totalPts, rounds_played: roundsPlayed,
      holes_played: holesPlayed, avg_per_round: avgPerRound, avg_per_hole: avgPerHole,
      best_round: bestRound, best_round_name: bestRoundName,
      hole_in_ones: holeInOnes, albatross, eagles, birdies, pars, bogeys, double_bogeys_plus: doublePlus,
      round_details: roundDetails,
    });
  }
  playerStats.sort((a, b) => b.total_points - a.total_points);
  return { players: playerStats, last_updated: cache.lastUpdated };
}

export async function getSeasonOverview() {
  if (!cache.sheets) await fetchAndParse();
  const { sheetsData, roundData } = cache.sheets;

  const lbData = (sheetsData['League Leaderboard']?.data || []).filter(r => !isPlaceholderPlayer(r.Player));
  const lbSorted = [...lbData].sort((a, b) => (parseInt(a.Rank) || 999) - (parseInt(b.Rank) || 999));
  const teamData = sheetsData['Team Leaderboard']?.data || [];
  const teamSorted = [...teamData].sort((a, b) => (parseInt(a.Rank) || 999) - (parseInt(b.Rank) || 999));

  const topPlayers = lbSorted.slice(0, 3).map(r => ({ name: r.Player, total: r.Total || 0, rank: r.Rank || '' }));
  const topTeam = teamSorted[0] ? { name: teamSorted[0].Player, total: teamSorted[0].Total || 0, rank: teamSorted[0].Rank || '' } : null;
  const activePlayers = lbSorted.filter(r => (r.Total || 0) > 0).length;
  const courseColumns = Object.keys(lbSorted[0] || {}).filter(k => !['Player', 'Total', 'Rank'].includes(k));
  const coursesPlayed = courseColumns.filter(col => lbSorted.some(r => (r[col] || 0) > 0));

  let bestRound = { player: '', score: 0, course: '' };
  for (const [sName, sInfo] of Object.entries(sheetsData)) {
    if (!sName.toLowerCase().startsWith('stableford_')) continue;
    const totalRow = sInfo.data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (!totalRow) continue;
    for (const [k, v] of Object.entries(totalRow)) {
      if (['Hole', 'Par', 'SI'].includes(k) || isPlaceholderPlayer(k)) continue;
      const score = parseFloat(v) || 0;
      if (score > bestRound.score) bestRound = { player: k, score, course: sInfo.display_name };
    }
  }

  const playerTotals = {};
  let totalHoles = 0, totalRounds = 0;
  for (const rData of Object.values(roundData)) {
    for (const [player, holes] of Object.entries(rData.playerHoles)) {
      if (!holes.length || isPlaceholderPlayer(player)) continue;
      if (!playerTotals[player]) playerTotals[player] = { hio: 0, albatross: 0, eagles: 0, birdies: 0, holes: 0, rounds: 0 };
      playerTotals[player].rounds += 1;
      for (const h of holes) {
        playerTotals[player].holes += 1;
        if (h.score === 1) playerTotals[player].hio += 1;
        else if (h.vs_par <= -3) playerTotals[player].albatross += 1;
        else if (h.vs_par === -2) playerTotals[player].eagles += 1;
        else if (h.vs_par === -1) playerTotals[player].birdies += 1;
      }
    }
  }
  for (const s of Object.values(playerTotals)) { totalHoles += s.holes; totalRounds += s.rounds; }

  let eagleLeader = { player: '', count: 0 }, birdieLeader = { player: '', count: 0 };
  let hioLeader = { player: '', count: 0 }, albatrossLeader = { player: '', count: 0 };
  for (const [p, s] of Object.entries(playerTotals)) {
    if (s.eagles > eagleLeader.count) eagleLeader = { player: p, count: s.eagles };
    if (s.birdies > birdieLeader.count) birdieLeader = { player: p, count: s.birdies };
    if (s.hio > hioLeader.count) hioLeader = { player: p, count: s.hio };
    if (s.albatross > albatrossLeader.count) albatrossLeader = { player: p, count: s.albatross };
  }

  return {
    top_players: topPlayers, top_team: topTeam, active_players: activePlayers,
    total_players: lbSorted.length, courses_played: coursesPlayed,
    total_courses: cache.validRoundCount, total_round_slots: cache.totalRoundSlots,
    best_round: bestRound, eagle_leader: eagleLeader, birdie_leader: birdieLeader,
    hio_leader: hioLeader, albatross_leader: albatrossLeader,
    total_holes_played: totalHoles, total_rounds_played: totalRounds, last_updated: cache.lastUpdated,
  };
}

export async function refreshData() {
  cache = { workbook: null, sheets: null, lastUpdated: null, courseMap: {} };
  await fetchAndParse();
  return { message: 'Data refreshed', last_updated: cache.lastUpdated };
}

export async function getRoundForScoreEntry(roundNum) {
  if (!cache.sheets) await fetchAndParse();
  const { roundData, courseMap } = cache.sheets;
  const rd = roundData[String(roundNum)];
  if (!rd || !rd.isSetUp) return null;

  // Get all real player names from league leaderboard
  const lbData = cache.sheets.sheetsData['League Leaderboard']?.data || [];
  const players = lbData.map(r => r.Player).filter(n => n && !isPlaceholderPlayer(n));

  // Get hole pars from round sheet
  const wb = cache.workbook;
  const ws = wb.Sheets[`Round_${roundNum}`];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const allRows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : null);
    }
    allRows.push(row);
  }

  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i][0] && String(allRows[i][0]).trim().toLowerCase() === 'hole') { headerIdx = i; break; }
  }
  if (headerIdx === -1) return null;

  const headers = allRows[headerIdx].map((h, i) => h ? String(h) : `Col_${i}`);
  const parIdx = headers.indexOf('Par');
  const siIdx = headers.indexOf('SI');

  const holes = [];
  const existingScores = {};

  for (let r = headerIdx + 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row[0]) continue;
    const holeVal = String(row[0]).trim().toUpperCase();
    if (holeVal === 'TOTAL' || holeVal === '') continue;

    const holeNum = parseInt(row[0]);
    const par = parIdx >= 0 ? parseInt(row[parIdx]) || 0 : 0;
    const si = siIdx >= 0 ? parseInt(row[siIdx]) || 0 : 0;
    holes.push({ hole: holeNum, par, si });

    // Get existing scores for each player
    for (const player of players) {
      const pIdx = headers.indexOf(player);
      if (pIdx >= 0) {
        const score = row[pIdx];
        if (score != null && score !== '' && score !== 0) {
          if (!existingScores[player]) existingScores[player] = {};
          existingScores[player][holeNum] = parseInt(score);
        }
      }
    }
  }

  return {
    roundNum, courseName: rd.courseName, courseRating: rd.courseRating,
    slopeRating: rd.slopeRating, coursePar: rd.coursePar,
    holes, players, existingScores,
  };
}

export function getSetUpRounds() {
  if (!cache.sheets) return [];
  const { roundData, courseMap } = cache.sheets;
  return Object.entries(roundData)
    .filter(([, rd]) => rd.isSetUp)
    .map(([num, rd]) => ({ num, courseName: rd.courseName || courseMap[num] || `Round ${num}` }));
}


export async function saveScoresToExcel(roundNum, player, scores) {
  /**
   * Modify the cached workbook with new scores and trigger a download.
   * User then uploads the file to OneDrive to sync.
   */
  if (!cache.workbook) await fetchAndParse();
  
  // Work on a copy so we don't mutate the cache
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const PROXY_URL = backendUrl ? `${backendUrl}/api/excel-proxy` : `/api/excel-proxy`;
  const response = await fetch(`${PROXY_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch Excel');
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = `Round_${roundNum}`;
  if (!wb.SheetNames.includes(sheetName)) throw new Error(`Sheet ${sheetName} not found`);
  const ws = wb.Sheets[sheetName];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const allRows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push({ addr, cell: ws[addr] || null, value: ws[addr]?.v ?? null });
    }
    allRows.push(row);
  }

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i][0].value && String(allRows[i][0].value).trim().toLowerCase() === 'hole') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Could not find header row');

  // Find player column
  let playerCol = -1;
  for (let c = 0; c < allRows[headerIdx].length; c++) {
    if (allRows[headerIdx][c].value && String(allRows[headerIdx][c].value).trim() === player) {
      playerCol = c;
      break;
    }
  }
  if (playerCol === -1) throw new Error(`Player ${player} not found in sheet`);

  // Write scores
  for (let r = headerIdx + 1; r < allRows.length; r++) {
    const holeVal = allRows[r][0].value;
    if (holeVal == null) continue;
    const holeStr = String(holeVal).trim().toUpperCase();
    if (holeStr === 'TOTAL' || holeStr === '') continue;
    const holeNum = parseInt(holeVal);
    if (scores[holeNum] != null && scores[holeNum] !== '') {
      const addr = XLSX.utils.encode_cell({ r, c: playerCol });
      ws[addr] = { t: 'n', v: parseInt(scores[holeNum]) };
    }
  }

  // Generate and download
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Pellies Golf League 2026.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true };
}

