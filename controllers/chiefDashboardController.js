// controllers/chiefDashboardController.js
const Detection = require('../models/Detection');
const Official = require('../models/Official');
const ChiefOfficial = require('../models/ChiefOfficial');
const mongoose = require('mongoose');

// Helper function to build date range filter
const getDateRangeFilter = (startDate, endDate) => {
  const dateFilter = {};
  
  if (startDate) {
    dateFilter['$gte'] = new Date(startDate);
  }
  
  if (endDate) {
    dateFilter['$lte'] = new Date(endDate);
  }
  
  return Object.keys(dateFilter).length > 0 ? dateFilter : null;
};

// Get summary stats for chief dashboard
exports.getDashboardSummary = async (req, res) => {

  console.log("kjhwkhjrkjhkhkhkjh--------------")
  try {
    const { policeStation } = req.user; // From auth middleware
    const { startDate, endDate } = req.query;
    
    // Build date filter if provided
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = getDateRangeFilter(startDate, endDate);
    }
    
    // Get officials from this police station
    const officials = await Official.find({ policeStation });
    const officialIds = officials.map(official => official._id);
    
    // Base query for detections
    const baseQuery = {
      ...dateFilter,
      $or: [
        { notifiedOfficials: { $in: officialIds } },
        { availableOfficials: { $in: officialIds } },
        { acceptedBy: { $in: officialIds } },
        { rejectedBy: { $in: officialIds } },
        { currentlyNotified: { $in: officialIds } }
      ]
    };
    
    // Get total cases
    const totalCases = await Detection.countDocuments(baseQuery);
    
    // Get counts by status
    const pendingCases = await Detection.countDocuments({
      ...baseQuery,
      taskStatus: 'pending'
    });
    
    const acceptedCases = await Detection.countDocuments({
      ...baseQuery,
      taskStatus: 'accepted'
    });
    
    const completedCases = await Detection.countDocuments({
      ...baseQuery,
      taskStatus: 'completed'
    });
    
    // Get count of accident cases
    const accidentCases = await Detection.countDocuments({
      ...baseQuery,
      isAccident: true
    });
    
    // Response data
    const dashboardData = {
      totalCases,
      pendingCases,
      acceptedCases,
      completedCases,
      accidentCases,
      totalOfficials: officials.length,
      activeOfficials: await Official.countDocuments({ policeStation, isOnDuty: true })
    };
    
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
};

// Get case trends over time
exports.getCaseTrends = async (req, res) => {
  try {
    const { policeStation } = req.user;
    const { startDate, endDate, interval = 'day' } = req.query;
    
    // Get officials from this police station
    const officials = await Official.find({ policeStation });
    const officialIds = officials.map(official => official._id);
    
    // Build date range
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = getDateRangeFilter(startDate, endDate);
    }
    
    // Base query
    const baseQuery = {
      ...dateQuery,
      $or: [
        { notifiedOfficials: { $in: officialIds } },
        { availableOfficials: { $in: officialIds } },
        { acceptedBy: { $in: officialIds } },
        { rejectedBy: { $in: officialIds } },
        { currentlyNotified: { $in: officialIds } }
      ]
    };
    
    // Set up grouping format based on interval
    let dateFormat;
    if (interval === 'hour') {
      dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
    } else if (interval === 'week') {
      dateFormat = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
    } else if (interval === 'month') {
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    } else {
      // Default to day
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }
    
    // Aggregate cases by date and status
    const caseTrends = await Detection.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            date: dateFormat,
            status: '$taskStatus',
            isAccident: '$isAccident'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          data: {
            $push: {
              status: '$_id.status',
              isAccident: '$_id.isAccident',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.status(200).json(caseTrends);
  } catch (error) {
    console.error('Case trends error:', error);
    res.status(500).json({ message: 'Error fetching case trends', error: error.message });
  }
};

// Get official performance data
exports.getOfficialPerformance = async (req, res) => {
  try {
    const { policeStation } = req.user;
    const { startDate, endDate, officialId } = req.query;
    
    // Build filters
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = getDateRangeFilter(startDate, endDate);
    }
    
    // Get officials from this police station
    const query = { policeStation };
    if (officialId) {
      console.log("here==========")
      query._id = new mongoose.Types.ObjectId(officialId);
      console.log("also----------")
    }
    
    const officials = await Official.find(query);
    
    // For each official, get their stats
    const officialStats = await Promise.all(officials.map(async (official) => {
      // Cases where official was available
      const availableCases = await Detection.countDocuments({
        ...dateFilter,
        availableOfficials: official._id
      });
      
      // Cases where official was notified
      const notifiedCases = await Detection.countDocuments({
        ...dateFilter,
        notifiedOfficials: official._id
      });
      
      // Cases accepted
      const acceptedCases = await Detection.countDocuments({
        ...dateFilter,
        acceptedBy: official._id
      });
      
      // Cases rejected
      const rejectedCases = await Detection.countDocuments({
        ...dateFilter,
        rejectedBy: official._id
      });
      
      // Cases completed
      const completedCases = await Detection.countDocuments({
        ...dateFilter,
        acceptedBy: official._id,
        taskStatus: 'completed'
      });
      
      // Average response time (time between creation and acceptance)
      const responseTimes = await Detection.aggregate([
        {
          $match: {
            ...dateFilter,
            acceptedBy: official._id,
            completedAt: { $ne: null }
          }
        },
        {
          $project: {
            responseTime: { $subtract: ['$completedAt', '$createdAt'] }
          }
        }
      ]);
      
      const totalResponseTime = responseTimes.reduce((sum, item) => sum + item.responseTime, 0);
      const avgResponseTime = responseTimes.length > 0 
        ? Math.round(totalResponseTime / responseTimes.length / (1000 * 60)) // in minutes
        : null;
      
      return {
        _id: official._id,
        name: official.name,
        badgeId: official.badgeId,
        performance: {
          availableCases,
          notifiedCases,
          acceptedCases,
          rejectedCases,
          completedCases,
          responseRate: notifiedCases > 0 ? (acceptedCases / notifiedCases) * 100 : 0,
          completionRate: acceptedCases > 0 ? (completedCases / acceptedCases) * 100 : 0,
          avgResponseTime
        }
      };
    }));
    
    res.status(200).json(officialStats);
  } catch (error) {
    console.error('Official performance error:', error);
    res.status(500).json({ message: 'Error fetching official performance data', error: error.message });
  }
};

// Get detailed case list with filters
exports.getCases = async (req, res) => {
  try {
    const { policeStation } = req.user;
    const { 
      startDate, 
      endDate, 
      status, 
      isAccident, 
      officialId, 
      limit = 10, 
      page = 1 
    } = req.query;
    
    // Get officials from this police station
    const officials = await Official.find({ policeStation });
    const officialIds = officials.map(official => official._id);
    
    // Build query filters
    const filters = {
      $or: [
        { notifiedOfficials: { $in: officialIds } },
        { availableOfficials: { $in: officialIds } },
        { acceptedBy: { $in: officialIds } },
        { rejectedBy: { $in: officialIds } },
        { currentlyNotified: { $in: officialIds } }
      ]
    };
    
    // Add date filter if provided
    if (startDate || endDate) {
      filters.createdAt = getDateRangeFilter(startDate, endDate);
    }
    
    // Add status filter if provided
    if (status) {
      filters.taskStatus = status;
    }
    
    // Add accident filter if provided
    if (isAccident !== undefined) {
      filters.isAccident = isAccident === 'true';
    }
    
    // Add official filter if provided
    if (officialId) {
      filters.$or = [
        { notifiedOfficials: mongoose.Types.ObjectId(officialId) },
        { availableOfficials: mongoose.Types.ObjectId(officialId) },
        { acceptedBy: mongoose.Types.ObjectId(officialId) },
        { rejectedBy: mongoose.Types.ObjectId(officialId) },
        { currentlyNotified: mongoose.Types.ObjectId(officialId) }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get cases with pagination
    const cases = await Detection.find(filters)
      .populate('user', 'name email')
      .populate('notifiedOfficials', 'name badgeId')
      .populate('availableOfficials', 'name badgeId')
      .populate('acceptedBy', 'name badgeId')
      .populate('rejectedBy', 'name badgeId')
      .populate('currentlyNotified', 'name badgeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalCases = await Detection.countDocuments(filters);
    
    res.status(200).json({
      cases,
      pagination: {
        total: totalCases,
        page: parseInt(page),
        pages: Math.ceil(totalCases / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Case list error:', error);
    res.status(500).json({ message: 'Error fetching case list', error: error.message });
  }
};

// Get single case details 
exports.getCaseDetails = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const caseDetails = await Detection.findById(caseId)
      .populate('user', 'name email')
      .populate('notifiedOfficials', 'name badgeId')
      .populate('availableOfficials', 'name badgeId')
      .populate('acceptedBy', 'name badgeId')
      .populate('rejectedBy', 'name badgeId')
      .populate('currentlyNotified', 'name badgeId');
    
    if (!caseDetails) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    res.status(200).json(caseDetails);
  } catch (error) {
    console.error('Case details error:', error);
    res.status(500).json({ message: 'Error fetching case details', error: error.message });
  }
};
