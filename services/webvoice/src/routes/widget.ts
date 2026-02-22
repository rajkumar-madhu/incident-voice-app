import { Router, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/widget.js', (_req: Request, res: Response) => {
  const widgetPath = path.join(__dirname, '..', '..', 'public', 'widget', 'widget.js');
  res.sendFile(widgetPath);
});

router.get('/widget/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      websocket_url: `${req.protocol}://${req.get('host')}`,
      sample_rate: config.audioSampleRate,
      max_session_duration_ms: config.maxSessionDurationMs,
    },
  });
});

export default router;
