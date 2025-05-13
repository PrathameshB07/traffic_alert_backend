// controllers/officialController.js
const Official = require('../models/Official');
Official.syncIndexes();

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Register official
exports.registerOfficial = async (req, res) => {
  const { name, email, password, badgeId, phoneNumber, policeStation } = req.body;

  try {
    // Check if official already exists
    let official = await Official.findOne({ $or: [{ email }, { badgeId }] });
    if (official) {
      return res.status(400).json({ msg: 'Official already exists' });
    }

    // Create new official
    official = new Official({
      name,
      email,
      password,
      badgeId,
      phoneNumber,
      policeStation
    });

    await official.save();

    // Create JWT
    const payload = {
      official: {
        id: official.id
      }
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
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Other controller functions remain the same...

// controllers/officialController.js
// const Official = require('../models/Official');
// Official.syncIndexes();

// const jwt = require('jsonwebtoken');
// require('dotenv').config();

// // Register official
// exports.registerOfficial = async (req, res) => {
//   const { name, email, password, badgeId,phoneNumber } = req.body;

//   try {
//     // Check if official already exists
//     let official = await Official.findOne({ $or: [{ email }, { badgeId }] });
//     if (official) {
//       return res.status(400).json({ msg: 'Official already exists' });
//     }

//     // Create new official
//     official = new Official({
//       name,
//       email,
//       password,
//       badgeId,
//       phoneNumber
//     });

//     await official.save();

//     // Create JWT
//     const payload = {
//       official: {
//         id: official.id
//       }
//     };

//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' },
//       (err, token) => {
//         if (err) throw err;
//         res.json({ token });
//       }
//     );
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// Login official
exports.loginOfficial = async (req, res) => {

  console.log("here")
  const { email, password } = req.body;

  try {
    // Check if official exists
    let official = await Official.findOne({ email });
    if (!official) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await official.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create JWT
    const payload = {
      official: {
        id: official.id
      }
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
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get official profile
exports.getOfficialProfile = async (req, res) => {
  try {
    const official = await Official.findById(req.official.id).select('-password');
    if (!official) {
      return res.status(404).json({ msg: 'Official not found' });
    }
    res.json(official);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
  
// Update duty location
exports.updateDutyLocation = async (req, res) => {
  console.log(req.body)
  const { longitude, latitude, radius, isOnDuty } = req.body;

  try {
    const official = await Official.findById(req.official.id);
    if (!official) {
      return res.status(404).json({ msg: 'Official not found' });
    }

    // Update location
    if (longitude !== undefined && latitude !== undefined) {
      official.dutyLocation.coordinates = [longitude, latitude];
    }
    
    // Update radius if provided
    if (radius !== undefined) {
      official.radius = radius;
    }
    
    // Update duty status if provided
    if (isOnDuty !== undefined) {
      official.isOnDuty = isOnDuty;
    }

    await official.save();
    res.json(official);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update Telegram chat ID
exports.updateTelegramChatId = async (req, res) => {
  const { telegramChatId } = req.body;

  try {
    const official = await Official.findById(req.official.id);
    if (!official) {
      return res.status(404).json({ msg: 'Official not found' });
    }

    official.telegramChatId = telegramChatId;
    await official.save();
    
    res.json({ msg: 'Telegram chat ID updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};