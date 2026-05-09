const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express = require('express');
const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.create({
            data: { username, password }
        });
        res.json(user);
    } catch (e) {
        res.status(400).json({ error: "User already exists" });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (user && user.password === password) {
        res.json({ message: "Success", username: user.username });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

module.exports = router;
