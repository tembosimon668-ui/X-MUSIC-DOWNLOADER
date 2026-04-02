const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Temp directory for downloads
const TMP_DIR = path.join(os.tmpdir(), 'xmusic');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── UTILS ───────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
}

function getYtDlpFormat(format, bitrate) {
  switch (format.toUpperCase()) {
    case 'MP3':  return `bestaudio/best`;
    case 'FLAC': return `bestaudio[ext=flac]/bestaudio/best`;
    case 'WAV':  return `bestaudio/best`;
    case 'AAC':  return `bestaudio[ext=m4a]/bestaudio/best`;
    default:     return `bestaudio/best`;
  }
}

function getPostProcessor(format, bitrate) {
  const fmt = format.toUpperCase();
  switch (fmt) {
    case 'MP3':  return ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`];
    case 'FLAC': return ['--extract-audio', '--audio-format', 'flac'];
    case 'WAV':  return ['--extract-audio', '--audio-format', 'wav'];
    case 'AAC':  return ['--extract-audio', '--audio-format', 'aac', '--audio-quality', `${bitrate}K`];
    default:     return ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', '320K'];
  }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'X Music Downloader' });
});

// Fetch track metadata
app.get('/api/info', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const cmd = `yt-dlp --dump-json --no-playlist --quiet "${url}"`;

  exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('yt-dlp info error:', stderr);
      return res.status(400).json({ error: 'Could not fetch track info. Check the URL and try again.' });
    }

    try {
      const data = JSON.parse(stdout);
      res.json({
        title:      data.title        || 'Unknown Title',
        artist:     data.uploader     || data.artist || data.channel || 'Unknown Artist',
        album:      data.album        || null,
        duration:   formatDuration(data.duration),
        thumbnail:  data.thumbnail    || null,
        platform:   data.extractor_key || data.ie_key || 'Unknown',
        year:       data.upload_date  ? data.upload_date.substring(0, 4) : null,
        webpage_url: data.webpage_url || url,
        id:         data.id,
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse track info.' });
    }
  });
});

// Download track — streams file to client
app.get('/api/download', (req, res) => {
  const { url, format = 'MP3', bitrate = '320' } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const fmt     = format.toUpperCase();
  const ext     = fmt.toLowerCase() === 'aac' ? 'm4a' : fmt.toLowerCase();
  const tmpFile = path.join(TMP_DIR, `xmusic_${Date.now()}.%(ext)s`);
  const ppArgs  = getPostProcessor(fmt, bitrate);

  const args = [
    url,
    '--no-playlist',
    '--quiet',
    '-o', tmpFile,
    '--embed-thumbnail',
    '--add-metadata',
    ...ppArgs,
  ];

  console.log(`[download] Starting: ${url} → ${fmt} @ ${bitrate}kbps`);

  const ytdlp = spawn('yt-dlp', args);
  let outputPath = null;
  let errOutput  = '';

  ytdlp.stderr.on('data', (data) => { errOutput += data.toString(); });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp error:', errOutput);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed. ' + errOutput.slice(0, 200) });
      return;
    }

    // Find the output file (yt-dlp replaces %(ext)s)
    const tmpBase = tmpFile.replace('.%(ext)s', '');
    const possibleExts = [ext, 'mp3', 'flac', 'wav', 'm4a', 'ogg', 'opus', 'webm'];
    for (const e of possibleExts) {
      const candidate = `${tmpBase}.${e}`;
      if (fs.existsSync(candidate)) { outputPath = candidate; break; }
    }

    if (!outputPath) {
      // Glob search fallback
      const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(`xmusic_${path.basename(tmpBase).split('_')[1]}`));
      if (files.length) outputPath = path.join(TMP_DIR, files[0]);
    }

    if (!outputPath || !fs.existsSync(outputPath)) {
      if (!res.headersSent) res.status(500).json({ error: 'Output file not found after download.' });
      return;
    }

    const filename = sanitizeFilename(path.basename(outputPath));
    const mimeTypes = { mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus' };
    const fileExt   = path.extname(outputPath).slice(1).toLowerCase();
    const mime      = mimeTypes[fileExt] || 'application/octet-stream';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', fs.statSync(outputPath).size);

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on('end', () => {
      fs.unlink(outputPath, () => {});
      console.log(`[download] Done: ${filename}`);
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'File streaming failed.' });
    });
  });
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── CLEANUP OLD TMP FILES (older than 1h) ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  try {
    fs.readdirSync(TMP_DIR).forEach(file => {
      const fpath = path.join(TMP_DIR, file);
      const stat  = fs.statSync(fpath);
      if (now - stat.mtimeMs > 3600000) fs.unlinkSync(fpath);
    });
  } catch (e) {}
}, 60 * 60 * 1000);

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎵  X Music Downloader Backend`);
  console.log(`    Running at http://localhost:${PORT}`);
  console.log(`    Temp files: ${TMP_DIR}\n`);
});
