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
