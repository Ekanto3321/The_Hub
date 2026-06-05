// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.create({
      data: { username, password }
    });
    res.json({ id: user.id, username: user.username, rooms: [] });
  } catch (e) {
    res.status(400).json({ error: "User already exists or registration failed" });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // 1. Verify User
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2. Fetch FLAT list of rooms where user is involved
    const userRooms = await prisma.room.findMany({
      where: {
        OR: [
          { ownerId: user.id }, // Rooms they created
          { members: { some: { userId: user.id } } } // Rooms they joined
        ]
      }
    });

    // 3. Send clean payload
    res.json({ 
      id: user.id, 
      username: user.username, 
      rooms: userRooms // Direct array of { id, code, name, etc }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
