// routes/chiefAuthRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const chiefAuthController = require('../controllers/chiefAuthController');
const { authenticateChief } = require('../middleware/authMiddleware');
// Register a new chief official
router.post(
  '/register',
  // [
  //   check('name', 'Name is required').not().isEmpty(),
  //   check('email', 'Please include a valid email').isEmail(),
  //   check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  //   check('badgeId', 'Badge ID is required').not().isEmpty(),
  //   check('policeStation', 'Police station is required').not().isEmpty()
  // ],
  chiefAuthController.register
);
// Login a chief official
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  chiefAuthController.login
);
// Get authenticated chief profile
router.get('/profile', authenticateChief, chiefAuthController.getProfile);
module.exports = router;
