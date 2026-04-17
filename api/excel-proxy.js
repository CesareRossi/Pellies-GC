// Vercel Serverless Function — proxies OneDrive Excel download
// Uses curl (available on Vercel runtime) which properly handles OneDrive redirects + cookies

const { execSync } = require('child_process');
const { writeFileSync, readFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const ONEDRIVE_URL = 'https://onedrive.live.com/:x:/g/personal/1BCCA8DEB6977A15/IQDN9Z10kyLSSYIh8Pw_ZZmEAQ-Yfoor5y_U5bHCCMUayto?download=1';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tmpFile = join(tmpdir(), `excel-${Date.now()}.xlsx`);
  const cookieFile = join(tmpdir(), `cookies-${Date.now()}.txt`);

  try {
    // Use curl with cookie jar and redirect following (same as wget behavior)
    execSync(
      `curl -sL -o "${tmpFile}" -c "${cookieFile}" -b "${cookieFile}" ` +
      `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
      `"${ONEDRIVE_URL}"`,
      { timeout: 30000 }
    );

    const buffer = readFileSync(tmpFile);

    // Cleanup temp files
    try { unlinkSync(tmpFile); } catch (e) {}
    try { unlinkSync(cookieFile); } catch (e) {}

    // Verify it's an Excel file (PK zip magic bytes)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      console.error('Not an Excel file. Size:', buffer.length, 'First bytes:', buffer.slice(0, 50).toString('utf-8'));
      return res.status(502).json({
        error: 'OneDrive returned a login page instead of the Excel file.',
        hint: 'Please ensure the file sharing is set to "Anyone with the link can view".',
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(buffer);
  } catch (err) {
    // Cleanup on error
    try { unlinkSync(tmpFile); } catch (e) {}
    try { unlinkSync(cookieFile); } catch (e) {}
    console.error('Excel proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
