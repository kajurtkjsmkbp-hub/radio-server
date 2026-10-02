import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Global Radio Station State
let radioState = {
  online: true,
  isOnAir: true,
  isPlaying: false,
  currentTrack: {
    id: 'demo-1',
    title: 'Neon Horizon (Synthwave Overdrive)',
    artist: 'Khanza.NET Studio Orchestra',
    album: 'Cyber Radiance 2026',
    duration: 38,
    currentTime: 0,
    kbps: '320 kbps',
    khz: '48.0 kHz',
    audioUrl: null,
    isStream: false
  },
  djName: 'DJ_KHANZA_NET',
  listeners: 1,
  lastUpdated: Date.now()
};

// Global Live Chat & Reactions State
let chatMessages = [
  {
    id: 1,
    user: 'Andi_Jakarta',
    role: 'listener',
    text: 'Salam kenal dari Jakarta! Suara siarannya jernih banget min 📻✨',
    time: '10:02'
  },
  {
    id: 2,
    user: 'Siti_Bandung',
    role: 'listener',
    text: 'Request lagu Synthwave dong DJ! Selamat mengudara!',
    time: '10:04'
  },
  {
    id: 3,
    user: 'DJ_KHANZA_NET',
    role: 'dj',
    text: 'Selamat pagi pendengar setia Khanza.NET RADIO! Enjoy the stream & kirim salam kalian di shoutbox!',
    time: '10:05'
  },
  {
    id: 4,
    user: 'Budi_Surabaya',
    role: 'listener',
    text: 'Visualizer Winamp-nya keren parah nostalgia era 2000-an! 🔥🔥🔥',
    time: '10:06'
  }
];

let reactionsCount = 48;
let reactionDetails = {
  '❤️': 26,
  '🔥': 11,
  '👏': 5,
  '📻': 4,
  '⚡': 2
};

// Program Schedule Data Store
let programSchedule = [
  { id: 1, startTime: '06:00', endTime: '10:00', title: 'Morning Vibes & Semangat Pagi', dj: 'DJ Rian', tracks: [], avgTrackDuration: 210 },
  { id: 2, startTime: '10:00', endTime: '14:00', title: 'Work & Code Lo-Fi Chill', dj: 'DJ Khanza Pro', tracks: [], avgTrackDuration: 210 },
  { id: 3, startTime: '14:00', endTime: '18:00', title: 'Hits Pop Nusantara & Dunia', dj: 'DJ Maya', tracks: [], avgTrackDuration: 210 },
  { id: 4, startTime: '18:00', endTime: '22:00', title: 'Retro 80s Synthwave & Nostalgia', dj: 'DJ Reza', tracks: [], avgTrackDuration: 210 },
  { id: 5, startTime: '22:00', endTime: '02:00', title: 'Midnight Jazz & Acoustic Night', dj: 'DJ Dian', tracks: [], avgTrackDuration: 210 }
];

// Program Schedule File Persistence
const SCHEDULE_FILE = path.join(UPLOADS_DIR, 'schedule_data.json');
function saveScheduleToFile() {
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(programSchedule, null, 2));
  } catch (e) {
    console.error('Error saving schedule to file:', e);
  }
}
function loadScheduleFromFile() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        programSchedule = data;
        console.log(`[Jadwal] Berhasil memuat ${programSchedule.length} slot jadwal dari arsip lokal`);
      }
    }
  } catch (e) {
    console.error('Error loading schedule from file:', e);
  }
}
loadScheduleFromFile();

// Stream clients for live microphone/audio chunk relay
const streamClients = new Set();
let cachedHeaderChunk = null;

app.use(express.json());

// Helper to calculate exact duration of MP3 file from frames
function getMp3Duration(filePath) {
  try {
    const b = fs.readFileSync(filePath);
    let offset = 0;
    if (b.slice(0, 3).toString('ascii') === 'ID3') {
      const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
      offset = 10 + size;
    }
    let frameCount = 0;
    let totalDuration = 0;
    const bitrates = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0] };
    const sampleRates = { 1: [44100, 48000, 32000] };

    while (offset < b.length - 4) {
      if (b[offset] === 0xff && (b[offset + 1] & 0xe0) === 0xe0) {
        const ver = (b[offset + 1] >> 3) & 0x3;
        const layer = (b[offset + 1] >> 1) & 0x3;
        const brIdx = (b[offset + 2] >> 4) & 0xf;
        const srIdx = (b[offset + 2] >> 2) & 0x3;
        const padding = (b[offset + 2] >> 1) & 0x1;
        if (ver === 3 && layer === 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) {
          const br = bitrates[1][brIdx] * 1000;
          const sr = sampleRates[1][srIdx];
          const frameLength = Math.floor((144 * br) / sr) + padding;
          if (frameLength > 0 && offset + frameLength <= b.length) {
            frameCount++;
            totalDuration += 1152 / sr;
            offset += frameLength;
            continue;
          }
        }
      }
      offset++;
    }
    return Math.round(totalDuration);
  } catch (e) {
    return 210;
  }
}

// Serve static frontend files if built
app.use(express.static(path.join(__dirname, 'dist')));
// Serve uploaded track files directly for audio streaming with CORS & Range support
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Accept-Ranges', 'bytes');
  next();
}, express.static(UPLOADS_DIR));

// 1. Get current radio station state (Now Playing, On Air, Listeners)
app.get('/api/radio-state', (req, res) => {
  res.json(radioState);
});

// Alias for status
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    isOnAir: radioState.isOnAir,
    isPlaying: radioState.isPlaying,
    listeners: radioState.listeners,
    station: 'Khanza.NET RADIO BROADCAST SUITE',
    currentTrack: radioState.currentTrack,
    time: new Date().toISOString()
  });
});

// 2. Update radio state from DJ Console (Penyiar)
app.post('/api/radio-state', (req, res) => {
  const updates = req.body;
  radioState = {
    ...radioState,
    ...updates,
    lastUpdated: Date.now()
  };

  // Broadcast updated radio state to all connected listeners and DJ tabs
  broadcastRadioState();
  res.json({ success: true, state: radioState });
});

// 3. Upload local MP3 file from Penyiar's computer
app.post(
  '/api/upload-track',
  express.raw({ type: '*/*', limit: '100mb' }),
  (req, res) => {
    try {
      const buffer = req.body;
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'No audio data received' });
      }

      const rawTitle = req.headers['x-title'] || 'Audio Siaran Baru';
      const rawArtist = req.headers['x-artist'] || 'Penyiar Khanza.NET';
      const filename = 'current_broadcast_audio.mp3';
      const filePath = path.join(UPLOADS_DIR, filename);

      fs.writeFileSync(filePath, buffer);

      const title = decodeURIComponent(rawTitle);
      const artist = decodeURIComponent(rawArtist);

      radioState.currentTrack = {
        id: `track-${Date.now()}`,
        title,
        artist,
        album: 'Local Broadcast Storage',
        audioUrl: `/api/current-audio?t=${Date.now()}`,
        duration: 0,
        kbps: '320 kbps',
        khz: '44.1 kHz',
        isStream: false
      };
      radioState.isPlaying = true;
      radioState.lastUpdated = Date.now();

      // Notify all listeners immediately
      broadcastRadioState();

      console.log(`[Penyiar] File lagu baru diunggah: "${artist} - ${title}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      res.json({
        success: true,
        message: 'Lagu berhasil disiarkan ke semua pendengar!',
        currentTrack: radioState.currentTrack
      });
    } catch (err) {
      console.error('Error handling track upload:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// 4. Stream current audio file with Range support (seekable for all browsers)
app.get('/api/current-audio', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, 'current_broadcast_audio.mp3');

  if (!fs.existsSync(filePath)) {
    // If no custom upload yet, redirect to high-quality fallback stream
    return res.redirect('https://ice5.somafm.com/groovesalad-128-mp3');
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const partialstart = parts[0];
    const partialend = parts[1];

    const start = parseInt(partialstart, 10);
    const end = partialend ? parseInt(partialend, 10) : total - 1;
    const chunksize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache'
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// 5. Live Audio Streaming Relay Endpoint (WebM/Opus)
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'audio/webm; codecs=opus',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // If we have a cached WebM header from the broadcaster, send it first
  if (cachedHeaderChunk) {
    try {
      res.write(cachedHeaderChunk);
    } catch (e) {}
  }

  streamClients.add(res);
  updateOnlineListeners();

  req.on('close', () => {
    streamClients.delete(res);
    updateOnlineListeners();
  });
});

// Broadcast Chunk Ingester from DJ Console (Penyiar)
app.post('/api/broadcast-chunk', express.raw({ type: 'audio/*', limit: '10mb' }), (req, res) => {
  const chunk = req.body;
  if (!chunk || chunk.length === 0) return res.send('OK');

  if (req.headers['x-is-header'] === 'true' || !cachedHeaderChunk) {
    cachedHeaderChunk = chunk;
  }

  // Relay audio chunk to all active listening clients
  for (const client of streamClients) {
    try {
      client.write(chunk);
    } catch (e) {
      streamClients.delete(client);
    }
  }

  res.status(200).send('OK');
});

// 6. Live Chat & Reactions REST API
app.get('/api/chat', (req, res) => {
  res.json({
    messages: chatMessages,
    reactionsCount,
    reactionDetails
  });
});

app.post('/api/chat', (req, res) => {
  const { user, text, role } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  }

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const newMsg = {
    id: Date.now() + Math.random(),
    user: (user && user.trim()) || 'Pendengar_' + Math.floor(100 + Math.random() * 900),
    role: role === 'dj' ? 'dj' : 'listener',
    text: text.trim(),
    time: timeStr
  };

  chatMessages.push(newMsg);
  if (chatMessages.length > 100) {
    chatMessages.shift();
  }

  // Broadcast to all WS clients
  const payload = JSON.stringify({ type: 'CHAT_MESSAGE', message: newMsg });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) {}
    }
  });

  res.json({ success: true, message: newMsg });
});

app.post('/api/reaction', (req, res) => {
  const { emoji } = req.body;
  const targetEmoji = emoji || '❤️';
  reactionsCount += 1;
  reactionDetails[targetEmoji] = (reactionDetails[targetEmoji] || 0) + 1;

  const payload = JSON.stringify({
    type: 'LIVE_REACTION',
    emoji: targetEmoji,
    reactionsCount,
    reactionDetails
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) {}
    }
  });

  res.json({ success: true, emoji: targetEmoji, reactionsCount, reactionDetails });
});

app.post('/api/chat/clear', (req, res) => {
  chatMessages = [];
  const payload = JSON.stringify({ type: 'CLEAR_CHAT' });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) {}
    }
  });
  res.json({ success: true, message: 'Chat berhasil dibersihkan' });
});

// Function to accurately calculate live active listeners
function updateOnlineListeners() {
  const activeListenerClients = new Set();
  const activeDjs = new Set();

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (client.role === 'dj') {
        activeDjs.add(client.clientId || client);
      } else {
        // Listener client
        activeListenerClients.add(client.clientId || client);
      }
    }
  });

  const streamCount = streamClients.size;
  const totalListeners = Math.max(streamCount, activeListenerClients.size);

  radioState.listeners = totalListeners;
  radioState.streamClientsCount = streamCount;

  broadcastRadioState();
}

// 7. WebSocket for Live Sync (Radio State, Chat, Reactions)
wss.on('connection', (ws, req) => {
  // Extract role and clientId from query parameter (e.g., /ws?role=dj&clientId=xyz)
  try {
    const reqUrl = new URL(req.url, 'http://localhost');
    ws.role = reqUrl.searchParams.get('role') || 'listener';
    ws.clientId = reqUrl.searchParams.get('clientId') || ('anon_' + Math.random().toString(36).substring(2, 9));
  } catch (e) {
    ws.role = 'listener';
    ws.clientId = 'anon_' + Math.random().toString(36).substring(2, 9);
  }

  updateOnlineListeners();

  // Send current radio state immediately upon connection
  ws.send(JSON.stringify({ 
    type: 'RADIO_STATE', 
    data: {
      ...radioState,
      streamClientsCount: streamClients.size
    } 
  }));

  // Send current chat history and reactions count immediately
  ws.send(JSON.stringify({
    type: 'CHAT_INIT',
    messages: chatMessages,
    reactionsCount,
    reactionDetails
  }));

  // Send current program schedule
  ws.send(JSON.stringify({ type: 'SCHEDULE_INIT', schedule: programSchedule }));

  ws.on('close', () => {
    updateOnlineListeners();
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'REGISTER_ROLE') {
        ws.role = msg.role;
        updateOnlineListeners();
      } else if (msg.type === 'UPDATE_RADIO_STATE') {
        radioState = {
          ...radioState,
          ...msg.data,
          lastUpdated: Date.now()
        };
        broadcastRadioState();
      } else if (msg.type === 'CHAT_MESSAGE' && msg.message) {
        // Prevent duplicate append if message already exists with this ID
        if (!chatMessages.some(m => m.id === msg.message.id)) {
          chatMessages.push(msg.message);
          if (chatMessages.length > 100) chatMessages.shift();
        }
        const payload = JSON.stringify({ type: 'CHAT_MESSAGE', message: msg.message });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try { client.send(payload); } catch (e) {}
          }
        });
      } else if (msg.type === 'LIVE_REACTION') {
        const emoji = msg.emoji || '❤️';
        reactionsCount += 1;
        reactionDetails[emoji] = (reactionDetails[emoji] || 0) + 1;
        const payload = JSON.stringify({
          type: 'LIVE_REACTION',
          emoji,
          reactionsCount,
          reactionDetails
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try { client.send(payload); } catch (e) {}
          }
        });
      } else if (msg.type === 'CLEAR_CHAT') {
        chatMessages = [];
        const payload = JSON.stringify({ type: 'CLEAR_CHAT' });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try { client.send(payload); } catch (e) {}
          }
        });
      } else {
        // Broadcast mic audio, jingles, ducking, etc. to all other clients
        const payload = JSON.stringify(msg);
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(payload);
            } catch (e) {}
          }
        });
      }
    } catch (e) {
      console.warn('WS message parse error:', e);
    }
  });
});

function broadcastRadioState() {
  const payload = JSON.stringify({ 
    type: 'RADIO_STATE', 
    data: {
      ...radioState,
      streamClientsCount: streamClients.size
    } 
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (e) {}
    }
  });
}

// Helper: Broadcast schedule update to all WebSocket clients
function broadcastScheduleUpdate() {
  const payload = JSON.stringify({ type: 'SCHEDULE_UPDATE', schedule: programSchedule });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) {}
    }
  });
}

// 8. Program Schedule REST API
app.get('/api/schedule', (req, res) => {
  res.json({ schedule: programSchedule });
});

app.post('/api/schedule', (req, res) => {
  const { schedule } = req.body;
  if (Array.isArray(schedule)) {
    programSchedule = schedule;
    saveScheduleToFile();
    broadcastScheduleUpdate();
    console.log(`[Penyiar] Jadwal siaran diperbarui: ${programSchedule.length} slot program`);
    res.json({ success: true, schedule: programSchedule });
  } else {
    res.status(400).json({ error: 'Format jadwal tidak valid' });
  }
});

app.post('/api/schedule/slot', (req, res) => {
  const { slot } = req.body;
  if (!slot || !slot.startTime || !slot.endTime || !slot.title) {
    return res.status(400).json({ error: 'Data slot tidak lengkap' });
  }

  const existingIdx = programSchedule.findIndex(s => s.id === slot.id);
  if (existingIdx !== -1) {
    programSchedule[existingIdx] = { ...programSchedule[existingIdx], ...slot };
  } else {
    slot.id = Date.now();
    if (!slot.tracks) slot.tracks = [];
    if (!slot.avgTrackDuration) slot.avgTrackDuration = 210;
    programSchedule.push(slot);
  }

  // Sort by startTime
  programSchedule.sort((a, b) => {
    const aMin = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
    const bMin = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
    return aMin - bMin;
  });

  saveScheduleToFile();
  broadcastScheduleUpdate();
  console.log(`[Penyiar] Slot jadwal disimpan: "${slot.title}" (${slot.startTime} - ${slot.endTime})`);
  res.json({ success: true, schedule: programSchedule });
});

app.delete('/api/schedule/slot/:id', (req, res) => {
  const slotId = parseInt(req.params.id) || 0;
  const before = programSchedule.length;
  programSchedule = programSchedule.filter(s => s.id !== slotId);
  if (programSchedule.length < before) {
    saveScheduleToFile();
    broadcastScheduleUpdate();
    console.log(`[Penyiar] Slot jadwal dihapus (id: ${slotId})`);
    res.json({ success: true, schedule: programSchedule });
  } else {
    res.status(404).json({ error: 'Slot tidak ditemukan' });
  }
});

// Upload MP3 File directly into a specific schedule slot
app.post(
  '/api/schedule/:slotId/upload-track',
  express.raw({ type: '*/*', limit: '100mb' }),
  (req, res) => {
    try {
      const buffer = req.body;
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'No audio data received' });
      }

      const slotId = parseInt(req.params.slotId);
      const slot = programSchedule.find(s => s.id === slotId);
      if (!slot) {
        return res.status(404).json({ error: 'Slot jadwal tidak ditemukan' });
      }

      const rawTitle = req.headers['x-title'] || 'Lagu Siaran';
      const rawFileName = req.headers['x-filename'] || 'audio.mp3';
      const cleanTitle = decodeURIComponent(rawTitle);
      const cleanFileName = decodeURIComponent(rawFileName);

      const safeName = `slot_${slotId}_${Date.now()}_${cleanFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(filePath, buffer);

      const actualDuration = getMp3Duration(filePath);

      const trackObj = {
        id: `trk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTitle,
        artist: slot.dj || 'Penyiar Khanza.NET',
        album: slot.title,
        fileName: cleanFileName,
        url: `/uploads/${safeName}`,
        audioUrl: `/uploads/${safeName}`,
        size: buffer.length,
        duration: actualDuration,
        kbps: '320 kbps',
        khz: '44.1 kHz'
      };

      if (!slot.tracks) slot.tracks = [];
      slot.tracks.push(trackObj);

      saveScheduleToFile();
      broadcastScheduleUpdate();

      console.log(`[Jadwal Slot "${slot.title}"] Lagu baru ditambahkan: "${trackObj.title}"`);
      res.json({ success: true, track: trackObj, schedule: programSchedule });
    } catch (err) {
      console.error('Error uploading track to schedule slot:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete track from a schedule slot
app.delete('/api/schedule/:slotId/track/:trackId', (req, res) => {
  const slotId = parseInt(req.params.slotId);
  const trackId = req.params.trackId;
  const slot = programSchedule.find(s => s.id === slotId);
  if (!slot || !slot.tracks) {
    return res.status(404).json({ error: 'Slot atau trek tidak ditemukan' });
  }

  const trackToDelete = slot.tracks.find(t => t.id === trackId);
  slot.tracks = slot.tracks.filter(t => t.id !== trackId);

  // Attempt to remove physical file ONLY if not used in any other slot and not a shared library file
  if (trackToDelete && trackToDelete.url) {
    const isUsedElsewhere = programSchedule.some(s =>
      s.tracks && s.tracks.some(t => t.id !== trackId && (t.url === trackToDelete.url || t.audioUrl === trackToDelete.url))
    );
    if (!isUsedElsewhere && trackToDelete.url.startsWith('/uploads/slot_')) {
      try {
        const fileName = path.basename(trackToDelete.url);
        const fullPath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (e) {
        console.warn('Could not delete audio file:', e.message);
      }
    }
  }

  saveScheduleToFile();
  broadcastScheduleUpdate();
  res.json({ success: true, schedule: programSchedule });
});

// ========================================================
// 9. PUSTAKA MUSIK SERVER (SERVER MEDIA LIBRARY / MUSIC POOL)
// ========================================================

function scanMediaLibrary() {
  const allowedExts = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm']);
  const results = [];

  function walkDir(dir, relativePrefix = '') {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), path.join(relativePrefix, entry.name));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePrefix, entry.name).replace(/\\/g, '/');
            const url = `/uploads/${relPath}`;
            try {
              const stats = fs.statSync(fullPath);
              let cleanTitle = entry.name.replace(/\.[^/.]+$/, '');
              cleanTitle = cleanTitle.replace(/^slot_\d+_\d+_/, '');
              cleanTitle = cleanTitle.replace(/^lib_\d+_/, '');
              cleanTitle = cleanTitle.replace(/_/g, ' ').trim();

              const usedInSlots = [];
              for (const s of programSchedule) {
                if (s.tracks && s.tracks.some(t => t.url === url || t.audioUrl === url)) {
                  usedInSlots.push({ id: s.id, title: s.title, startTime: s.startTime, endTime: s.endTime });
                }
              }

              const duration = ext === '.mp3' ? getMp3Duration(fullPath) : 210;

              results.push({
                id: `lib-${Buffer.from(relPath).toString('base64url').substring(0, 20)}`,
                fileName: entry.name,
                relPath,
                url,
                audioUrl: url,
                title: cleanTitle,
                size: stats.size,
                duration,
                mtime: stats.mtimeMs,
                usedInSlots
              });
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn('Error walking uploads directory:', err.message);
    }
  }

  walkDir(UPLOADS_DIR);
  // Urutkan dari yang terbaru (mtime desc)
  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}

// GET all audio files in Proxmox server uploads folder
app.get('/api/library', (req, res) => {
  try {
    const tracks = scanMediaLibrary();
    res.json({ success: true, count: tracks.length, tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload MP3 directly to central media library
app.post(
  '/api/library/upload',
  express.raw({ type: '*/*', limit: '100mb' }),
  (req, res) => {
    try {
      const buffer = req.body;
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'Tidak ada data file audio yang diterima' });
      }

      const rawTitle = req.headers['x-title'] || 'Lagu Pustaka';
      const rawFileName = req.headers['x-filename'] || 'audio.mp3';
      const cleanTitle = decodeURIComponent(rawTitle);
      const cleanFileName = decodeURIComponent(rawFileName);

      const safeName = `lib_${Date.now()}_${cleanFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(filePath, buffer);

      const duration = getMp3Duration(filePath);
      const trackObj = {
        id: `lib-${Date.now()}`,
        title: cleanTitle,
        fileName: cleanFileName,
        url: `/uploads/${safeName}`,
        audioUrl: `/uploads/${safeName}`,
        size: buffer.length,
        duration,
        mtime: Date.now(),
        usedInSlots: []
      };

      console.log(`[Pustaka Server] Lagu baru ditambahkan ke koleksi: "${cleanTitle}"`);
      res.json({ success: true, track: trackObj });
    } catch (err) {
      console.error('Error uploading track to library:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Add existing library tracks to a schedule slot (Zero File Duplication)
app.post('/api/schedule/:slotId/add-library-tracks', (req, res) => {
  const slotId = parseInt(req.params.slotId);
  const slot = programSchedule.find(s => s.id === slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Slot jadwal tidak ditemukan' });
  }

  const { tracks } = req.body;
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return res.status(400).json({ error: 'Tidak ada lagu yang dipilih dari pustaka' });
  }

  if (!slot.tracks) slot.tracks = [];
  let addedCount = 0;

  for (const t of tracks) {
    const trackObj = {
      id: `trk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: t.title || 'Lagu Pustaka',
      artist: t.artist || slot.dj || 'Penyiar Khanza.NET',
      album: slot.title,
      fileName: t.fileName || path.basename(t.url || ''),
      url: t.url,
      audioUrl: t.url,
      size: t.size || 0,
      duration: t.duration || 210,
      kbps: '320 kbps',
      khz: '44.1 kHz'
    };
    slot.tracks.push(trackObj);
    addedCount++;
  }

  saveScheduleToFile();
  broadcastScheduleUpdate();
  console.log(`[Jadwal Slot "${slot.title}"] ${addedCount} lagu berhasil dimasukkan dari pustaka server.`);
  res.json({ success: true, schedule: programSchedule, addedCount });
});

// Delete file physically from Proxmox server
app.delete('/api/library/file', (req, res) => {
  const { fileName, url, force } = req.body || {};
  const target = fileName || (url ? path.basename(url) : null);
  if (!target) {
    return res.status(400).json({ error: 'Nama file atau URL tidak valid' });
  }

  const safeBase = path.basename(target);
  const fullPath = path.join(UPLOADS_DIR, safeBase);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File tidak ditemukan di server Proxmox' });
  }

  const fileUrl = `/uploads/${safeBase}`;
  const usedSlots = [];
  for (const s of programSchedule) {
    if (s.tracks && s.tracks.some(t => t.url === fileUrl || t.audioUrl === fileUrl)) {
      usedSlots.push(s.title);
    }
  }

  if (usedSlots.length > 0 && !force) {
    return res.status(409).json({
      error: `File ini masih digunakan di slot: "${usedSlots.join('", "')}". Gunakan opsi force jika ingin menghapus permanen.`,
      inUse: true,
      usedSlots
    });
  }

  // If force, unlink from all slots in programSchedule
  if (usedSlots.length > 0 && force) {
    for (const s of programSchedule) {
      if (s.tracks) {
        s.tracks = s.tracks.filter(t => t.url !== fileUrl && t.audioUrl !== fileUrl);
      }
    }
    saveScheduleToFile();
    broadcastScheduleUpdate();
  }

  try {
    fs.unlinkSync(fullPath);
    console.log(`[Pustaka Server] File "${safeBase}" berhasil dihapus permanen dari server.`);
    res.json({ success: true, removedFromSlots: usedSlots.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for SPA routing (/pendengar, /penyiar, /studio, /)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Khanza.NET RADIO</title></head>
        <body style="font-family:sans-serif; background:#0b0d13; color:#fff; padding:20px; text-align:center;">
          <h2>Khanza.NET RADIO Server Active</h2>
          <p>Jalankan <code>npm run build</code> atau <code>npm run dev</code> untuk antarmuka web.</p>
        </body>
        </html>
      `);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Khanza.NET RADIO & WINAMP BROADCAST SERVER`);
  console.log(` Port: ${PORT}`);
  console.log(` 🎧 Halaman Pendengar : http://localhost:${PORT}/pendengar`);
  console.log(` 🎙️ Halaman Penyiar   : http://localhost:${PORT}/penyiar (PIN: 1234)`);
  console.log(` 📻 Stream Audio URL  : http://localhost:${PORT}/api/stream`);
  console.log(`======================================================\n`);
});
