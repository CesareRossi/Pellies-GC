import { getAccessToken } from './msalConfig';
import * as XLSX from 'xlsx';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

/**
 * Find the Excel file on the user's OneDrive by searching for it.
 * Returns the driveItem ID if found.
 */
async function findExcelFile(token) {
  // Search for the file by name
  const searchUrl = `${GRAPH_API}/me/drive/root/search(q='Pellies Golf League 2026')`;
  const resp = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  const data = await resp.json();
  const file = data.value?.find(
    (f) => f.name && f.name.toLowerCase().includes('pellies golf league 2026') && f.name.endsWith('.xlsx')
  );
  if (!file) throw new Error('Excel file not found on OneDrive. Make sure "Pellies Golf League 2026.xlsx" exists.');
  return file;
}

/**
 * Download the current Excel file from OneDrive using Graph API.
 */
async function downloadExcelFromOneDrive(token, fileId) {
  const url = `${GRAPH_API}/me/drive/items/${fileId}/content`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  return await resp.arrayBuffer();
}

/**
 * Upload the modified Excel file back to OneDrive (replaces the existing file).
 */
async function uploadExcelToOneDrive(token, fileId, fileBytes) {
  const url = `${GRAPH_API}/me/drive/items/${fileId}/content`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: fileBytes,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Upload failed: ${resp.status} - ${errText}`);
  }
  return await resp.json();
}

/**
 * Save scores to OneDrive by:
 * 1. Downloading the Excel file via Graph API
 * 2. Modifying the Round sheet with new scores
 * 3. Uploading the modified file back
 */
export async function saveScoresToOneDrive(roundNum, player, scores) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Microsoft. Please sign in first.');

  // Step 1: Find the file
  const file = await findExcelFile(token);

  // Step 2: Download current version
  const arrayBuffer = await downloadExcelFromOneDrive(token, file.id);
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  // Step 3: Modify the Round sheet
  const sheetName = `Round_${roundNum}`;
  if (!wb.SheetNames.includes(sheetName)) throw new Error(`Sheet ${sheetName} not found`);
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Build rows array
  const allRows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push({ addr, value: ws[addr]?.v ?? null });
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
  if (headerIdx === -1) throw new Error('Could not find header row in sheet');

  // Find player column
  let playerCol = -1;
  for (let c = 0; c < allRows[headerIdx].length; c++) {
    if (allRows[headerIdx][c].value && String(allRows[headerIdx][c].value).trim() === player) {
      playerCol = c;
      break;
    }
  }
  if (playerCol === -1) throw new Error(`Player "${player}" not found in ${sheetName}`);

  // Write scores to cells
  let cellsUpdated = 0;
  for (let r = headerIdx + 1; r < allRows.length; r++) {
    const holeVal = allRows[r][0].value;
    if (holeVal == null) continue;
    const holeStr = String(holeVal).trim().toUpperCase();
    if (holeStr === 'TOTAL' || holeStr === '') continue;
    const holeNum = parseInt(holeVal);
    if (scores[holeNum] != null && scores[holeNum] !== '') {
      const addr = XLSX.utils.encode_cell({ r, c: playerCol });
      ws[addr] = { t: 'n', v: parseInt(scores[holeNum]) };
      cellsUpdated++;
    }
  }

  if (cellsUpdated === 0) throw new Error('No scores were written. Check hole numbers.');

  // Step 4: Generate modified file
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Step 5: Upload back to OneDrive
  const result = await uploadExcelToOneDrive(token, file.id, wbOut);

  return {
    success: true,
    cellsUpdated,
    fileName: result.name,
    lastModified: result.lastModifiedDateTime,
  };
}
