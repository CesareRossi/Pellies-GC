// Vercel Serverless Function — proxies OneDrive Excel download
// Deploy this alongside the React app on Vercel

const https = require('https');
const http = require('http');

const ONEDRIVE_URL = 'https://onedrive.live.com/:x:/g/personal/1BCCA8DEB6977A15/IQDN9Z10kyLSSYIh8Pw_ZZmEAQ-Yfoor5y_U5bHCCMUayto?download=1';

function followRedirects(url, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(followRedirects(next, maxRedirects - 1));
      } else if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const buffer = await followRedirects(ONEDRIVE_URL);
    // Verify it's an xlsx file (PK zip magic bytes)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return res.status(502).json({ error: 'Invalid Excel file received from OneDrive' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
