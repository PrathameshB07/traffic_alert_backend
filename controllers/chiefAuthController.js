// controllers/chiefAuthController.js
const ChiefOfficial = require('../models/ChiefOfficial');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
// Register a new chief official
exports.register = async (req, res) => {

  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {

    return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password, badgeId, policeStation, phoneNumber } = req.body;
  try {
    // Check if email already exists
    let chief = await ChiefOfficial.findOne({ email });
    if (chief) {
      return res.status(400).json({ message: 'Chief official with this email already exists' });
    }
    // Check if badge ID already exists
    chief = await ChiefOfficial.findOne({ badgeId });
    if (chief) {
      return res.status(400).json({ message: 'Chief official with this badge ID already exists' });
    }
    // Create new chief official
    chief = new ChiefOfficial({
      name,
      email,
      password,
      badgeId,
      policeStation,
      phoneNumber
    });
    // Save chief official
    await chief.save();
    // Create and return JWT token
    const payload = {
      id: chief.id,
      role: 'chief'
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Chief registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};
// Login chief official
exports.login = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    // Check if chief exists
    const chief = await ChiefOfficial.findOne({ email });
    if (!chief) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Check password
    const isMatch = await chief.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Create and return JWT token
    const payload = {
      id: chief.id,
      role: 'chief'
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Chief login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};
// Get authenticated chief profile
exports.getProfile = async (req, res) => {
  try {
    const chief = await ChiefOfficial.findById(req.user.id).select('-password');
    if (!chief) {
      return res.status(404).json({ message: 'Chief official not found' });
    }
    res.json(chief);
  } catch (error) {
    console.error('Get chief profile error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};
