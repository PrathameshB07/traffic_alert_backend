// routes/detectionRoutes.js
const express = require('express');
const router = express.Router();
const {
  upload,
  processMediaUpload,
  getDetectionById,
  getUserDetections,
  getOfficialNotifications,
  markNotificationAsRead
} = require('../controllers/detectionController');
const { auth, officialAuth } = require('../middleware/auth');

// @route   POST api/detections/upload
// @desc    Upload and process media
// @access  Private
router.post('/upload', auth, upload.single('media'), processMediaUpload);

// @route   GET api/detections/:id
// @desc    Get detection by ID
// @access  Private
router.get('/:id', auth, getDetectionById);

// @route   GET api/detections/user/me
// @desc    Get user's detections
// @access  Private
router.post('/user/me', auth, getUserDetections);

// @route   GET api/detections/official/notifications
// @desc    Get official's notifications
// @access  Private (Official)
router.get('/official/notifications', officialAuth, getOfficialNotifications);

// @route   PUT api/detections/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (Official)
router.put('/notifications/:id/read', officialAuth, markNotificationAsRead);

module.exports = router;