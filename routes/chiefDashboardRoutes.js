
// routes/chiefDashboardRoutes.js
const express = require('express');
const router = express.Router();
const chiefDashboardController = require('../controllers/chiefDashboardController');
const { authenticateChief } = require('../middleware/authMiddleware');
// Apply authentication middleware to all routes
router.use(authenticateChief);
// Dashboard summary stats
router.get('/summary', chiefDashboardController.getDashboardSummary);
// Case trends over time
router.get('/case-trends', chiefDashboardController.getCaseTrends);
// Officials performance
router.get('/official-performance', chiefDashboardController.getOfficialPerformance);
// Case list with filters
router.get('/cases', chiefDashboardController.getCases);
// Single case details
router.get('/cases/:caseId', chiefDashboardController.getCaseDetails);
module.exports = router;
// middleware/authMiddleware.js (add this function to your existing middleware)
exports.authenticateChief = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is a chief
    const chief = await ChiefOfficial.findById(decoded.id);
    if (!chief) {
      return res.status(401).json({ message: 'Not authorized as chief' });
    }

    req.user = chief;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
