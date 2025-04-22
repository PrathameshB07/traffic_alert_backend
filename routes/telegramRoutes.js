// routes/telegramRoutes.js
const express = require('express');
const router = express.Router();
const { processTelegramUpdate } = require('../utils/telegramBot');
const Official = require('../models/Official');
const crypto = require('crypto');
require('dotenv').config();

// Store temporary link codes
const linkCodes = {}; // { code: { officialId, expires } }

// @route   POST api/telegram/webhook
// @desc    Webhook for Telegram updates
// @access  Public
router.post('/webhook', async (req, res) => {
  try {
    await processTelegramUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error processing Telegram webhook:', err);
    res.status(500).send('Error');
  }
});

// @route   POST api/telegram/generate-link
// @desc    Generate a link code for a traffic official
// @access  Private (Official)
router.post('/generate-link', async (req, res) => {
  try {
    const officialId = req.body.officialId;
    
    // Generate random code
    const linkCode = crypto.randomBytes(3).toString('hex');
    
    // Store code with expiration (15 minutes)
    linkCodes[linkCode] = {
      officialId,
      expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
    
    res.json({ linkCode });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/telegram/link
// @desc    Link Telegram chat to traffic official
// @access  Public (But secured with link code)
router.post('/link', async (req, res) => {
  try {
    const { linkCode, chatId } = req.body;
    
    // Verify link code
    if (!linkCodes[linkCode] || linkCodes[linkCode].expires < Date.now()) {
      return res.status(400).json({ msg: 'Invalid or expired link code' });
    }
    
    // Get official ID
    const { officialId } = linkCodes[linkCode];
    
    // Update official's Telegram chat ID
    await Official.findByIdAndUpdate(officialId, { telegramChatId: chatId });
    
    // Remove used link code
    delete linkCodes[linkCode];
    
    res.json({ msg: 'Telegram account linked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;