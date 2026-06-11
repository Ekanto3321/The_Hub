const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// middleware
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);

// Serve uploaded media files publicly via HTTP
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/media', express.static(uploadsDir));

// Serve sounds placed under client/sounds at /sounds
app.use('/sounds', express.static(path.join(__dirname, '..', 'client', 'sounds')));

// multer for file uploads
const upload = multer({ dest: uploadsDir });

// Helpers to probe media info
const ffprobeCommand = (file, args) =>
  new Promise((resolve) => {
    // args should include -select_streams and -show_entries parts as needed
    const cmd = `ffprobe -v error ${args} -of default=noprint_wrappers=1:nokey=1 "${file}"`;
    exec(cmd, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout ? stdout.trim() : null);
    });
  });

const getVideoCodec = (file) => ffprobeCommand(file, '-select_streams v:0 -show_entries stream=codec_name');
const getAudioCodec = (file) => ffprobeCommand(file, '-select_streams a:0 -show_entries stream=codec_name');
const getFormatName = (file) => ffprobeCommand(file, '-show_entries format=format_name');

// decide if a file is already web-friendly: h264 video + aac audio + common container
const isWebFriendly = async (filepath) => {
  try {
    const [vCodec, aCodec, fmtRaw] = await Promise.all([
      getVideoCodec(filepath),
      getAudioCodec(filepath),
      getFormatName(filepath),
    ]);
    if (!vCodec || !aCodec || !fmtRaw) return false;
    const video = vCodec.split('\n')[0];
    const audio = aCodec.split('\n')[0];
    const fmt = fmtRaw.split(',')[0];
    return video === 'h264' && audio === 'aac' && (fmt.includes('mp4') || fmt.includes('mov') || fmt.includes('matroska') || fmt.includes('webm'));
  } catch (e) {
    return false;
  }
};

// upload & (optional) transcode endpoint
// POST /upload-media?roomId=<roomId>&title=<title>
// field name: file
app.post('/upload-media', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'no-file' });

    const roomId = req.query.roomId;
    const title = req.query.title || req.file.originalname || req.file.filename;
    const uploadedPath = req.file.path;
    const origName = req.file.originalname || req.file.filename;

    // check for ffprobe presence, but proceed gracefully if missing
    exec('ffprobe -version', async (probeErr) => {
      let needsTranscode = true;
      if (!probeErr) {
        try {
          needsTranscode = !(await isWebFriendly(uploadedPath));
        } catch (e) {
          needsTranscode = true;
        }
      } else {
        // no ffprobe => we conservatively transcode
        needsTranscode = true;
      }

      if (!needsTranscode) {
        // ready as-is
        const publicPath = `/media/${path.basename(uploadedPath)}`;
        if (roomId) {
          io.to(roomId).emit('media-ready', { roomId, mediaUrl: publicPath, title, origName });
        }
        return res.json({ ok: true, status: 'ready', mediaUrl: publicPath, title });
      }

      // start async transcoding; reply immediately indicating work in progress
      res.json({ ok: true, status: 'transcoding', message: 'transcoding started' });

      const outName = `${path.parse(req.file.filename).name}-transcoded.mp4`;
      const outPath = path.join(uploadsDir, outName);
      const script = path.join(__dirname, '..', 'transcoder', 'format_video.sh');

      const finish = (err) => {
        if (err) {
          console.error('transcode failed', err);
          return;
        }
        try { fs.unlinkSync(uploadedPath); } catch (e) {}
        const publicPath = `/media/${path.basename(outPath)}`;
        if (roomId) io.to(roomId).emit('media-ready', { roomId, mediaUrl: publicPath, title, origName });
      };

      if (!fs.existsSync(script)) {
        // fallback to plain ffmpeg transcode
        const cmd = `ffmpeg -y -i "${uploadedPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart "${outPath}"`;
        exec(cmd, (err, stdout, stderr) => finish(err));
      } else {
        exec(`bash "${script}" "${uploadedPath}" "${outPath}"`, (err) => finish(err));
      }
    });
  } catch (err) {
    console.error('upload-media error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// room / playback state
const roomUsers = {}; // { roomId: [ { username, socketId } ] }
const roomPlayback = {}; // { roomId: { mediaUrl, time, isPlaying, lastUpdate } }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // JOIN ROOM
  socket.on('join-room', (roomId, username) => {
    if (!roomId) return;
    // Leave previous room if any
    if (socket.roomId && socket.roomId !== roomId) {
      socket.leave(socket.roomId);
      if (roomUsers[socket.roomId]) {
        roomUsers[socket.roomId] = roomUsers[socket.roomId].filter(u => u.socketId !== socket.id);
        io.to(socket.roomId).emit('room-state', roomUsers[socket.roomId].map(u => ({ username: u.username })));
        if (roomUsers[socket.roomId].length === 0) delete roomUsers[socket.roomId];
      }
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    if (!roomUsers[roomId]) roomUsers[roomId] = [];

    if (!roomUsers[roomId].some(u => u.socketId === socket.id)) {
      roomUsers[roomId].push({ username, socketId: socket.id });
    }

    // Notify room of current members
    io.to(roomId).emit('room-state', roomUsers[roomId].map(u => ({ username: u.username })));

    // Inform others that a user joined
    socket.to(roomId).emit('user-joined', { roomId, username });

    // Send current playback state (if any) to the joining socket so it can catch up
    try {
      const pb = roomPlayback[roomId];
      if (pb && pb.mediaUrl) {
        let effectiveTime = pb.time || 0;
        if (pb.isPlaying && pb.lastUpdate) {
          effectiveTime += (Date.now() - pb.lastUpdate) / 1000;
        }
        socket.emit('sync-state', {
          roomId,
          action: pb.isPlaying ? 'play' : 'pause',
          time: effectiveTime,
          mediaUrl: pb.mediaUrl,
          isRemoteEvent: true,
          init: true
        });
      }
    } catch (err) {
      console.error('emit initial playback state error', err);
    }

    console.log(`Socket ${socket.id} joined room ${roomId} as ${username || 'unknown'}`);
  });

  // PLAYBACK ACTIONS
  socket.on('playback-action', (data) => {
    try {
      const { roomId, action, time, mediaUrl, isRemoteEvent } = data;
      if (!roomId) return;
      if (socket.roomId !== roomId) {
        console.warn(`Ignoring playback-action from ${socket.id} for room ${roomId} (socket in ${socket.roomId})`);
        return;
      }

      if (!roomPlayback[roomId]) roomPlayback[roomId] = { mediaUrl: null, time: 0, isPlaying: false, lastUpdate: Date.now() };
      const pb = roomPlayback[roomId];

      if (action === 'change-media') {
        pb.mediaUrl = mediaUrl || pb.mediaUrl;
        pb.time = typeof time === 'number' ? time : 0;
        pb.isPlaying = false;
        pb.lastUpdate = Date.now();
      } else if (action === 'play') {
        pb.time = typeof time === 'number' ? time : pb.time || 0;
        pb.isPlaying = true;
        pb.lastUpdate = Date.now();
        if (mediaUrl) pb.mediaUrl = mediaUrl;
      } else if (action === 'pause') {
        pb.time = typeof time === 'number' ? time : pb.time || 0;
        pb.isPlaying = false;
        pb.lastUpdate = Date.now();
      } else if (action === 'seek') {
        pb.time = typeof time === 'number' ? time : pb.time || 0;
        pb.lastUpdate = Date.now();
      }

      // Broadcast to others in the room (exclude sender)
      socket.to(roomId).emit('sync-state', { roomId, action, time, mediaUrl: pb.mediaUrl, isRemoteEvent: true });
    } catch (err) {
      console.error('playback-action error', err);
    }
  });

  // PERSISTENT CHAT
  socket.on('send-message', async (data, ack) => {
    try {
      const { roomId, userId, username, content, time } = data;
      if (!roomId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'no-room' });
        return;
      }

      console.log(`[send-message] from ${socket.id} -> room ${roomId}:`, { username, content });

      // Save to DB if possible
      if (roomId && userId) {
        await prisma.message.create({
          data: {
            content,
            roomId,
            userId,
          },
        });
      }

      // Emit to the room
      io.to(roomId).emit('chat-message', {
        roomId,
        username,
        content,
        time: time || new Date().toLocaleTimeString(),
      });

      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('send-message error', err);
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // SOUNDBOARD
  socket.on('play-sound', (data) => {
    try {
      const { roomId, soundType } = data;
      if (!roomId) return;
      if (socket.roomId !== roomId) {
        console.warn(`Ignoring play-sound from ${socket.id} for room ${roomId} (socket in ${socket.roomId})`);
        return;
      }
      socket.to(roomId).emit('play-sound', { roomId, soundType });
    } catch (err) {
      console.error('play-sound error', err);
    }
  });

  // persistent playback request
  socket.on('request-playback', (roomId, cb) => {
    try {
      if (!roomId) {
        if (typeof cb === 'function') cb(null);
        return;
      }
      const pb = roomPlayback[roomId];
      if (!pb || !pb.mediaUrl) {
        if (typeof cb === 'function') cb(null);
        return;
      }

      let effectiveTime = pb.time || 0;
      if (pb.isPlaying && pb.lastUpdate) {
        effectiveTime += (Date.now() - pb.lastUpdate) / 1000;
      }

      const payload = {
        roomId,
        mediaUrl: pb.mediaUrl,
        time: effectiveTime,
        isPlaying: !!pb.isPlaying,
      };

      if (typeof cb === 'function') cb(payload);
    } catch (err) {
      console.error('request-playback error', err);
      if (typeof cb === 'function') cb(null);
    }
  });

  // CLEANUP ON DISCONNECT
  socket.on('disconnect', () => {
    const { roomId } = socket;
    if (roomId && roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);
      io.to(roomId).emit('room-state', roomUsers[roomId].map(u => ({ username: u.username })));
      if (roomUsers[roomId].length === 0) delete roomUsers[roomId];
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));
