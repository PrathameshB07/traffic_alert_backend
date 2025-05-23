// models/ChiefOfficial.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const chiefOfficialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  badgeId: {
    type: String,
    required: true,
    unique: true
  },
  policeStation: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        // Basic validation for phone number with country code
        return v === null || /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number! Must include country code (e.g., +1)`
    }
  },
  role: {
    type: String,
    default: 'chief',
    enum: ['chief']
  },
  dateJoined: {
    type: Date,
    default: Date.now
  },
  // Add station location for potential future features
  stationLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  }
});
// Hash password before saving
chiefOfficialSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
// Method to compare passwords
chiefOfficialSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
module.exports = mongoose.model('ChiefOfficial', chiefOfficialSchema);
