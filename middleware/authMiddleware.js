const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Official = require('../models/Official');
const ChiefOfficial = require('../models/ChiefOfficial');
require('dotenv').config();

// Authenticate general user
exports.auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a user token
    if (decoded.user) {
      const user = await User.findById(decoded.user.id);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      req.user = decoded.user;
    } else {
      return res.status(401).json({ message: 'Invalid token structure' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Authenticate police official
exports.authenticateOfficial = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an official token
    if (decoded.official) {
      const official = await Official.findById(decoded.official.id);
      if (!official) {
        return res.status(401).json({ message: 'Official not found' });
      }
      req.official = decoded.official;
      req.user = { policeStation: official.policeStation }; // Add police station for compatibility
    } else {
      return res.status(401).json({ message: 'Not authorized as an official' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Authenticate chief official
exports.authenticateChief = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.header('x-auth-token');

    token = req.header('x-auth-token');
    token = req.header('x-auth-token');

    token = req.header('x-auth-token');
    

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is a chief
    if (!decoded.id || decoded.role !== 'chief') {
      return res.status(401).json({ message: 'Not authorized as chief' });
    }

    const chief = await ChiefOfficial.findById(decoded.id);
    if (!chief) {
      return res.status(401).json({ message: 'Chief official not found' });
    }

    req.user = chief; // Store chief information in req.user
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Combined auth middleware that can handle different user types
exports.authAny = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Determine user type from token structure
    if (decoded.user) {
      // Regular user
      const user = await User.findById(decoded.user.id);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      req.user = decoded.user;
      req.userType = 'user';
    } else if (decoded.official) {
      // Police official
      const official = await Official.findById(decoded.official.id);
      if (!official) {
        return res.status(401).json({ message: 'Official not found' });
      }
      req.official = decoded.official;
      req.userType = 'official';
    } else if (decoded.id && decoded.role === 'chief') {
      // Chief official
      const chief = await ChiefOfficial.findById(decoded.id);
      if (!chief) {
        return res.status(401).json({ message: 'Chief official not found' });
      }
      req.user = chief;
      req.userType = 'chief';
    } else {
      return res.status(401).json({ message: 'Invalid token structure' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};