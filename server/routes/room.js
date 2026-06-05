const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// NEW: Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// NEW: Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

// MAKE ROOM
router.post('/create', async (req, res) => {
  const { name, userId } = req.body;
  if (!name || !userId) return res.status(400).json({ error: "Missing room name or user ID" });

  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = await prisma.room.create({
      data: { name: name, code: code, ownerId: userId }
    });
    
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: userId }
    });
    
    console.log(`[Success] Room created: ${room.name} (${room.code})`);
    res.json(room);
  } catch (error) {
    console.error("[Prisma Error] Failed to create room:", error.message);
    res.status(500).json({ error: "Failed to create room in database" });
  }
});

// JOIN ROOM
router.post('/join', async (req, res) => {
  const { code, userId } = req.body;
  try {
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) return res.status(404).json({ error: "Invalid Room Code" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: {},
      create: { roomId: room.id, userId }
    });

    console.log(`[Success] User ${userId} joined room ${room.code}`);
    res.json(room);
  } catch (error) {
    console.error("[Prisma Error] Failed to join room:", error.message);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// GET ROOM CONTEXT (Updated to include media relations)
router.get('/:roomId', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.roomId },
      include: {
        members: { include: { user: true } },
        messages: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        media: { include: { media: true }, orderBy: { addedAt: 'asc' } } // NEW: Fetch associated media
      }
    });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch room data" });
  }
});

// NEW: UPLOAD MEDIA TO ROOM
router.post('/:roomId/media', upload.single('file'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    // 1. Save Media record to DB
    const media = await prisma.media.create({
      data: {
        title: file.originalname,
        filename: file.filename,
        filePath: `/media/${file.filename}`, // Assumes express.static is mounted at /media
        type: file.mimetype
      }
    });

    // 2. Link the Media to the Room in the join table
    const roomMedia = await prisma.roomMedia.create({
      data: { roomId, mediaId: media.id }
    });

    res.json({ ...roomMedia, media });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Media upload failed" });
  }
});

module.exports = router;
