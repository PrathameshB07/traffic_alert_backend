// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile } = require('../controllers/userController');
const { auth } = require('../middleware/auth');

// @route   POST api/users/register
// @desc    Register a user
// @access  Public
router.post('/register', registerUser);

// @route   POST api/users/login
// @desc    Login user
// @access  Public
router.post('/login', loginUser);

// @route   GET api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, getUserProfile);

module.exports = router;