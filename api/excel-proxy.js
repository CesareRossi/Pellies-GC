// Vercel Serverless Function — proxies OneDrive Excel download
// Method 1: curl (handles OneDrive redirects + cookies natively)
// Method 2: Node.js manual redirect with cookie forwarding (fallback)

const { execSync } = require('child_process');
const { readFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const https = require('https');

const ONEDRIVE_URL = 'https://onedrive.live.com/:x:/g/personal/1BCCA8DEB6977A15/IQDN9Z10kyLSSYIh8Pw_ZZmEAQ-Yfoor5y_U5bHCCMUayto?download=1';

// Method 1: curl with cookie jar
function downloadWithCurl() {
  const tmpFile = join(tmpdir(), `excel-${Date.now()}.xlsx`);
  const cookieFile = join(tmpdir(), `cookies-${Date.now()}.txt`);
  try {
    execSync(
      `curl -sL -o "${tmpFile}" -c "${cookieFile}" -b "${cookieFile}" ` +
      `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
      `"${ONEDRIVE_URL}"`,
      { timeout: 25000 }
    );
    const buffer = readFileSync(tmpFile);
    try { unlinkSync(tmpFile); } catch (e) {}
    try { unlinkSync(cookieFile); } catch (e) {}
    return buffer;
  } catch (err) {
    try { unlinkSync(tmpFile); } catch (e) {}
    try { unlinkSync(cookieFile); } catch (e) {}
    throw err;
  }
}

// Method 2: Node.js with manual cookie forwarding
function downloadWithNodeJS() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    };

    // Step 1: Get the redirect + cookies
    https.get(ONEDRIVE_URL, options, (res1) => {
      const cookies = (res1.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

      if (res1.statusCode >= 300 && res1.statusCode < 400 && res1.headers.location) {
        const redirectUrl = res1.headers.location.startsWith('http')
          ? res1.headers.location
          : `https://onedrive.live.com${res1.headers.location}`;

        // Step 2: Follow redirect with cookies
        const opts2 = {
          headers: {
            ...options.headers,
            'Cookie': cookies,
          }
        };

        https.get(redirectUrl, opts2, (res2) => {
          if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
            // Follow one more redirect if needed
            const finalUrl = res2.headers.location.startsWith('http')
              ? res2.headers.location
              : `https://onedrive.live.com${res2.headers.location}`;
            const cookies2 = [cookies, ...(res2.headers['set-cookie'] || []).map(c => c.split(';')[0])].filter(Boolean).join('; ');

            https.get(finalUrl, { headers: { ...options.headers, 'Cookie': cookies2 } }, (res3) => {
              const chunks = [];
              res3.on('data', chunk => chunks.push(chunk));
              res3.on('end', () => resolve(Buffer.concat(chunks)));
              res3.on('error', reject);
            }).on('error', reject);
          } else if (res2.statusCode === 200) {
            const chunks = [];
            res2.on('data', chunk => chunks.push(chunk));
            res2.on('end', () => resolve(Buffer.concat(chunks)));
            res2.on('error', reject);
          } else {
            reject(new Error(`Redirect request returned ${res2.statusCode}`));
          }
        }).on('error', reject);
      } else if (res1.statusCode === 200) {
        const chunks = [];
        res1.on('data', chunk => chunks.push(chunk));
        res1.on('end', () => resolve(Buffer.concat(chunks)));
        res1.on('error', reject);
      } else {
        reject(new Error(`Initial request returned ${res1.statusCode}`));
      }
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let buffer;

    // Try curl first (most reliable)
    try {
      buffer = downloadWithCurl();
      console.log(`curl download: ${buffer.length} bytes`);
    } catch (curlErr) {
      console.log('curl failed, falling back to Node.js:', curlErr.message);
      buffer = await downloadWithNodeJS();
      console.log(`Node.js download: ${buffer.length} bytes`);
    }

    // Verify it's an Excel file
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      console.error('Not Excel. Size:', buffer.length, 'Start:', buffer.slice(0, 100).toString('utf-8'));
      return res.status(502).json({
        error: 'OneDrive returned a login page instead of the Excel file.',
        hint: 'Ensure the file is shared as "Anyone with the link can view".',
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Always serve fresh workbook data (no edge/browser caching).
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Excel proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
