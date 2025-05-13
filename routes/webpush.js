const express = require('express');
const router = express.Router();
require('dotenv').config();

// Route to get public VAPID key
router.get('/public-key', (req, res) => {
  res.json({ publicKey: process.env.WEB_PUSH_PUBLIC_KEY });
});

module.exports = router;    