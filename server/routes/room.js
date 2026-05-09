const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    const rooms = await prisma.room.findMany({ include: { media: true } });
    res.json(rooms);
});

module.exports = router;