import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authRouter } from './routes/auth';
import { epistemicRouter } from './routes/epistemic/index';
import { loopRouter } from './routes/loop';
import { cockpitRouter } from './routes/cockpit';
import { oracleRouter } from './routes/oracle';

// Initialise DB (creates tables on first run)
import './db';

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Static assets ───────────────────────────────────────────────────────────
// index.html must always revalidate so users never see stale SPA shells.
// Other static assets (CSS, JS, images) can cache normally.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// ─── API ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/epistemic', epistemicRouter);
app.use('/api/loop', loopRouter);
app.use('/api/cockpit', cockpitRouter);
app.use('/api/oracle', oracleRouter);

app.get('/api/health', (_, res) => {
  const volPath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const dbFile = volPath ? `${volPath}/lumen.db` : 'lumen.db (ephemeral)';
  const fs = require('fs');
  const dbExists = fs.existsSync(volPath ? `${volPath}/lumen.db` : require('path').resolve(process.cwd(), 'lumen.db'));
  const dbSize = dbExists ? (fs.statSync(volPath ? `${volPath}/lumen.db` : require('path').resolve(process.cwd(), 'lumen.db')).size / 1024).toFixed(1) + ' KB' : 'N/A';
  res.json({
    ok: true,
    service: 'lumen',
    persistence: {
      volumeMounted: !!volPath,
      volumePath: volPath ?? '(none)',
      dbFile,
      dbExists,
      dbSize,
    },
  });
});

// ─── Fallback — serve the shell for all non-API routes ───────────────────────
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Lumen] Server running on port ${PORT}`);
});
