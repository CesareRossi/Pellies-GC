// CRA dev proxy — handles /api/excel-proxy locally using child_process
// This only runs during `yarn start`, not in production builds

const { execSync } = require('child_process');
const { readFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const ONEDRIVE_URL = 'https://onedrive.live.com/:x:/g/personal/1BCCA8DEB6977A15/IQDN9Z10kyLSSYIh8Pw_ZZmEAQ-Yfoor5y_U5bHCCMUayto?download=1';

module.exports = function (app) {
  app.get('/api/excel-proxy', (req, res) => {
    const tmpFile = join(tmpdir(), `excel-${Date.now()}.xlsx`);
    const cookieFile = join(tmpdir(), `cookies-${Date.now()}.txt`);

    try {
      // Try curl first
      try {
        execSync(
          `curl -sL -o "${tmpFile}" -c "${cookieFile}" -b "${cookieFile}" ` +
          `-A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
          `"${ONEDRIVE_URL}"`,
          { timeout: 25000 }
        );
      } catch (e) {
        // Fallback to wget
        execSync(
          `wget -q --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
          `--max-redirect=10 -O "${tmpFile}" "${ONEDRIVE_URL}"`,
          { timeout: 25000 }
        );
      }

      const buffer = readFileSync(tmpFile);
      try { unlinkSync(tmpFile); } catch (e) {}
      try { unlinkSync(cookieFile); } catch (e) {}

      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return res.status(502).json({ error: 'OneDrive returned HTML instead of Excel' });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      try { unlinkSync(tmpFile); } catch (e) {}
      try { unlinkSync(cookieFile); } catch (e) {}
      res.status(500).json({ error: err.message });
    }
  });
};
