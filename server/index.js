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
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);
app.use('/media', express.static(path.join(__dirname, 'uploads')));

let activeUsers = {};

io.on('connection', (socket) => {
    socket.on('join', (username) => {
        activeUsers[socket.id] = username;
        io.emit('user-list', Object.values(activeUsers));
    });

    socket.on('send-message', (msg) => {
        io.emit('chat-message', msg);
    });

    socket.on('playback-action', (data) => {
        socket.broadcast.emit('sync-state', data);
    });

    socket.on('disconnect', () => {
        delete activeUsers[socket.id];
        io.emit('user-list', Object.values(activeUsers));
    });
});

server.listen(3001, () => console.log('Server running on port 3001'));