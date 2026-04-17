import * as XLSX from 'xlsx';

const ONEDRIVE_LINK = 'https://onedrive.live.com/:x:/g/personal/1BCCA8DEB6977A15/IQDN9Z10kyLSSYIh8Pw_ZZmEAQ-Yfoor5y_U5bHCCMUayto?download=1';

const EXCLUDED_SHEETS = ['setup', 'teams', 'round_1', 'round_2', 'round_3', 'round_4', 'round_5'];
const ROUND_SHEETS = ['round_1', 'round_2', 'round_3', 'round_4', 'round_5'];

// Cache
let cache = { workbook: null, sheets: null, lastUpdated: null, courseMap: {} };

// --- Helpers ---
function shouldExclude(name) {
  return EXCLUDED_SHEETS.includes(name.toLowerCase());
}

function isRoundSheet(name) {
  return ROUND_SHEETS.includes(name.toLowerCase());
}

function formatSheetName(name, courseMap) {
  const match = name.match(/^(Stableford|Teams)_(\d+)$/i);
  if (match && courseMap) {
    const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const course = courseMap[match[2]] || `Round ${match[2]}`;
    return `${prefix} - ${course}`;
  }
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function parseSheet(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.filter(row => Object.values(row).some(v => String(v).trim() !== ''));
}

function parseRoundSheet(ws) {
  // Round sheets have metadata rows before the actual data
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

  // Find header row (contains 'Hole')
  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i][0] && String(allRows[i][0]).trim().toLowerCase() === 'hole') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { courseName: '', playerHoles: {} };

  const courseName = allRows[0] && allRows[0][1] ? String(allRows[0][1]) : '';
  const headers = allRows[headerIdx].map((h, i) => h ? String(h) : `Col_${i}`);
  const fixed = new Set(['Hole', 'Par', 'SI']);
  const playerCols = headers.filter(h => !fixed.has(h) && !h.startsWith('Col_'));
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
        round: String(allRows[0][1] || r),
        hole: row[0],
        par: parNum,
        score: scoreNum,
        vs_par: scoreNum - parNum,
      });
    }
  }

  return { courseName, playerHoles };
}

// --- Core: Fetch & Parse ---
async function fetchAndParse() {
  // Use relative URL for Vercel, or REACT_APP_BACKEND_URL for Emergent
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const PROXY_URL = backendUrl ? `${backendUrl}/api/excel-proxy` : `/api/excel-proxy`;

  const response = await fetch(PROXY_URL);
  if (!response.ok) throw new Error(`Proxy fetch failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  // Build course map from League Leaderboard
  const courseMap = {};
  if (wb.SheetNames.includes('League Leaderboard')) {
    const lbWs = wb.Sheets['League Leaderboard'];
    const lbData = XLSX.utils.sheet_to_json(lbWs, { defval: '' });
    if (lbData.length > 0) {
      const keys = Object.keys(lbData[0]).filter(k => !['Player', 'Total', 'Rank'].includes(k));
      keys.forEach((k, i) => { courseMap[String(i + 1)] = k; });
    }
  }

  // Parse display sheets
  const sheetsData = {};
  const sheetList = [];
  for (const name of wb.SheetNames) {
    if (shouldExclude(name)) continue;
    const ws = wb.Sheets[name];
    const data = parseSheet(ws);
    const displayName = formatSheetName(name, courseMap);
    sheetsData[name] = { name, display_name: displayName, data };
    sheetList.push({ name, display_name: displayName });
  }

  // Parse round sheets for stroke data
  const roundData = {};
  for (const name of wb.SheetNames) {
    if (!isRoundSheet(name)) continue;
    const num = name.split('_')[1];
    const ws = wb.Sheets[name];
    const parsed = parseRoundSheet(ws);
    roundData[num] = parsed;
  }

  cache = {
    workbook: wb,
    sheets: { sheetsData, sheetList, roundData, courseMap },
    lastUpdated: new Date().toISOString(),
    courseMap,
  };

  return cache;
}

// --- Public API (mirrors the old backend endpoints) ---

export async function getSheets() {
  if (!cache.sheets) await fetchAndParse();
  return { sheets: cache.sheets.sheetList, last_updated: cache.lastUpdated };
}

export async function getSheetData(sheetName) {
  if (!cache.sheets) await fetchAndParse();
  const sd = cache.sheets.sheetsData[sheetName];
  if (!sd) throw new Error('Sheet not found');

  let data = [...sd.data];

  // Leaderboard: sort by rank
  if (sheetName.toLowerCase().includes('leaderboard')) {
    const rankKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('rank'));
    if (rankKey) {
      data.sort((a, b) => {
        const ra = parseInt(a[rankKey]) || 999;
        const rb = parseInt(b[rankKey]) || 999;
        return ra - rb;
      });
    }
  }

  // Teams: sort by Total descending
  if (sheetName.toLowerCase().startsWith('teams_')) {
    if (data.length && data[0].Total !== undefined) {
      data.sort((a, b) => (parseFloat(b.Total) || 0) - (parseFloat(a.Total) || 0));
    }
  }

  // Stableford: reorder player columns by total descending
  if (sheetName.toLowerCase().startsWith('stableford_')) {
    const totalRow = data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (totalRow) {
      const fixedCols = ['Hole', 'Par', 'SI'];
      const playerCols = Object.keys(data[0]).filter(k => !fixedCols.includes(k));
      const sorted = [...playerCols].sort((a, b) => {
        const va = parseFloat(totalRow[a]) || 0;
        const vb = parseFloat(totalRow[b]) || 0;
        return vb - va;
      });
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

  // Collect from League Leaderboard
  const allPlayers = {};
  const lbData = sheetsData['League Leaderboard']?.data || [];
  for (const row of lbData) {
    const name = row.Player;
    if (name) {
      allPlayers[name] = { name, total_points: row.Total || 0, rank: row.Rank || '', round_scores: {}, holes_data: [] };
    }
  }

  // Stableford totals for round_scores
  const courseNames = {};
  for (const [sName, sInfo] of Object.entries(sheetsData)) {
    if (!sName.toLowerCase().startsWith('stableford_')) continue;
    const rNum = sName.split('_')[1];
    courseNames[rNum] = sInfo.display_name;
    const totalRow = sInfo.data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (!totalRow) continue;
    const fixedCols = new Set(['Hole', 'Par', 'SI']);
    for (const [player, val] of Object.entries(totalRow)) {
      if (fixedCols.has(player)) continue;
      if (!allPlayers[player]) {
        allPlayers[player] = { name: player, total_points: 0, rank: '', round_scores: {}, holes_data: [] };
      }
      const score = parseFloat(val) || 0;
      if (score > 0) allPlayers[player].round_scores[rNum] = score;
    }
  }

  // Merge stroke data from Round sheets
  for (const [rNum, rData] of Object.entries(roundData)) {
    if (!courseNames[rNum]) courseNames[rNum] = rData.courseName || `Round ${rNum}`;
    for (const [player, holes] of Object.entries(rData.playerHoles)) {
      if (!allPlayers[player]) {
        allPlayers[player] = { name: player, total_points: 0, rank: '', round_scores: {}, holes_data: [] };
      }
      allPlayers[player].holes_data.push(...holes);
    }
  }

  // Compute stats
  const playerStats = [];
  for (const pdata of Object.values(allPlayers)) {
    const roundsPlayed = Object.keys(pdata.round_scores).length;
    const totalPts = Object.values(pdata.round_scores).reduce((a, b) => a + b, 0);
    const holes = pdata.holes_data;
    const holesPlayed = holes.length;
    if (holesPlayed === 0 && totalPts === 0) continue;

    const eaglesPlus = holes.filter(h => h.vs_par <= -2).length;
    const birdies = holes.filter(h => h.vs_par === -1).length;
    const pars = holes.filter(h => h.vs_par === 0).length;
    const bogeys = holes.filter(h => h.vs_par === 1).length;
    const doublePlus = holes.filter(h => h.vs_par >= 2).length;

    const avgPerRound = roundsPlayed > 0 ? Math.round((totalPts / roundsPlayed) * 10) / 10 : 0;
    const avgPerHole = holesPlayed > 0 ? Math.round((totalPts / holesPlayed) * 100) / 100 : 0;
    const bestRound = pdata.round_scores ? Math.max(...Object.values(pdata.round_scores), 0) : 0;
    let bestRoundName = '';
    if (Object.keys(pdata.round_scores).length) {
      const bestNum = Object.entries(pdata.round_scores).sort((a, b) => b[1] - a[1])[0][0];
      bestRoundName = courseNames[bestNum] || `Round ${bestNum}`;
    }

    const roundDetails = Object.entries(pdata.round_scores)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rn, rs]) => ({ round: rn, course: courseNames[rn] || `Round ${rn}`, score: rs }));

    playerStats.push({
      name: pdata.name, rank: pdata.rank, total_points: totalPts, rounds_played: roundsPlayed,
      holes_played: holesPlayed, avg_per_round: avgPerRound, avg_per_hole: avgPerHole,
      best_round: bestRound, best_round_name: bestRoundName,
      eagles_plus: eaglesPlus, birdies, pars, bogeys, double_bogeys_plus: doublePlus,
      round_details: roundDetails,
    });
  }

  playerStats.sort((a, b) => b.total_points - a.total_points);
  return { players: playerStats, last_updated: cache.lastUpdated };
}

export async function getSeasonOverview() {
  if (!cache.sheets) await fetchAndParse();
  const { sheetsData, roundData } = cache.sheets;

  const lbData = sheetsData['League Leaderboard']?.data || [];
  const lbSorted = [...lbData].sort((a, b) => (parseInt(a.Rank) || 999) - (parseInt(b.Rank) || 999));
  const teamData = sheetsData['Team Leaderboard']?.data || [];
  const teamSorted = [...teamData].sort((a, b) => (parseInt(a.Rank) || 999) - (parseInt(b.Rank) || 999));

  const topPlayers = lbSorted.slice(0, 3).map(r => ({ name: r.Player, total: r.Total || 0, rank: r.Rank || '' }));
  const topTeam = teamSorted[0] ? { name: teamSorted[0].Player, total: teamSorted[0].Total || 0, rank: teamSorted[0].Rank || '' } : null;
  const activePlayers = lbSorted.filter(r => (r.Total || 0) > 0).length;
  const courseColumns = Object.keys(lbSorted[0] || {}).filter(k => !['Player', 'Total', 'Rank'].includes(k));
  const coursesPlayed = courseColumns.filter(col => lbSorted.some(r => (r[col] || 0) > 0));

  // Best round from Stableford sheets
  let bestRound = { player: '', score: 0, course: '' };
  for (const [sName, sInfo] of Object.entries(sheetsData)) {
    if (!sName.toLowerCase().startsWith('stableford_')) continue;
    const totalRow = sInfo.data.find(r => String(r.Hole || '').toUpperCase() === 'TOTAL');
    if (!totalRow) continue;
    for (const [k, v] of Object.entries(totalRow)) {
      if (['Hole', 'Par', 'SI'].includes(k)) continue;
      const score = parseFloat(v) || 0;
      if (score > bestRound.score) bestRound = { player: k, score, course: sInfo.display_name };
    }
  }

  // Eagle/birdie leaders from round data
  const playerTotals = {};
  let totalHoles = 0, totalRounds = 0;
  for (const rData of Object.values(roundData)) {
    for (const [player, holes] of Object.entries(rData.playerHoles)) {
      if (!holes.length) continue;
      if (!playerTotals[player]) playerTotals[player] = { eagles: 0, birdies: 0, holes: 0, rounds: 0 };
      playerTotals[player].rounds += 1;
      for (const h of holes) {
        playerTotals[player].holes += 1;
        if (h.vs_par <= -2) playerTotals[player].eagles += 1;
        else if (h.vs_par === -1) playerTotals[player].birdies += 1;
      }
    }
  }
  for (const s of Object.values(playerTotals)) { totalHoles += s.holes; totalRounds += s.rounds; }

  let eagleLeader = { player: '', count: 0 }, birdieLeader = { player: '', count: 0 };
  for (const [p, s] of Object.entries(playerTotals)) {
    if (s.eagles > eagleLeader.count) eagleLeader = { player: p, count: s.eagles };
    if (s.birdies > birdieLeader.count) birdieLeader = { player: p, count: s.birdies };
  }

  return {
    top_players: topPlayers, top_team: topTeam, active_players: activePlayers,
    total_players: lbSorted.length, courses_played: coursesPlayed, total_courses: courseColumns.length,
    best_round: bestRound, eagle_leader: eagleLeader, birdie_leader: birdieLeader,
    total_holes_played: totalHoles, total_rounds_played: totalRounds, last_updated: cache.lastUpdated,
  };
}

export async function refreshData() {
  cache = { workbook: null, sheets: null, lastUpdated: null, courseMap: {} };
  await fetchAndParse();
  return { message: 'Data refreshed', last_updated: cache.lastUpdated };
}
