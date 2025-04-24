// // controllers/detectionController.js
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendTelegramNotification } = require('../utils/telegramBot');
// const { runYOLODetection } = require('../ml/yoloDetection');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// require('dotenv').config();

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../uploads');
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer
// exports.upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }

//     console.log("req",res)
    
//     const { longitude, latitude } = req.body;
    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }

//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Create detection record
//     const detection = new Detection({
//       user: req.user.id,
//       mediaUrl: `/uploads/${req.file.filename}`,
//       mediaType,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing'
//     });

//     await detection.save();

//     // Process with YOLO in background
//     runYOLODetection(req.file.path, detection._id)
//       .then(async (result) => {
//         // Update detection with results
//         detection.detectionResults = result;
//         detection.status = 'completed';
//         await detection.save();

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           telegramChatId: { $ne: null }
//         });

//         // Notify officials
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Send Telegram notification
//             const telegramRes = await sendTelegramNotification(
//               official.telegramChatId,
//               `🚨 Vehicle Detection Alert 🚨\n\nTotal Vehicles: ${result.totalVehicles}\nDetails: ${result.vehicles.map(v => `${v.type}: ${v.count}`).join(', ')}\n\nView details: ${detectionLink}`
//             );
            
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               telegramMessageId: telegramRes.message_id,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {
//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
//       })
//       .catch(async (err) => {
//         console.error('YOLO detection failed:', err);
//         detection.status = 'failed';
//         await detection.save();
//       });

//     res.json({
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get detection by ID
// exports.getDetectionById = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req.params.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections
// exports.getUserDetections = async (req, res) => {
//   try {
//     const detections = await Detection.find({ user: req.user.id })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         }
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
// //   }
// // };


// // controllers/detectionController.js - Updated with MobileNet SSD
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendTelegramNotification } = require('../utils/telegramBot');
// const { runMobileNetDetection } = require('../ml/mobileNetDetection');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// require('dotenv').config();

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../uploads');
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer
// exports.upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   // console.log("user",req.body.user)
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }

//     console.log("inside=============")
    
//     const { longitude, latitude,user } = req.body;

// let userId;

// // Check if user is a string that needs parsing
// if (typeof user === 'string') {
//   try {
//     const parsedUser = JSON.parse(user);
//     userId = parsedUser?._id;
//   } catch (e) {
//     // If not valid JSON, just use it directly
//     userId = user;
//   }
// } else if (user && user._id) {
//   // If it's already an object
//   userId = user._id;
// }

    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }
//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Create detection record
//     const detection = new Detection({
//       user:userId,

//       mediaUrl: `/uploads/${req.file.filename}`,
//       mediaType,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing'
//     });

//     await detection.save();

//     // Send immediate response to user
//     res.json({
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     });

//     // Process with MobileNet SSD in background
//     runMobileNetDetection(req.file.path, detection._id)
//       .then(async (result) => {
//         console.log("result===================",result)
//         // Update detection with results
//         try {
//           // Create a new cleaned-up detection result object
//           const cleanedResult = {
//             totalVehicles: result.totalVehicles || 0,
//             potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
//             detections: result.detections || [],
//             processedFrames: result.processedFrames || 0,
//             vehicles: [] // Start with empty array
//           };
          
//           // Handle vehicles data specifically
//           if (result.vehicles) {
//             if (Array.isArray(result.vehicles)) {
//               // If it's already an array, use it directly
//               cleanedResult.vehicles = result.vehicles;
//             } else if (typeof result.vehicles === 'string') {
//               // If it's a string, try to parse it
//               try {
//                 // This handles the case where it's a stringified array
//                 const parsed = JSON.parse(result.vehicles);
//                 cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
//               } catch (e) {
//                 // If it can't be parsed as JSON, create a single vehicle entry
//                 console.warn('Could not parse vehicles string:', result.vehicles);
//                 // Just make a single entry based on the string content
//                 cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
//               }
//             } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
//               // If it's a single object, put it in an array
//               cleanedResult.vehicles = [result.vehicles];
//             }
//           }
          
//           // Log the cleaned result for debugging
//           console.log('Cleaned detection result:', JSON.stringify(cleanedResult));
          
//           // Update the detection with the cleaned result
//           detection.detectionResults = cleanedResult;
//           detection.textSummary = result.textSummary;
//           detection.visualizationUrl = result.visualizationUrl;
//           detection.status = 'completed';
//           await detection.save();
//         } catch (err) {
//           console.error('Error processing detection results:', err);
//           detection.status = 'failed';
//           detection.errorMessage = 'Error processing detection results: ' + err.message;
//           await detection.save();
//         }



//         console.log('Request Coordinates:', parseFloat(longitude), parseFloat(latitude));

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           telegramChatId: { $ne: null }
//         });

//         console.log("Near-------------",nearbyOfficials)
//         // Notify officials with the detailed text summary
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Send Telegram notification with detailed text summary
//             const message = `🚨 Vehicle Detection Alert 🚨\n\n${result.textSummary}\n\nView details: ${detectionLink}`;
            
//             const telegramRes = await sendTelegramNotification(
//               official.telegramChatId,
//               message
//             );
            
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               telegramMessageId: telegramRes.message_id,
//               notificationText: result.textSummary,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {
//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
//       })
//       .catch(async (err) => {
//         console.error('MobileNet SSD detection failed:', err);
//         detection.status = 'failed';
//         detection.errorMessage = err.message;
//         await detection.save();
//       });

//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get detection by ID with text summary
// exports.getDetectionById = async (req, res) => {
//   // console.log("req",req)
//   try {
//     const detection = await Detection.findById(req?.params?.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections with summaries
// exports.getUserDetections = async (req, res) => {
// console.log("body",req.body)
// const {userId}=req.body
//   try {
//     const detections = await Detection.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId')
//       .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications with text summaries
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         },
//         select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles'
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get vehicle statistics 
// exports.getVehicleStatistics = async (req, res) => {
//   try {
//     // Get time range from query or use default (last 24 hours)
//     const timeRange = req.query.timeRange || '24h';
//     let timeFilter = {};
    
//     // Calculate time filter based on range
//     const now = new Date();
//     if (timeRange === '24h') {
//       timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '7d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '30d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
//     }
    
//     // Get all successful detections in the time range
//     const detections = await Detection.find({
//       ...timeFilter,
//       status: 'completed'
//     });
    
//     // Aggregate vehicle counts
//     const vehicleStats = {
//       totalDetections: detections.length,
//       totalVehicles: 0,
//       vehicleTypes: {}
//     };
    
//     // Process each detection
//     detections.forEach(detection => {
//       if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//         vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
//         // Count by vehicle type
//         if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
//           detection.detectionResults.vehicles.forEach(vehicle => {
//             if (!vehicleStats.vehicleTypes[vehicle.type]) {
//               vehicleStats.vehicleTypes[vehicle.type] = 0;
//             }
//             vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
//           });
//         }
//       }
//     });
    
//     // Convert vehicle types to array format
//     const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
//       type,
//       count
//     }));
    
//     // Sort by count (descending)
//     vehicleTypesArray.sort((a, b) => b.count - a.count);
    
//     vehicleStats.vehicleTypes = vehicleTypesArray;
//     console.log("Done=====")  
//     res.json(vehicleStats);
  
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };



// // controllers/detectionController.js
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendSmsNotification } = require('../utils/twilioSms');
// const { runMobileNetDetection } = require('../ml/mobileNetDetection');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// require('dotenv').config();

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../uploads');
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer
// exports.upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }
    
//     const { longitude, latitude, user } = req.body;

//     let userId;

//     // Check if user is a string that needs parsing
//     if (typeof user === 'string') {
//       try {
//         const parsedUser = JSON.parse(user);
//         userId = parsedUser?._id;
//       } catch (e) {
//         // If not valid JSON, just use it directly
//         userId = user;
//       }
//     } else if (user && user._id) {
//       // If it's already an object
//       userId = user._id;
//     }
    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }
    
//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Create detection record
//     const detection = new Detection({
//       user: userId,
//       mediaUrl: `/uploads/${req.file.filename}`,
//       mediaType,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing'
//     });

//     await detection.save();

//     // Send immediate response to user
//     res.json({
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     });

//     // Process with MobileNet SSD in background
//     runMobileNetDetection(req.file.path, detection._id)
//       .then(async (result) => {
//         // Update detection with results
//         let cleanedResult;
//         try {
//           // Create a new cleaned-up detection result object
//            cleanedResult = {
//             totalVehicles: result.totalVehicles || 0,
//             potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
//             detections: result.detections || [],
//             processedFrames: result.processedFrames || 0,
//             vehicles: [] // Start with empty array
//           };
          
//           // Handle vehicles data specifically
//           if (result.vehicles) {
//             if (Array.isArray(result.vehicles)) {
//               // If it's already an array, use it directly
//               cleanedResult.vehicles = result.vehicles;
//             } else if (typeof result.vehicles === 'string') {
//               // If it's a string, try to parse it
//               try {
//                 // This handles the case where it's a stringified array
//                 const parsed = JSON.parse(result.vehicles);
//                 cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
//               } catch (e) {
//                 // If it can't be parsed as JSON, create a single vehicle entry
//                 console.warn('Could not parse vehicles string:', result.vehicles);
//                 // Just make a single entry based on the string content
//                 cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
//               }
//             } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
//               // If it's a single object, put it in an array
//               cleanedResult.vehicles = [result.vehicles];
//             }
//           }
          
//           // Update the detection with the cleaned result
//           detection.detectionResults = cleanedResult;
//           detection.textSummary = result.textSummary;
//           detection.visualizationUrl = result.visualizationUrl;
//           detection.status = 'completed';
//           await detection.save();
//         } catch (err) {
//           console.error('Error processing detection results:', err);
//           detection.status = 'failed';
//           detection.errorMessage = 'Error processing detection results: ' + err.message;
//           await detection.save();
//           return;
//         }

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         });

//         // Notify officials with the detailed text summary
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link for SMS
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Format SMS message - Keep it brief for SMS character limits
//             const message = `🚨 Traffic Alert: ${cleanedResult.totalVehicles} vehicles detected. ${
//               cleanedResult.potentialEmergencyVehicles > 0 ? 
//               cleanedResult.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
//             }Details: ${detectionLink}`;
            
//             // Send SMS notification
//             const smsResponse = await sendSmsNotification(
//               official.phoneNumber,
//               message
//             );
            
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               smsMessageSid: smsResponse.sid,
//               notificationText: message,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {
//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
//       })
//       .catch(async (err) => {
//         console.error('MobileNet SSD detection failed:', err);
//         detection.status = 'failed';
//         detection.errorMessage = err.message;
//         await detection.save();
//       });

//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get detection by ID with text summary
// exports.getDetectionById = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req?.params?.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId phoneNumber');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections with summaries
// exports.getUserDetections = async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const detections = await Detection.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId')
//       .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications with text summaries
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         },
//         select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles'
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get vehicle statistics 
// exports.getVehicleStatistics = async (req, res) => {
//   try {
//     // Get time range from query or use default (last 24 hours)
//     const timeRange = req.query.timeRange || '24h';
//     let timeFilter = {};
    
//     // Calculate time filter based on range
//     const now = new Date();
//     if (timeRange === '24h') {
//       timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '7d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '30d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
//     }
    
//     // Get all successful detections in the time range
//     const detections = await Detection.find({
//       ...timeFilter,
//       status: 'completed'
//     });
    
//     // Aggregate vehicle counts
//     const vehicleStats = {
//       totalDetections: detections.length,
//       totalVehicles: 0,
//       vehicleTypes: {}
//     };
    
//     // Process each detection
//     detections.forEach(detection => {
//       if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//         vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
//         // Count by vehicle type
//         if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
//           detection.detectionResults.vehicles.forEach(vehicle => {
//             if (!vehicleStats.vehicleTypes[vehicle.type]) {
//               vehicleStats.vehicleTypes[vehicle.type] = 0;
//             }
//             vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
//           });
//         }
//       }
//     });
    
//     // Convert vehicle types to array format
//     const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
//       type,
//       count
//     }));
    
//     // Sort by count (descending)
//     vehicleTypesArray.sort((a, b) => b.count - a.count);
    
//     vehicleStats.vehicleTypes = vehicleTypesArray;
    
//     res.json(vehicleStats);
  
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };



// // controllers/detectionController.js
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendSmsNotification } = require('../utils/twilioSms');
// const { runMobileNetDetection } = require('../ml/mobileNetDetection');
// const multer = require('multer');
// const path = require('path');
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const fs = require('fs');
// const os = require('os');
// require('dotenv').config();

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// // Create a temporary storage for processing files before uploading to Cloudinary
// const tempStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, os.tmpdir());
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer with temporary storage
// exports.upload = multer({
//   storage: tempStorage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }
    
//     const { longitude, latitude, user } = req.body;

//     let userId;

//     // Check if user is a string that needs parsing
//     if (typeof user === 'string') {
//       try {
//         const parsedUser = JSON.parse(user);
//         userId = parsedUser?._id;
//       } catch (e) {
//         // If not valid JSON, just use it directly
//         userId = user;
//       }
//     } else if (user && user._id) {
//       // If it's already an object
//       userId = user._id;
//     }
    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }
    
//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Upload to Cloudinary
//     const folder = 'traffic-detection';
//     const uploadResult = await cloudinary.uploader.upload(req.file.path, {
//       resource_type: mediaType === 'image' ? 'image' : 'video',
//       folder
//     });
    
//     // Create detection record
//     const detection = new Detection({
//       user: userId,
//       mediaUrl: uploadResult.secure_url,
//       mediaType,
//       cloudinaryPublicId: uploadResult.public_id,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing'
//     });

//     await detection.save();

//     // Send immediate response to user
//     res.json({
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     });

//     // Process with MobileNet SSD in background
//     runMobileNetDetection(req.file.path, detection._id)
//       .then(async (result) => {
//         // Upload visualization to Cloudinary if it exists
//         let visualizationUrl = null;
//         if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
//           const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
//             resource_type: 'image',
//             folder: `${folder}/visualizations`
//           });
//           visualizationUrl = visualizationUpload.secure_url;
          
//           // Clean up local visualization file
//           fs.unlinkSync(result.visualizationUrl);
//         }
        
//         // Update detection with results
//         let cleanedResult;
//         try {
//           // Create a new cleaned-up detection result object
//            cleanedResult = {
//             totalVehicles: result.totalVehicles || 0,
//             potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
//             detections: result.detections || [],
//             processedFrames: result.processedFrames || 0,
//             vehicles: [] // Start with empty array
//           };
          
//           // Handle vehicles data specifically
//           if (result.vehicles) {
//             if (Array.isArray(result.vehicles)) {
//               // If it's already an array, use it directly
//               cleanedResult.vehicles = result.vehicles;
//             } else if (typeof result.vehicles === 'string') {
//               // If it's a string, try to parse it
//               try {
//                 // This handles the case where it's a stringified array
//                 const parsed = JSON.parse(result.vehicles);
//                 cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
//               } catch (e) {
//                 // If it can't be parsed as JSON, create a single vehicle entry
//                 console.warn('Could not parse vehicles string:', result.vehicles);
//                 // Just make a single entry based on the string content
//                 cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
//               }
//             } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
//               // If it's a single object, put it in an array
//               cleanedResult.vehicles = [result.vehicles];
//             }
//           }
          
//           // Update the detection with the cleaned result
//           detection.detectionResults = cleanedResult;
//           detection.textSummary = result.textSummary;
//           detection.visualizationUrl = visualizationUrl;
//           detection.status = 'completed';
//           await detection.save();
//         } catch (err) {
//           console.error('Error processing detection results:', err);
//           detection.status = 'failed';
//           detection.errorMessage = 'Error processing detection results: ' + err.message;
//           await detection.save();
//           return;
//         }

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         });

//         console.log("near by",nearbyOfficials)
//         // Notify officials with the detailed text summary
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link for SMS
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Format SMS message - Keep it brief for SMS character limits
//             const message = `🚨 Traffic Alert: ${cleanedResult.totalVehicles} vehicles detected. ${
//               cleanedResult.potentialEmergencyVehicles > 0 ? 
//               cleanedResult.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
//             }Details: ${detectionLink}`;
            
//             console.log("sendeing")
//             // Send SMS notification
//             const smsResponse = await sendSmsNotification(
//               official.phoneNumber,
//               message
//             );
//             console.log("msg sent")
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               smsMessageSid: smsResponse.sid,
//               notificationText: message,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {

//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
        
//         // Clean up temp file after processing
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       })
//       .catch(async (err) => {
//         console.error('MobileNet SSD detection failed:', err);
//         detection.status = 'failed';
//         detection.errorMessage = err.message;
//         await detection.save();
        
//         // Clean up temp file on error
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       });

//   } catch (err) {
//     console.error(err.message);
    
//     // Clean up temp file on error
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get detection by ID with text summary
// exports.getDetectionById = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req?.params?.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId phoneNumber');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections with summaries
// exports.getUserDetections = async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const detections = await Detection.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId')
//       .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications with text summaries
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         },
//         select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles'
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get vehicle statistics 
// exports.getVehicleStatistics = async (req, res) => {
//   try {
//     // Get time range from query or use default (last 24 hours)
//     const timeRange = req.query.timeRange || '24h';
//     let timeFilter = {};
    
//     // Calculate time filter based on range
//     const now = new Date();
//     if (timeRange === '24h') {
//       timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '7d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '30d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
//     }
    
//     // Get all successful detections in the time range
//     const detections = await Detection.find({
//       ...timeFilter,
//       status: 'completed'
//     });
    
//     // Aggregate vehicle counts
//     const vehicleStats = {
//       totalDetections: detections.length,
//       totalVehicles: 0,
//       vehicleTypes: {}
//     };
    
//     // Process each detection
//     detections.forEach(detection => {
//       if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//         vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
//         // Count by vehicle type
//         if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
//           detection.detectionResults.vehicles.forEach(vehicle => {
//             if (!vehicleStats.vehicleTypes[vehicle.type]) {
//               vehicleStats.vehicleTypes[vehicle.type] = 0;
//             }
//             vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
//           });
//         }
//       }
//     });
    
//     // Convert vehicle types to array format
//     const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
//       type,
//       count
//     }));
    
//     // Sort by count (descending)
//     vehicleTypesArray.sort((a, b) => b.count - a.count);
    
//     vehicleStats.vehicleTypes = vehicleTypesArray;
    
//     res.json(vehicleStats);
  
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Delete detection and associated Cloudinary media
// exports.deleteDetection = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req.params.id);
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     // Check if user owns the detection
//     if (detection.user.toString() !== req.user.id) {
//       return res.status(401).json({ msg: 'User not authorized' });
//     }
    
//     // Delete media from Cloudinary
//     if (detection.cloudinaryPublicId) {
//       await cloudinary.uploader.destroy(detection.cloudinaryPublicId, { 
//         resource_type: detection.mediaType === 'image' ? 'image' : 'video' 
//       });
//     }
    
//     // Delete visualization from Cloudinary if exists
//     if (detection.visualizationUrl && detection.visualizationUrl.includes('cloudinary')) {
//       // Extract public_id from URL
//       const urlParts = detection.visualizationUrl.split('/');
//       const filename = urlParts[urlParts.length - 1].split('.')[0];
//       const folder = urlParts[urlParts.length - 2];
//       const publicId = `${folder}/${filename}`;
      
//       await cloudinary.uploader.destroy(publicId);
//     }
    
//     // Delete detection from database
//     await Detection.findByIdAndRemove(req.params.id);
    
//     // Delete associated notifications
//     await Notification.deleteMany({ detection: req.params.id });
    
//     res.json({ msg: 'Detection deleted' });
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };


// // controllers/detectionController.js
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendSmsNotification } = require('../utils/twilioSms');
// const { runYoloDetection } = require('../ml/yoloDetection');
// const multer = require('multer');
// const path = require('path');
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const fs = require('fs');
// const os = require('os');
// require('dotenv').config();

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// // Create a temporary storage for processing files before uploading to Cloudinary
// const tempStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, os.tmpdir());
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer with temporary storage
// exports.upload = multer({
//   storage: tempStorage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }
    
//     const { longitude, latitude, user } = req.body;

//     let userId;

//     // Check if user is a string that needs parsing
//     if (typeof user === 'string') {
//       try {
//         const parsedUser = JSON.parse(user);
//         userId = parsedUser?._id;
//       } catch (e) {
//         // If not valid JSON, just use it directly
//         userId = user;
//       }
//     } else if (user && user._id) {
//       // If it's already an object
//       userId = user._id;
//     }
    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }
    
//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Upload to Cloudinary
//     const folder = 'traffic-detection';
//     const uploadResult = await cloudinary.uploader.upload(req.file.path, {
//       resource_type: mediaType === 'image' ? 'image' : 'video',
//       folder
//     });
    
//     // Create detection record
//     const detection = new Detection({
//       user: userId,
//       mediaUrl: uploadResult.secure_url,
//       mediaType,
//       cloudinaryPublicId: uploadResult.public_id,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing'
//     });

//     await detection.save();

//     // Send immediate response to user
//     res.json({
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     });

//     // Process with YOLOv8 in background
//     runYoloDetection(req.file.path, detection._id)
//       .then(async (result) => {
//         // Upload visualization to Cloudinary if it exists
//         let visualizationUrl = null;
//         if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
//           const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
//             resource_type: 'image',
//             folder: `${folder}/visualizations`
//           });
//           visualizationUrl = visualizationUpload.secure_url;
          
//           // Clean up local visualization file
//           fs.unlinkSync(result.visualizationUrl);
//         }
        
//         // Update detection with results
//         let cleanedResult;
//         try {
//           // Create a new cleaned-up detection result object
//            cleanedResult = {
//             totalVehicles: result.totalVehicles || 0,
//             potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
//             detections: result.detections || [],
//             processedFrames: result.processedFrames || 0,
//             vehicles: [] // Start with empty array
//           };
          
//           // Handle vehicles data specifically
//           if (result.vehicles) {
//             if (Array.isArray(result.vehicles)) {
//               // If it's already an array, use it directly
//               cleanedResult.vehicles = result.vehicles;
//             } else if (typeof result.vehicles === 'string') {
//               // If it's a string, try to parse it
//               try {
//                 // This handles the case where it's a stringified array
//                 const parsed = JSON.parse(result.vehicles);
//                 cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
//               } catch (e) {
//                 // If it can't be parsed as JSON, create a single vehicle entry
//                 console.warn('Could not parse vehicles string:', result.vehicles);
//                 // Just make a single entry based on the string content
//                 cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
//               }
//             } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
//               // If it's a single object, put it in an array
//               cleanedResult.vehicles = [result.vehicles];
//             }
//           }
          
//           // Update the detection with the cleaned result
//           detection.detectionResults = cleanedResult;
//           detection.textSummary = result.textSummary;
//           detection.visualizationUrl = visualizationUrl;
//           detection.status = 'completed';
//           await detection.save();
//         } catch (err) {
//           console.error('Error processing detection results:', err);
//           detection.status = 'failed';
//           detection.errorMessage = 'Error processing detection results: ' + err.message;
//           await detection.save();
//           return;
//         }

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         });

//         console.log("nearby:", nearbyOfficials.length, "officials");
        
//         // Notify officials with the detailed text summary
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link for SMS
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Format SMS message - Keep it brief for SMS character limits
//             const message = `🚨 Traffic Alert: ${cleanedResult.totalVehicles} vehicles detected. ${
//               cleanedResult.potentialEmergencyVehicles > 0 ? 
//               cleanedResult.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
//             }Details: ${detectionLink}`;
            
//             console.log("Sending SMS to", official.phoneNumber);
            
//             // Send SMS notification
//             const smsResponse = await sendSmsNotification(
//               official.phoneNumber,
//               message
//             );
            
//             console.log("SMS sent, SID:", smsResponse.sid);
            
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               smsMessageSid: smsResponse.sid,
//               notificationText: message,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {
//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
        
//         // Clean up temp file after processing
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       })
//       .catch(async (err) => {
//         console.error('YOLOv8 detection failed:', err);
//         detection.status = 'failed';
//         detection.errorMessage = err.message;
//         await detection.save();
        
//         // Clean up temp file on error
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       });

//   } catch (err) {
//     console.error(err.message);
    
//     // Clean up temp file on error
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get detection by ID with text summary
// exports.getDetectionById = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req?.params?.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId phoneNumber');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections with summaries
// exports.getUserDetections = async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const detections = await Detection.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId')
//       .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications with text summaries
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         },
//         select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles'
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get vehicle statistics 
// exports.getVehicleStatistics = async (req, res) => {
//   try {
//     // Get time range from query or use default (last 24 hours)
//     const timeRange = req.query.timeRange || '24h';
//     let timeFilter = {};
    
//     // Calculate time filter based on range
//     const now = new Date();
//     if (timeRange === '24h') {
//       timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '7d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '30d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
//     }
    
//     // Get all successful detections in the time range
//     const detections = await Detection.find({
//       ...timeFilter,
//       status: 'completed'
//     });
    
//     // Aggregate vehicle counts
//     const vehicleStats = {
//       totalDetections: detections.length,
//       totalVehicles: 0,
//       vehicleTypes: {}
//     };
    
//     // Process each detection
//     detections.forEach(detection => {
//       if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//         vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
//         // Count by vehicle type
//         if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
//           detection.detectionResults.vehicles.forEach(vehicle => {
//             if (!vehicleStats.vehicleTypes[vehicle.type]) {
//               vehicleStats.vehicleTypes[vehicle.type] = 0;
//             }
//             vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
//           });
//         }
//       }
//     });
    
//     // Convert vehicle types to array format
//     const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
//       type,
//       count
//     }));
    
//     // Sort by count (descending)
//     vehicleTypesArray.sort((a, b) => b.count - a.count);
    
//     vehicleStats.vehicleTypes = vehicleTypesArray;
    
//     res.json(vehicleStats);
  
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Delete detection and associated Cloudinary media
// exports.deleteDetection = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req.params.id);
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     // Check if user owns the detection
//     if (detection.user.toString() !== req.user.id) {
//       return res.status(401).json({ msg: 'User not authorized' });
//     }
    
//     // Delete media from Cloudinary
//     if (detection.cloudinaryPublicId) {
//       await cloudinary.uploader.destroy(detection.cloudinaryPublicId, { 
//         resource_type: detection.mediaType === 'image' ? 'image' : 'video' 
//       });
//     }
    
//     // Delete visualization from Cloudinary if exists
//     if (detection.visualizationUrl && detection.visualizationUrl.includes('cloudinary')) {
//       // Extract public_id from URL
//       const urlParts = detection.visualizationUrl.split('/');
//       const filename = urlParts[urlParts.length - 1].split('.')[0];
//       const folder = urlParts[urlParts.length - 2];
//       const publicId = `${folder}/${filename}`;
      
//       await cloudinary.uploader.destroy(publicId);
//     }
    
//     // Delete detection from database
//     await Detection.findByIdAndRemove(req.params.id);
    
//     // Delete associated notifications
//     await Notification.deleteMany({ detection: req.params.id });
    
//     res.json({ msg: 'Detection deleted' });
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// // };



// // controllers/detectionController.js
// const Detection = require('../models/Detection');
// const Official = require('../models/Official');
// const Notification = require('../models/Notification');
// const { sendSmsNotification } = require('../utils/twilioSms');
// const { runYoloDetection } = require('../ml/yoloDetection');
// const multer = require('multer');
// const path = require('path');
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const fs = require('fs');
// const os = require('os');
// const axios = require('axios');  // Add axios for Google API requests
// require('dotenv').config();

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// // Create a temporary storage for processing files before uploading to Cloudinary
// const tempStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, os.tmpdir());
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   }
// });

// // File filter for images and videos
// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype === 'image/jpeg' ||
//     file.mimetype === 'image/png' ||
//     file.mimetype === 'video/mp4'
//   ) {
//     cb(null, true);
//   } else {
//     cb(new Error('Unsupported file format'), false);
//   }
// };

// // Configure multer with temporary storage
// exports.upload = multer({
//   storage: tempStorage,
//   fileFilter,
//   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// });

// // Fetch nearby hospitals and ambulance services
// const fetchNearbyMedicalServices = async (latitude, longitude) => {
//   try {
//     // Get hospitals
//     const hospitalsResponse = await axios.get(
//       `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
//       {
//         params: {
//           location: `${latitude},${longitude}`,
//           radius: 5000, // 5km radius
//           type: 'hospital',
//           key: process.env.GOOGLE_MAPS_API_KEY
//         }
//       }
//     );

//     // Get ambulance services (often categorized under 'health' in Google Places)
//     const ambulanceResponse = await axios.get(
//       `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
//       {
//         params: {
//           location: `${latitude},${longitude}`,
//           radius: 5000, // 5km radius
//           keyword: 'ambulance',
//           key: process.env.GOOGLE_MAPS_API_KEY
//         }
//       }
//     );

//     // Process results
//     const hospitals = hospitalsResponse.data.results.map(h => ({
//       name: h.name,
//       vicinity: h.vicinity,
//       rating: h.rating,
//       place_id: h.place_id,
//       location: h.geometry.location,
//       open_now: h.opening_hours?.open_now
//     })).slice(0, 5); // Limit to top 5

//     const ambulances = ambulanceResponse.data.results.map(a => ({
//       name: a.name,
//       vicinity: a.vicinity,
//       rating: a.rating,
//       place_id: a.place_id,
//       location: a.geometry.location,
//       open_now: a.opening_hours?.open_now
//     })).slice(0, 3); // Limit to top 3

//     return {
//       hospitals,
//       ambulances
//     };
//   } catch (error) {
//     console.error('Error fetching medical services:', error);
//     return { hospitals: [], ambulances: [] };
//   }
// };

// // Process media upload
// exports.processMediaUpload = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ msg: 'No file uploaded' });
//     }
    
//     const { longitude, latitude, user, isAccident } = req.body;

//     let userId;

//     // Check if user is a string that needs parsing
//     if (typeof user === 'string') {
//       try {
//         const parsedUser = JSON.parse(user);
//         userId = parsedUser?._id;
//       } catch (e) {
//         // If not valid JSON, just use it directly
//         userId = user;
//       }
//     } else if (user && user._id) {
//       // If it's already an object
//       userId = user._id;
//     }
    
//     if (!longitude || !latitude) {
//       return res.status(400).json({ msg: 'Location coordinates are required' });
//     }
    
//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
//     // Upload to Cloudinary
//     const folder = 'traffic-detection';
//     const uploadResult = await cloudinary.uploader.upload(req.file.path, {
//       resource_type: mediaType === 'image' ? 'image' : 'video',
//       folder
//     });
    
//     // Create detection record with accident flag
//     const detection = new Detection({
//       user: userId,
//       mediaUrl: uploadResult.secure_url,
//       mediaType,
//       cloudinaryPublicId: uploadResult.public_id,
//       location: {
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       status: 'processing',
//       isAccident: isAccident === 'true' || isAccident === true // Store boolean value
//     });

//     await detection.save();

//     // Prepare response
//     const responseData = {
//       msg: 'Media uploaded successfully',
//       detectionId: detection._id,
//       status: 'processing'
//     };

//     // If this is an accident, fetch nearby medical services
//     if (isAccident === 'true' || isAccident === true) {
//       const medicalServices = await fetchNearbyMedicalServices(latitude, longitude);
//       responseData.medicalServices = medicalServices;
      
//       // Store the medical services info with the detection for reference
//       detection.medicalServices = medicalServices;
//       await detection.save();
//     }

//     // Send response to user
//     res.json(responseData);

//     // Process with YOLOv8 in background
//     runYoloDetection(req.file.path, detection._id)
//       .then(async (result) => {
//         // Upload visualization to Cloudinary if it exists
//         let visualizationUrl = null;
//         if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
//           const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
//             resource_type: 'image',
//             folder: `${folder}/visualizations`
//           });
//           visualizationUrl = visualizationUpload.secure_url;
          
//           // Clean up local visualization file
//           fs.unlinkSync(result.visualizationUrl);
//         }
        
//         // Update detection with results
//         let cleanedResult;
//         try {
//           // Create a new cleaned-up detection result object
//            cleanedResult = {
//             totalVehicles: result.totalVehicles || 0,
//             potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
//             detections: result.detections || [],
//             processedFrames: result.processedFrames || 0,
//             vehicles: [] // Start with empty array
//           };
          
//           // Handle vehicles data specifically
//           if (result.vehicles) {
//             if (Array.isArray(result.vehicles)) {
//               // If it's already an array, use it directly
//               cleanedResult.vehicles = result.vehicles;
//             } else if (typeof result.vehicles === 'string') {
//               // If it's a string, try to parse it
//               try {
//                 // This handles the case where it's a stringified array
//                 const parsed = JSON.parse(result.vehicles);
//                 cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
//               } catch (e) {
//                 // If it can't be parsed as JSON, create a single vehicle entry
//                 console.warn('Could not parse vehicles string:', result.vehicles);
//                 // Just make a single entry based on the string content
//                 cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
//               }
//             } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
//               // If it's a single object, put it in an array
//               cleanedResult.vehicles = [result.vehicles];
//             }
//           }
          
//           // Update the detection with the cleaned result
//           detection.detectionResults = cleanedResult;
//           detection.textSummary = result.textSummary;
//           detection.visualizationUrl = visualizationUrl;
//           detection.status = 'completed';
//           await detection.save();
//         } catch (err) {
//           console.error('Error processing detection results:', err);
//           detection.status = 'failed';
//           detection.errorMessage = 'Error processing detection results: ' + err.message;
//           await detection.save();
//           return;
//         }

//         // Find nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 5000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         });

//         console.log("nearby:", nearbyOfficials.length, "officials");
        
//         // Notify officials with the detailed text summary
//         const notifiedOfficials = [];
//         for (const official of nearbyOfficials) {
//           try {
//             // Create notification link for SMS
//             const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
//             // Format SMS message - Keep it brief for SMS character limits
//             let message = `🚨 Traffic Alert: ${cleanedResult.totalVehicles} vehicles detected. ${
//               cleanedResult.potentialEmergencyVehicles > 0 ? 
//               cleanedResult.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
//             }`;
            
//             // Add accident info if applicable
//             if (detection.isAccident) {
//               message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed.`;
//             }
            
//             message += `Details: ${detectionLink}`;
            
//             console.log("Sending SMS to", official.phoneNumber);
            
//             // Send SMS notification
//             const smsResponse = await sendSmsNotification(
//               official.phoneNumber,
//               message
//             );
            
//             console.log("SMS sent, SID:", smsResponse.sid);
            
//             // Save notification record
//             const notification = new Notification({
//               detection: detection._id,
//               official: official._id,
//               smsMessageSid: smsResponse.sid,
//               notificationText: message,
//               status: 'sent'
//             });
            
//             await notification.save();
//             notifiedOfficials.push(official._id);
//           } catch (err) {
//             console.error(`Failed to notify official ${official._id}:`, err);
//           }
//         }

//         // Update detection with notified officials
//         detection.notifiedOfficials = notifiedOfficials;
//         await detection.save();
        
//         // Clean up temp file after processing
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       })
//       .catch(async (err) => {
//         console.error('YOLOv8 detection failed:', err);
//         detection.status = 'failed';
//         detection.errorMessage = err.message;
//         await detection.save();
        
//         // Clean up temp file on error
//         if (fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//         }
//       });

//   } catch (err) {
//     console.error(err.message);
    
//     // Clean up temp file on error
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Other existing functions...
// exports.getDetectionById = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req?.params?.id)
//       .populate('user', 'name email')
//       .populate('notifiedOfficials', 'name badgeId phoneNumber');
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.json(detection);
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// // Get user's detections with summaries
// exports.getUserDetections = async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const detections = await Detection.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate('notifiedOfficials', 'name badgeId')
//       .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles isAccident');
    
//     res.json(detections);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get official's notifications with text summaries
// exports.getOfficialNotifications = async (req, res) => {
//   try {
//     const notifications = await Notification.find({ official: req.official.id })
//       .sort({ createdAt: -1 })
//       .populate({
//         path: 'detection',
//         populate: {
//           path: 'user',
//           select: 'name'
//         },
//         select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles isAccident'
//       });
    
//     res.json(notifications);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Mark notification as read
// exports.markNotificationAsRead = async (req, res) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       official: req.official.id
//     });
    
//     if (!notification) {
//       return res.status(404).json({ msg: 'Notification not found' });
//     }
    
//     notification.status = 'read';
//     await notification.save();
    
//     res.json({ msg: 'Notification marked as read' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get medical services for a specific location
// exports.getMedicalServices = async (req, res) => {
//   try {
//     const { latitude, longitude } = req.query;
    
//     if (!latitude || !longitude) {
//       return res.status(400).json({ msg: 'Latitude and longitude are required' });
//     }
    
//     const medicalServices = await fetchNearbyMedicalServices(latitude, longitude);
//     res.json(medicalServices);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Get vehicle statistics 
// exports.getVehicleStatistics = async (req, res) => {
//   try {
//     // Get time range from query or use default (last 24 hours)
//     const timeRange = req.query.timeRange || '24h';
//     let timeFilter = {};
    
//     // Calculate time filter based on range
//     const now = new Date();
//     if (timeRange === '24h') {
//       timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '7d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
//     } else if (timeRange === '30d') {
//       timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
//     }
    
//     // Get all successful detections in the time range
//     const detections = await Detection.find({
//       ...timeFilter,
//       status: 'completed'
//     });
    
//     // Aggregate vehicle counts
//     const vehicleStats = {
//       totalDetections: detections.length,
//       totalVehicles: 0,
//       totalAccidents: detections.filter(d => d.isAccident).length,
//       vehicleTypes: {}
//     };
    
//     // Process each detection
//     detections.forEach(detection => {
//       if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//         vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
//         // Count by vehicle type
//         if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
//           detection.detectionResults.vehicles.forEach(vehicle => {
//             if (!vehicleStats.vehicleTypes[vehicle.type]) {
//               vehicleStats.vehicleTypes[vehicle.type] = 0;
//             }
//             vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
//           });
//         }
//       }
//     });
    
//     // Convert vehicle types to array format
//     const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
//       type,
//       count
//     }));
    
//     // Sort by count (descending)
//     vehicleTypesArray.sort((a, b) => b.count - a.count);
    
//     vehicleStats.vehicleTypes = vehicleTypesArray;
    
//     res.json(vehicleStats);
  
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// // Delete detection and associated Cloudinary media
// exports.deleteDetection = async (req, res) => {
//   try {
//     const detection = await Detection.findById(req.params.id);
    
//     if (!detection) {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     // Check if user owns the detection
//     if (detection.user.toString() !== req.user.id) {
//       return res.status(401).json({ msg: 'User not authorized' });
//     }
    
//     // Delete media from Cloudinary
//     if (detection.cloudinaryPublicId) {
//       await cloudinary.uploader.destroy(detection.cloudinaryPublicId, { 
//         resource_type: detection.mediaType === 'image' ? 'image' : 'video' 
//       });
//     }
    
//     // Delete visualization from Cloudinary if exists
//     if (detection.visualizationUrl && detection.visualizationUrl.includes('cloudinary')) {
//       // Extract public_id from URL
//       const urlParts = detection.visualizationUrl.split('/');
//       const filename = urlParts[urlParts.length - 1].split('.')[0];
//       const folder = urlParts[urlParts.length - 2];
//       const publicId = `${folder}/${filename}`;
      
//       await cloudinary.uploader.destroy(publicId);
//     }
    
//     // Delete detection from database
//     await Detection.findByIdAndRemove(req.params.id);
    
//     // Delete associated notifications
//     await Notification.deleteMany({ detection: req.params.id });
    
//     res.json({ msg: 'Detection deleted' });
//   } catch (err) {
//     console.error(err.message);
    
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Detection not found' });
//     }
    
//     res.status(500).send('Server error');
//   }
// };

// controllers/detectionController.js
const Detection = require('../models/Detection');
const Official = require('../models/Official');
const Notification = require('../models/Notification');
const { sendSmsNotification } = require('../utils/twilioSms');
const { runYoloDetection } = require('../ml/yoloDetection');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fs = require('fs');
const os = require('os');
const axios = require('axios');  // We'll still use axios for API requests
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create a temporary storage for processing files before uploading to Cloudinary
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter for images and videos
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'video/mp4'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format'), false);
  }
};

// Configure multer with temporary storage
exports.upload = multer({
  storage: tempStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Fetch nearby hospitals and ambulance services using Overpass API
// Fetch nearby hospitals and ambulance services using Overpass API
const fetchNearbyMedicalServices = async (latitude, longitude) => {
  try {
    // Define radius for search in meters
    const radius = 5000; // 5km radius
    
    // Overpass API query for hospitals
    const hospitalQuery = `
      [out:json];
      (
        node["amenity"="hospital"](around:${radius},${latitude},${longitude});
        way["amenity"="hospital"](around:${radius},${latitude},${longitude});
        relation["amenity"="hospital"](around:${radius},${latitude},${longitude});
      );
      out body;
      >;
      out skel qt;
    `;
    
    // Overpass API query for ambulance services
    const ambulanceQuery = `
      [out:json];
      (
        node["emergency"="ambulance_station"](around:${radius},${latitude},${longitude});
        way["emergency"="ambulance_station"](around:${radius},${latitude},${longitude});
        relation["emergency"="ambulance_station"](around:${radius},${latitude},${longitude});
      );
      out body;
      >;
      out skel qt;
    `;
    
    // Make requests to Overpass API
    const hospitalsResponse = await axios.post(
      'https://overpass-api.de/api/interpreter',
      hospitalQuery,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const ambulanceResponse = await axios.post(
      'https://overpass-api.de/api/interpreter',
      ambulanceQuery,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Process hospital results
    const hospitals = hospitalsResponse.data.elements
      .filter(element => element.type === 'node' && element.tags) // Filter for nodes with tags
      .map(h => ({
        name: h.tags.name || 'Unnamed Hospital',
        vicinity: h.tags.addr ? 
          `${h.tags["addr:housenumber"] || ''} ${h.tags["addr:street"] || ''}`.trim() : 
          'No address',
        place_id: h.id.toString(),
        location: {
          lat: h.lat,
          lng: h.lon
        },
        phone: h.tags.phone
      }))
      .slice(0, 5); // Limit to top 5
    
    // Process ambulance results
    const ambulances = ambulanceResponse.data.elements
      .filter(element => element.type === 'node' && element.tags) // Filter for nodes with tags
      .map(a => ({
        name: a.tags.name || 'Ambulance Service',
        vicinity: a.tags.addr ? 
          `${a.tags["addr:housenumber"] || ''} ${a.tags["addr:street"] || ''}`.trim() : 
          'No address',
        place_id: a.id.toString(),
        location: {
          lat: a.lat,
          lng: a.lon
        },
        phone: a.tags.phone
      }))
      .slice(0, 3); // Limit to top 3
    
    return {
      hospitals,
      ambulances
    };
  } catch (error) {
    console.error('Error fetching medical services:', error);
    
    // Fallback to Nominatim API if Overpass fails
    try {
      // Fetch hospitals with Nominatim
      const hospitalsResponse = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: 'hospital',
            format: 'json',
            addressdetails: 1,
            limit: 5,
            'accept-language': 'en',
            countrycodes: 'us',
            bounded: 1,
            viewbox: `${longitude - 0.1},${latitude - 0.1},${longitude + 0.1},${latitude + 0.1}`
          },
          headers: {
            'User-Agent': 'TrafficMonitor/1.0' // Important: Nominatim requires a User-Agent
          }
        }
      );
      
      // Fetch ambulance services with Nominatim
      const ambulanceResponse = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: 'ambulance',
            format: 'json',
            addressdetails: 1,
            limit: 3,
            'accept-language': 'en',
            countrycodes: 'us',
            bounded: 1,
            viewbox: `${longitude - 0.1},${latitude - 0.1},${longitude + 0.1},${latitude + 0.1}`
          },
          headers: {
            'User-Agent': 'TrafficMonitor/1.0'
          }
        }
      );
      
      // Process results
      const hospitals = hospitalsResponse.data.map(h => ({
        name: h.display_name.split(',')[0] || 'Hospital',
        vicinity: h.display_name,
        place_id: h.place_id,
        location: {
          lat: parseFloat(h.lat),
          lng: parseFloat(h.lon)
        }
      }));
      
      const ambulances = ambulanceResponse.data.map(a => ({
        name: a.display_name.split(',')[0] || 'Ambulance Service',
        vicinity: a.display_name,
        place_id: a.place_id,
        location: {
          lat: parseFloat(a.lat),
          lng: parseFloat(a.lon)
        }
      }));
      
      return {
        hospitals,
        ambulances
      };
      
    } catch (fallbackError) {
      console.error('Fallback API also failed:', fallbackError);
      return { hospitals: [], ambulances: [] };
    }
  }
};

// Process media upload
exports.processMediaUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const { longitude, latitude, user, isAccident } = req.body;

    let userId;

    // Check if user is a string that needs parsing
    if (typeof user === 'string') {
      try {
        const parsedUser = JSON.parse(user);
        userId = parsedUser?._id;
      } catch (e) {
        // If not valid JSON, just use it directly
        userId = user;
      }
    } else if (user && user._id) {
      // If it's already an object
      userId = user._id;
    }
    
    if (!longitude || !latitude) {
      return res.status(400).json({ msg: 'Location coordinates are required' });
    }
    
    // Determine media type
    const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    
    // Upload to Cloudinary
    const folder = 'traffic-detection';
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: mediaType === 'image' ? 'image' : 'video',
      folder
    });
    
    // Create detection record with accident flag
    const detection = new Detection({
      user: userId,
      mediaUrl: uploadResult.secure_url,
      mediaType,
      cloudinaryPublicId: uploadResult.public_id,
      location: {
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      status: 'processing',
      isAccident: isAccident === 'true' || isAccident === true // Store boolean value
    });

    await detection.save();

    // Prepare response
    const responseData = {
      msg: 'Media uploaded successfully',
      detectionId: detection._id,
      status: 'processing'
    };

    // If this is an accident, fetch nearby medical services
    if (isAccident === 'true' || isAccident === true) {
      const medicalServices = await fetchNearbyMedicalServices(latitude, longitude);
      responseData.medicalServices = medicalServices;
      
      // Store the medical services info with the detection for reference
      detection.medicalServices = medicalServices;
      await detection.save();
    }

    // Send response to user
    res.json(responseData);

    // Process with YOLOv8 in background
    runYoloDetection(req.file.path, detection._id)
      .then(async (result) => {
        // Upload visualization to Cloudinary if it exists
        let visualizationUrl = null;
        if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
          const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
            resource_type: 'image',
            folder: `${folder}/visualizations`
          });
          visualizationUrl = visualizationUpload.secure_url;
          
          // Clean up local visualization file
          fs.unlinkSync(result.visualizationUrl);
        }
        
        // Update detection with results
        let cleanedResult;
        try {
          // Create a new cleaned-up detection result object
           cleanedResult = {
            totalVehicles: result.totalVehicles || 0,
            potentialEmergencyVehicles: result.potentialEmergencyVehicles || 0,
            detections: result.detections || [],
            processedFrames: result.processedFrames || 0,
            vehicles: [] // Start with empty array
          };
          
          // Handle vehicles data specifically
          if (result.vehicles) {
            if (Array.isArray(result.vehicles)) {
              // If it's already an array, use it directly
              cleanedResult.vehicles = result.vehicles;
            } else if (typeof result.vehicles === 'string') {
              // If it's a string, try to parse it
              try {
                // This handles the case where it's a stringified array
                const parsed = JSON.parse(result.vehicles);
                cleanedResult.vehicles = Array.isArray(parsed) ? parsed : [parsed];
              } catch (e) {
                // If it can't be parsed as JSON, create a single vehicle entry
                console.warn('Could not parse vehicles string:', result.vehicles);
                // Just make a single entry based on the string content
                cleanedResult.vehicles = [{ type: 'unknown', count: cleanedResult.totalVehicles || 1 }];
              }
            } else if (typeof result.vehicles === 'object' && !Array.isArray(result.vehicles)) {
              // If it's a single object, put it in an array
              cleanedResult.vehicles = [result.vehicles];
            }
          }
          
          // Update the detection with the cleaned result
          detection.detectionResults = cleanedResult;
          detection.textSummary = result.textSummary;
          detection.visualizationUrl = visualizationUrl;
          detection.status = 'completed';
          await detection.save();
        } catch (err) {
          console.error('Error processing detection results:', err);
          detection.status = 'failed';
          detection.errorMessage = 'Error processing detection results: ' + err.message;
          await detection.save();
          return;
        }

        // Find nearby officials
        const nearbyOfficials = await Official.find({
          isOnDuty: true,
          dutyLocation: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
              },
              $maxDistance: 5000 // 5 km radius
            }
          },
          phoneNumber: { $ne: null } // Only officials with phone numbers
        });

        console.log("nearby:", nearbyOfficials.length, "officials");
        
        // Notify officials with the detailed text summary
        const notifiedOfficials = [];
        for (const official of nearbyOfficials) {
          try {
            // Create notification link for SMS
            const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
            
            // Format SMS message - Keep it brief for SMS character limits
            let message = `🚨 Traffic Alert: ${cleanedResult.totalVehicles} vehicles detected. ${
              cleanedResult.potentialEmergencyVehicles > 0 ? 
              cleanedResult.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
            }`;
            
            // Add accident info if applicable
            if (detection.isAccident) {
              message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed.`;
            }
            
            message += `Details: ${detectionLink}`;
            
            console.log("Sending SMS to", official.phoneNumber);
            
            // Send SMS notification
            const smsResponse = await sendSmsNotification(
              official.phoneNumber,
              message
            );
            
            console.log("SMS sent, SID:", smsResponse.sid);
            
            // Save notification record
            const notification = new Notification({
              detection: detection._id,
              official: official._id,
              smsMessageSid: smsResponse.sid,
              notificationText: message,
              status: 'sent'
            });
            
            await notification.save();
            notifiedOfficials.push(official._id);
          } catch (err) {
            console.error(`Failed to notify official ${official._id}:`, err);
          }
        }

        // Update detection with notified officials
        detection.notifiedOfficials = notifiedOfficials;
        await detection.save();
        
        // Clean up temp file after processing
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      })
      .catch(async (err) => {
        console.error('YOLOv8 detection failed:', err);
        detection.status = 'failed';
        detection.errorMessage = err.message;
        await detection.save();
        
        // Clean up temp file on error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      });

  } catch (err) {
    console.error(err.message);
    
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).send('Server error');
  }
};

// Other existing functions...
exports.getDetectionById = async (req, res) => {
  try {
    const detection = await Detection.findById(req?.params?.id)
      .populate('user', 'name email')
      .populate('notifiedOfficials', 'name badgeId phoneNumber');
    
    if (!detection) {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    res.json(detection);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    res.status(500).send('Server error');
  }
};

// Get user's detections with summaries
exports.getUserDetections = async (req, res) => {
  const { userId } = req.body;
  try {
    const detections = await Detection.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('notifiedOfficials', 'name badgeId')
      .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles isAccident');
    
    res.json(detections);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get official's notifications with text summaries
exports.getOfficialNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ official: req.official.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'detection',
        populate: {
          path: 'user',
          select: 'name'
        },
        select: 'mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles isAccident'
      });
    
    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      official: req.official.id
    });
    
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    
    notification.status = 'read';
    await notification.save();
    
    res.json({ msg: 'Notification marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get medical services for a specific location
exports.getMedicalServices = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ msg: 'Latitude and longitude are required' });
    }
    
    const medicalServices = await fetchNearbyMedicalServices(latitude, longitude);
    res.json(medicalServices);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get vehicle statistics 
exports.getVehicleStatistics = async (req, res) => {
  try {
    // Get time range from query or use default (last 24 hours)
    const timeRange = req.query.timeRange || '24h';
    let timeFilter = {};
    
    // Calculate time filter based on range
    const now = new Date();
    if (timeRange === '24h') {
      timeFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    } else if (timeRange === '7d') {
      timeFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (timeRange === '30d') {
      timeFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
    }
    
    // Get all successful detections in the time range
    const detections = await Detection.find({
      ...timeFilter,
      status: 'completed'
    });
    
    // Aggregate vehicle counts
    const vehicleStats = {
      totalDetections: detections.length,
      totalVehicles: 0,
      totalAccidents: detections.filter(d => d.isAccident).length,
      vehicleTypes: {}
    };
    
    // Process each detection
    detections.forEach(detection => {
      if (detection.detectionResults && detection.detectionResults.totalVehicles) {
        vehicleStats.totalVehicles += detection.detectionResults.totalVehicles;
        
        // Count by vehicle type
        if (detection.detectionResults.vehicles && Array.isArray(detection.detectionResults.vehicles)) {
          detection.detectionResults.vehicles.forEach(vehicle => {
            if (!vehicleStats.vehicleTypes[vehicle.type]) {
              vehicleStats.vehicleTypes[vehicle.type] = 0;
            }
            vehicleStats.vehicleTypes[vehicle.type] += vehicle.count;
          });
        }
      }
    });
    
    // Convert vehicle types to array format
    const vehicleTypesArray = Object.entries(vehicleStats.vehicleTypes).map(([type, count]) => ({
      type,
      count
    }));
    
    // Sort by count (descending)
    vehicleTypesArray.sort((a, b) => b.count - a.count);
    
    vehicleStats.vehicleTypes = vehicleTypesArray;
    
    res.json(vehicleStats);
  
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Delete detection and associated Cloudinary media
exports.deleteDetection = async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.id);
    
    if (!detection) {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    // Check if user owns the detection
    if (detection.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    // Delete media from Cloudinary
    if (detection.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(detection.cloudinaryPublicId, { 
        resource_type: detection.mediaType === 'image' ? 'image' : 'video' 
      });
    }
    
    // Delete visualization from Cloudinary if exists
    if (detection.visualizationUrl && detection.visualizationUrl.includes('cloudinary')) {
      // Extract public_id from URL
      const urlParts = detection.visualizationUrl.split('/');
      const filename = urlParts[urlParts.length - 1].split('.')[0];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${filename}`;
      
      await cloudinary.uploader.destroy(publicId);
    }
    
    // Delete detection from database
    await Detection.findByIdAndRemove(req.params.id);
    
    // Delete associated notifications
    await Notification.deleteMany({ detection: req.params.id });
    
    res.json({ msg: 'Detection deleted' });
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    res.status(500).send('Server error');
  }
};