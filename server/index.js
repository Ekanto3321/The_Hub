// ...existing code...
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
 // Tracks playback state per room: { mediaUrl, time, isPlaying, lastUpdate }
// ...existing code...

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);

// Serve uploaded media files publicly via HTTP
app.use('/media', express.static(path.join(__dirname, 'uploads')));

// ...existing code...
const roomUsers = {}; // Tracks users in each room
const roomPlayback = {}; // Tracks playback state per room: { mediaUrl, time, isPlaying, lastUpdate }
// ...existing code...

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

    // Notify room of current members (no need to include roomId here, delivered only to that room)
    io.to(roomId).emit(
      'room-state',
      roomUsers[roomId].map(u => ({ username: u.username }))
    );

    // Inform others that a user joined (include roomId)
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
      // Ensure socket is in the same room before broadcasting
      if (socket.roomId !== roomId) {
        console.warn(`Ignoring playback-action from ${socket.id} for room ${roomId} (socket in ${socket.roomId})`);
        return;
      }

      // Update roomPlayback state
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

      // Broadcast to others in the room (exclude sender) and include roomId
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

      // Save to DB if possible (don't include unknown fields)
      if (roomId && userId) {
        await prisma.message.create({
          data: {
            content,
            roomId,
            userId,
            // createdAt handled by Prisma schema
          },
        });
      }

      // Emit to the room (include roomId and a time)
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
      // include roomId
      socket.to(roomId).emit('play-sound', { roomId, soundType });
    } catch (err) {
      console.error('play-sound error', err);
    }
  });

  //persistent playback
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

      // compute effective time if playing
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
// ...existing code...
