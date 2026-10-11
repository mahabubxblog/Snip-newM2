import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API route for Admin password verification ("Ma44332211")
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === 'Ma44332211') {
    res.json({ success: true, message: 'Authenticated successfully' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
});

// In-memory cache for live videos list
let cachedVideosList: unknown[] | null = null;
const videosFilePath = path.join(__dirname, 'public', 'videos.json');

// GET /api/videos - returns the latest live videos
app.get('/api/videos', async (_req, res) => {
  try {
    if (cachedVideosList && Array.isArray(cachedVideosList) && cachedVideosList.length > 0) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.json(cachedVideosList);
    }

    const fs = await import('fs/promises');
    try {
      const data = await fs.readFile(videosFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        cachedVideosList = parsed;
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json(parsed);
      }
    } catch {
      // ignore
    }

    return res.json([]);
  } catch (err) {
    console.error('Error fetching /api/videos:', err);
    return res.status(500).json({ error: 'Failed to load videos' });
  }
});

// POST /api/videos - updates the live videos across all connected devices
app.post('/api/videos', async (req, res) => {
  try {
    const { password, videos } = req.body;
    if (password !== 'Ma44332211') {
      return res.status(401).json({ success: false, message: 'Unauthorized. Admin password required.' });
    }

    if (!Array.isArray(videos)) {
      return res.status(400).json({ success: false, message: 'Invalid video list format.' });
    }

    cachedVideosList = videos;

    // Persist to public/videos.json
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(videosFilePath, JSON.stringify(videos, null, 2), 'utf-8');
    } catch (writeErr) {
      console.warn('Could not persist to public/videos.json file:', writeErr);
    }

    res.json({
      success: true,
      count: videos.length,
      updatedAt: new Date().toISOString(),
      message: 'ভিডিও সফলভাবে ক্লাউড সার্ভারে আপডেট করা হয়েছে!'
    });
  } catch (err) {
    console.error('Error saving /api/videos:', err);
    res.status(500).json({ success: false, message: 'Server error saving videos' });
  }
});

// Serve static assets from dist if built
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('SnipTok API is ready. Please build client with `npm run build` for static preview.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`SnipTok server listening on port ${PORT}`);
});
