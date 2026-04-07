import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authRouter } from './routes/auth';
import { epistemicRouter } from './routes/epistemic';

// Initialise DB (creates tables on first run)
import './db';

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Static assets ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/epistemic', epistemicRouter);

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'lumen' }));

// ─── Fallback — serve the shell for all non-API routes ───────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Lumen] Server running on port ${PORT}`);
});
