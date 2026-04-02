# 🎵 X Music Downloader — Full Stack

A self-hosted music downloader with a Node.js/Express backend powered by **yt-dlp** and a sleek dark frontend.

---

## 📁 Project Structure

```
x-music-downloader/
├── server.js          ← Express backend
├── package.json
├── .env.example
└── public/
    └── index.html     ← Frontend (served by the backend)
```

---

## ⚙️ Requirements

| Tool     | Version   | Install                                    |
|----------|-----------|--------------------------------------------|
| Node.js  | 16+       | https://nodejs.org                         |
| yt-dlp   | Latest    | `pip install yt-dlp` or `brew install yt-dlp` |
| ffmpeg   | Any       | `brew install ffmpeg` / `apt install ffmpeg` |

---

## 🚀 Quick Start

### 1. Install system dependencies

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg -y
pip install yt-dlp
```

**Windows:**
```bash
winget install yt-dlp
winget install ffmpeg
```

### 2. Install Node packages

```bash
npm install
```

### 3. Start the server

```bash
npm start
# → http://localhost:3001
```

For development with auto-reload:
```bash
npm run dev
```

### 4. Open the app

Visit **http://localhost:3001** in your browser.  
The frontend is served automatically from the `public/` folder.

---

## 🔌 API Endpoints

### `GET /api/health`
Returns server status.

```json
{ "status": "ok", "version": "1.0.0", "service": "X Music Downloader" }
```

---

### `GET /api/info?url=<URL>`
Fetches track metadata without downloading.

**Response:**
```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "duration": "3:42",
  "thumbnail": "https://...",
  "platform": "Youtube",
  "year": "2023",
  "id": "dQw4w9WgXcQ"
}
```

---

### `GET /api/download?url=<URL>&format=MP3&bitrate=320`
Downloads and streams the audio file to the client.

**Parameters:**

| Param     | Default | Options              |
|-----------|---------|----------------------|
| `url`     | —       | Any yt-dlp URL       |
| `format`  | `MP3`   | MP3, FLAC, WAV, AAC  |
| `bitrate` | `320`   | 64, 96, 128, 192, 256, 320 |

**Response:** Binary audio file stream with `Content-Disposition` header.

---

## 🌐 Supported Sites

yt-dlp supports 1000+ sites including:

- **YouTube** (videos, playlists, shorts)
- **SoundCloud**
- **Bandcamp**
- **Vimeo**
- **Twitter/X**
- **Reddit**
- **TikTok**
- **Twitch** (VODs, clips)
- ...and many more: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

> **Note:** Spotify and Apple Music links are not directly supported by yt-dlp as they use DRM. Use YouTube links for those songs instead.

---

## 📝 Notes

- Downloaded files are temporarily stored in your OS temp folder and auto-deleted after 1 hour.
- This tool is intended for **personal use only**. Respect copyright laws in your country.
- No user data is logged or stored.

---

## 🛠 Troubleshooting

**"yt-dlp not found"** → Make sure yt-dlp is installed and in your PATH. Run `yt-dlp --version` to verify.

**"ffmpeg not found"** → ffmpeg is required for audio conversion. Install it and ensure it's in your PATH.

**CORS errors** → Make sure the frontend is accessing the backend at the correct URL (set via the API config box in the UI).

**Download fails** → Some sites require cookies or login. Use `yt-dlp --cookies-from-browser chrome <url>` in your terminal to test.
