
// // models/Notification.js
// const mongoose = require('mongoose');

// const notificationSchema = new mongoose.Schema({
//   detection: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Detection',
//     required: true
//   },
//   official: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Official',
//     required: true
//   },
//   telegramMessageId: String,
//   status: {
//     type: String,
//     enum: ['sent', 'delivered', 'read', 'failed'],
//     default: 'sent'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('Notification', notificationSchema);


// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  detection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Detection',
    required: true
  },
  official: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Official',
    required: true
  },
  smsMessageSid: String,
  notificationText: String,
  // status: {
  //   type: String,
  //   enum: ['sent', 'delivered', 'read', 'failed'],
  //   default: 'sent'
  // },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'read', 'accepted', 'rejected', 'completed'],
    default: 'sent'
  }
});

module.exports = mongoose.model('Notification', notificationSchema);