// routes/officialRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerOfficial,
  loginOfficial,
  getOfficialProfile,
  updateDutyLocation,
  updateTelegramChatId
} = require('../controllers/officialController');
const { officialAuth } = require('../middleware/auth');

// @route   POST api/officials/register
// @desc    Register a traffic official
// @access  Public
router.post('/register', registerOfficial);

// @route   POST api/officials/login
// @desc    Login traffic official
// @access  Public
router.post('/login', loginOfficial);

// @route   GET api/officials/profile
// @desc    Get official profile
// @access  Private
router.get('/profile', officialAuth, getOfficialProfile);

// @route   PUT api/officials/duty-location
// @desc    Update duty location
// @access  Private
router.put('/duty-location', officialAuth, updateDutyLocation);

// @route   PUT api/officials/telegram
// @desc    Update Telegram chat ID
// @access  Private
router.put('/telegram', officialAuth, updateTelegramChatId);


// Save push subscription
router.post('/subscribe', officialAuth, async (req, res) => {
  try {
    const subscription = req.body;
    const official = await Official.findById(req.official.id);
    
    if (!official) {
      return res.status(404).json({ msg: 'Official not found' });
    }
    
    official.pushSubscription = subscription;
    await official.save();
    
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.get('/notifications/unread/count', officialAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      official: req.official.id,
      status: 'sent' // Consider 'sent' as unread
    });
    
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;