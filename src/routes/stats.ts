import { Router, Response } from 'express'; //Request
import { parseMatchLog } from '../services/parser';

const router = Router();
const MATCH_LOG_URL = 'https://blast-recruiting.s3.eu-central-1.amazonaws.com/NAVIvsVitaGF-Nuke.txt';

router.get('/test', (_, res: Response) => {
  res.json({ message: "Stats API is working!" });
});

// Endpoint to parse the match log and get stats
router.get('/match-stats', async (_, res: Response) => {
    try {
      const stats = await parseMatchLog(MATCH_LOG_URL);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

export default router;
