import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
router.get('/widget.js', (_req, res) => {
    const widgetPath = path.join(__dirname, '..', '..', 'public', 'widget', 'widget.js');
    res.sendFile(widgetPath);
});
// Integration pages
router.get('/integrations/finspot', (_req, res) => {
    const pagePath = path.join(__dirname, '..', '..', 'public', 'integrations', 'finspot.html');
    res.sendFile(pagePath);
});
router.get('/integrations/finspot-embed.js', (_req, res) => {
    const scriptPath = path.join(__dirname, '..', '..', 'public', 'integrations', 'finspot-embed.js');
    res.type('application/javascript').sendFile(scriptPath);
});
router.get('/widget/config', (req, res) => {
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
//# sourceMappingURL=widget.js.map
