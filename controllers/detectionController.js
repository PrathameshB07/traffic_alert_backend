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

const ExifReader = require('exifreader');
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');


const {sendWhatsAppNotification}= require('../utils/twilioWhatsapp')

const { sendWebPushNotification, createNotificationPayload } = require('../utils/webPushNotification');


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
// Replace the fetchNearbyMedicalServices function with this implementation
const fetchNearbyMedicalServices = async (latitude, longitude) => {
  try {
    // Define radius for search in meters
    const radius = 5000; // 5km radius
    const tomtomApiKey = process.env.TOMTOM_API_KEY; // Add this to your .env file
    
    // Fetch hospitals using TomTom Search API
    const hospitalsResponse = await axios.get(
      `https://api.tomtom.com/search/2/categorySearch/hospital.json`,
      {
        params: {
          key: tomtomApiKey,
          lat: latitude,
          lon: longitude,
          radius,
          limit: 5
        }
      }
    );
    
    // Fetch ambulance services using TomTom Search API
    const ambulanceResponse = await axios.get(
      `https://api.tomtom.com/search/2/categorySearch/emergency-medical-service.json`,
      {
        params: {
          key: tomtomApiKey,
          lat: latitude,
          lon: longitude,
          radius,
          limit: 3
        }
      }
    );
    
    // Process hospital results
    const hospitals = hospitalsResponse.data.results.map(h => ({
      name: h.poi?.name || 'Unnamed Hospital',
      vicinity: h.address?.freeformAddress || 'No address',
      place_id: h.id,
      location: {
        lat: h.position?.lat,
        lng: h.position?.lon
      },
      phone: h.poi?.phone
    }));
    
    // Process ambulance results
    const ambulances = ambulanceResponse.data.results.map(a => ({
      name: a.poi?.name || 'Ambulance Service',
      vicinity: a.address?.freeformAddress || 'No address',
      place_id: a.id,
      location: {
        lat: a.position?.lat,
        lng: a.position?.lon
      },
      phone: a.poi?.phone
    }));
    
    return {
      hospitals,
      ambulances
    };
  } catch (error) {
    console.error('Error fetching medical services with TomTom API:', error);
    
    // Fallback to Nominatim API as before
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
// Helper function to notify an official
// const notifyOfficial = async (official, detection, detectionResults) => {
//   try {
//     // Create notification link for SMS
//     const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
    
//     // Format SMS message - Keep it brief for SMS character limits
//     let message = `🚨 Traffic Alert: ${detectionResults.totalVehicles} vehicles detected. ${
//       detectionResults.potentialEmergencyVehicles > 0 ? 
//       detectionResults.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
//     }`;
    
//     // Add accident info if applicable
//     if (detection.isAccident) {
//       message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed.`;
//     }
    
//     message += ` Details: ${detectionLink}`;
    
//     console.log("Sending WhatsApp notification to", official.phoneNumber);
    
//     // Send WhatsApp notification
//     const smsResponse = await sendWhatsAppNotification(official.phoneNumber, message);
    
//     console.log("WhatsApp notification sent, SID:", smsResponse.sid);
    
//     // Save notification record
//     const notification = new Notification({
//       detection: detection._id,
//       official: official._id,
//       smsMessageSid: smsResponse.sid,
//       notificationText: message,
//       status: 'sent'
//     });
    
//     await notification.save();
//     return notification;
//   } catch (err) {
//     console.error(`Failed to notify official ${official._id}:`, err);
//     throw err;
//   }
// };

const notifyOfficial = async (official, detection, detectionResults) => {
  try {
    // Create notification link for SMS
    const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
    
    // Format SMS message - Keep it brief for SMS character limits
    let message = `🚨 Traffic Alert: ${detectionResults.totalVehicles} vehicles detected. ${
      detectionResults.potentialEmergencyVehicles > 0 ? 
      detectionResults.potentialEmergencyVehicles + ' possible emergency vehicles. ' : ''
    }`;
    
    // Add accident info if applicable
    if (detection.isAccident) {
      message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed.`;
    }
    
    message += ` Details: ${detectionLink}`;
    
    console.log("Sending WhatsApp notification to", official.phoneNumber);
    
    // Send WhatsApp notification
    const smsResponse = await sendSmsNotification(official.phoneNumber, message);
    
    console.log("WhatsApp notification sent, SID:", smsResponse.sid);
    
    // Check if official has push subscription and send web push notification
    if (official.pushSubscription) {
      try {
        const notificationPayload = createNotificationPayload(detection, detectionResults);
        
        await sendWebPushNotification(
          official.pushSubscription,
          notificationPayload
        );
        
        console.log("Web push notification sent to official:", official._id);
      } catch (pushError) {
        console.error("Failed to send web push notification:", pushError);
        // Continue execution even if push notification fails
      }
    }
    else{
      console.log("not found")
    }
    
    // Save notification record
    const notification = new Notification({
      detection: detection._id,
      official: official._id,
      smsMessageSid: smsResponse.sid,
      notificationText: message,
      status: 'sent'
    });
    
    await notification.save();
    return notification;
  } catch (err) {
    console.error(`Failed to notify official ${official._id}:`, err);
    throw err;
  }
};

// Helper function to validate media freshness
const validateMediaFreshness = async (filePath, mediaType) => {
  try {
    // Define the threshold for "freshness" (in milliseconds)
    const FRESHNESS_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const currentTime = new Date().getTime();
    let captureTime = null;

    if (mediaType === 'image') {
      // Read EXIF data from image
      const tags = ExifReader.load(fs.readFileSync(filePath));
      
      // Try to get the capture date from various possible tags
      if (tags.DateTimeOriginal) {
        const dateStr = tags.DateTimeOriginal.description;
        captureTime = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')).getTime();
      } else if (tags.DateTime) {
        const dateStr = tags.DateTime.description;
        captureTime = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')).getTime();
      } else if (tags.CreateDate) {
        const dateStr = tags.CreateDate.description;
        captureTime = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')).getTime();
      }
    } else if (mediaType === 'video') {
      // Use ffprobe to extract video metadata
      const info = await ffprobe(filePath, { path: ffprobeStatic.path });
      
      // Look for creation_time in format tags
      const formatTags = info.format?.tags;
      if (formatTags && formatTags.creation_time) {
        captureTime = new Date(formatTags.creation_time).getTime();
      }
    }

    // If we couldn't find any capture time metadata
    if (!captureTime) {
      console.log("No capture time metadata found, checking file creation time");
      // Fall back to file stats if no metadata found
      const stats = fs.statSync(filePath);
      captureTime = stats.birthtime.getTime() || stats.mtime.getTime();
    }

    // Check if the media was captured within the freshness threshold
    const timeDiff = currentTime - captureTime;
    const isFresh = timeDiff <= FRESHNESS_THRESHOLD_MS;

    return {
      isFresh,
      captureTime: new Date(captureTime),
      timeDiffMinutes: Math.floor(timeDiff / (60 * 1000))
    };
  } catch (err) {
    console.error('Error validating media freshness:', err);
    // If metadata validation fails, we can't determine freshness
    return { isFresh: false, error: err.message };
  }
};

// Process media upload
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
//       isAccident: isAccident === 'true' || isAccident === true, // Store boolean value
//       notifiedOfficials: [], // Initialize with empty array
//       rejectedBy: []  // Initialize with empty array for officials who reject
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
//     .then(async (result) => {
//       // Upload visualization to Cloudinary if it exists
//       let visualizationUrl = null;
//       if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
//         const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
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
//           cleanedResult = {
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

//         // Find and store all nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 1000000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         }).sort({ 
//           dutyLocation: 1 // Sort by proximity (nearest first)
//         });
        
//         console.log("Found:", nearbyOfficials);
        
//         // Store the array of all nearby officials in the detection for future use
//         detection.availableOfficials = nearbyOfficials.map(official => official._id);
//         await detection.save();
        
//         // Send notification only to the nearest official if any are available
//         if (nearbyOfficials.length > 0) {
//           const nearestOfficial = nearbyOfficials[0];
//           await notifyOfficial(nearestOfficial, detection, cleanedResult);
          
//           // Update the detection with the currently notified official
//           detection.currentlyNotified = nearestOfficial._id;
//           detection.notifiedOfficials = [nearestOfficial._id];
//           await detection.save();
//         } else {
//           console.log("No nearby officials available");
//         }
        
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

//     // Check for recently reported incidents at the same location (within 5 minutes)
//     // Define the time threshold (5 minutes ago)
//     const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
//     // Define a small radius for checking nearby incidents (in coordinate units)
//     const proximityRadius = 0.001; // Approx 100m in coordinate units (depends on latitude)
    
//     // Since we might have issues with geospatial index, use a simple coordinate-based query
//     // Find recent detections within the time threshold first
//     const recentDetections = await Detection.find({
//       createdAt: { $gte: fiveMinutesAgo },
//       taskStatus: { $ne: 'completed' }, // Not yet completed
//       status: { $ne: 'failed' } // Not failed detections
//     });
    
//     // Then manually filter by distance
//     const parsedLat = parseFloat(latitude);
//     const parsedLng = parseFloat(longitude);
    
//     // Find the first detection that is within the proximity radius
//     const recentNearbyDetection = recentDetections.find(detection => {
//       if (!detection.location || !detection.location.coordinates || 
//           detection.location.coordinates.length !== 2) {
//         return false;
//       }
      
//       const detectionLng = detection.location.coordinates[0];
//       const detectionLat = detection.location.coordinates[1];
      
//       // Calculate rough distance using coordinate difference
//       // This is a simple check that will work for small distances
//       const latDiff = Math.abs(detectionLat - parsedLat);
//       const lngDiff = Math.abs(detectionLng - parsedLng);
      
//       return (latDiff < proximityRadius && lngDiff < proximityRadius);
//     });
    
//     // If a similar recent detection exists, inform the user
//     if (recentNearbyDetection) {
//       return res.status(200).json({
//         msg: 'A similar incident was already reported in this area within the last 5 minutes',
//         status: 'duplicate',
//         detectionId: recentNearbyDetection._id,
//         existingDetection: {
//           id: recentNearbyDetection._id,
//           createdAt: recentNearbyDetection.createdAt,
//           status: recentNearbyDetection.taskStatus
//         }
//       });
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
//       isAccident: isAccident === 'true' || isAccident === true, // Store boolean value
//       notifiedOfficials: [], // Initialize with empty array
//       rejectedBy: []  // Initialize with empty array for officials who reject
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
//     .then(async (result) => {
//       // Upload visualization to Cloudinary if it exists
//       let visualizationUrl = null;
//       if (result.visualizationUrl && fs.existsSync(result.visualizationUrl)) {
//         const visualizationUpload = await cloudinary.uploader.upload(result.visualizationUrl, {
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
//           cleanedResult = {
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

//         // Find and store all nearby officials
//         const nearbyOfficials = await Official.find({
//           isOnDuty: true,
//           dutyLocation: {
//             $near: {
//               $geometry: {
//                 type: 'Point',
//                 coordinates: [parseFloat(longitude), parseFloat(latitude)]
//               },
//               $maxDistance: 1000000 // 5 km radius
//             }
//           },
//           phoneNumber: { $ne: null } // Only officials with phone numbers
//         }).sort({ 
//           dutyLocation: 1 // Sort by proximity (nearest first)
//         });
        
//         console.log("Found:", nearbyOfficials);
        
//         // Store the array of all nearby officials in the detection for future use
//         detection.availableOfficials = nearbyOfficials.map(official => official._id);
//         await detection.save();
        
//         // Send notification only to the nearest official if any are available
//         if (nearbyOfficials.length > 0) {
//           const nearestOfficial = nearbyOfficials[0];
//           await notifyOfficial(nearestOfficial, detection, cleanedResult);
          
//           // Update the detection with the currently notified official
//           detection.currentlyNotified = nearestOfficial._id;
//           detection.notifiedOfficials = [nearestOfficial._id];
//           await detection.save();
//         } else {
//           console.log("No nearby officials available");
//         }
        
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

// Modify the processMediaUpload function to include freshness validation
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
    
    // Validate freshness of the uploaded media
    const freshness = await validateMediaFreshness(req.file.path, mediaType);
    
    // If the media is not fresh, return an error response
    if (!freshness.isFresh && !freshness.error) {
      return res.status(400).json({
        msg: `The uploaded ${mediaType} appears to be ${freshness.timeDiffMinutes} minutes old. Please upload recent media (less than 30 minutes old).`,
        status: 'outdated_media'
      });
    }
    
    // If there was an error checking metadata, log it but continue
    if (freshness.error) {
      console.warn(`Metadata validation error: ${freshness.error}. Proceeding with upload.`);
    }

    // Check for recently reported incidents at the same location (within 5 minutes)
    // Define the time threshold (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Define a small radius for checking nearby incidents (in coordinate units)
    const proximityRadius = 0.001; // Approx 100m in coordinate units (depends on latitude)
    
    // Since we might have issues with geospatial index, use a simple coordinate-based query
    // Find recent detections within the time threshold first
    const recentDetections = await Detection.find({
      createdAt: { $gte: fiveMinutesAgo },
      taskStatus: { $ne: 'completed' }, // Not yet completed
      status: { $ne: 'failed' } // Not failed detections
    });
    
    // Then manually filter by distance
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);
    
    // Find the first detection that is within the proximity radius
    const recentNearbyDetection = recentDetections.find(detection => {
      if (!detection.location || !detection.location.coordinates || 
          detection.location.coordinates.length !== 2) {
        return false;
      }
      
      const detectionLng = detection.location.coordinates[0];
      const detectionLat = detection.location.coordinates[1];
      
      // Calculate rough distance using coordinate difference
      // This is a simple check that will work for small distances
      const latDiff = Math.abs(detectionLat - parsedLat);
      const lngDiff = Math.abs(detectionLng - parsedLng);
      
      return (latDiff < proximityRadius && lngDiff < proximityRadius);
    });
    
    // If a similar recent detection exists, inform the user
    if (recentNearbyDetection) {
      return res.status(200).json({
        msg: 'A similar incident was already reported in this area within the last 5 minutes',
        status: 'duplicate',
        detectionId: recentNearbyDetection._id,
        existingDetection: {
          id: recentNearbyDetection._id,
          createdAt: recentNearbyDetection.createdAt,
          status: recentNearbyDetection.taskStatus
        }
      });
    }
    
    // Upload to Cloudinary
    const folder = 'traffic-detection';
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: mediaType === 'image' ? 'image' : 'video',
      folder
    });
    
    // Create detection record with accident flag and metadata
    const detection = new Detection({
      user: userId,
      mediaUrl: uploadResult.secure_url,
      mediaType,
      cloudinaryPublicId: uploadResult.public_id,
      location: {
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      status: 'processing',
      isAccident: isAccident === 'true' || isAccident === true,
      notifiedOfficials: [],
      rejectedBy: [],
      mediaMeta: {
        captureTime: freshness.captureTime,
        validationResult: freshness.error ? 'validation_error' : (freshness.isFresh ? 'fresh' : 'outdated')
      }
    });
    
    await detection.save();
    
    // Prepare response
    const responseData = {
      msg: 'Media uploaded successfully',
      detectionId: detection._id,
      status: 'processing',
      mediaFreshness: freshness.error ? 'unknown' : (freshness.isFresh ? 'verified_fresh' : 'outdated')
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

        // Find and store all nearby officials
        const nearbyOfficials = await Official.find({
          isOnDuty: true,
          dutyLocation: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
              },
              $maxDistance: 1000000 // 5 km radius
            }
          },
          phoneNumber: { $ne: null } // Only officials with phone numbers
        }).sort({ 
          dutyLocation: 1 // Sort by proximity (nearest first)
        });
        
        console.log("Found:", nearbyOfficials);
        
        // Store the array of all nearby officials in the detection for future use
        detection.availableOfficials = nearbyOfficials.map(official => official._id);
        await detection.save();
        
        // Send notification only to the nearest official if any are available
        if (nearbyOfficials.length > 0) {
          const nearestOfficial = nearbyOfficials[0];
          await notifyOfficial(nearestOfficial, detection, cleanedResult);
          
          // Update the detection with the currently notified official
          detection.currentlyNotified = nearestOfficial._id;
          detection.notifiedOfficials = [nearestOfficial._id];
          await detection.save();
        } else {
          console.log("No nearby officials available");
        }
        
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

// Update Detection schema to include metadata fields
// In models/Detection.js, add these fields:
/*
  mediaMeta: {
    captureTime: Date,
    validationResult: {
      type: String,
      enum: ['fresh', 'outdated', 'validation_error'],
      default: 'validation_error'
    }
  }
*/

// Add this function to check if media is fresh before processing
exports.validateMediaBeforeProcessing = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const freshness = await validateMediaFreshness(req.file.path, mediaType);
    
    // Store freshness data in request for later use
    req.mediaFreshness = freshness;
    
    // If strict validation is enabled via query parameter
    if (req.query.strictValidation === 'true' && !freshness.isFresh && !freshness.error) {
      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        msg: `The uploaded ${mediaType} appears to be ${freshness.timeDiffMinutes} minutes old. Please upload recent media (less than 30 minutes old).`,
        status: 'outdated_media'
      });
    }
    
    // Continue with the next middleware or route handler
    next();
  } catch (err) {
    console.error('Media validation middleware error:', err);
    
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).send('Server error during media validation');
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
  console.log("jhskjgkj")
  try {
    const detections = await Detection.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('notifiedOfficials', 'name badgeId')
      // .select('mediaUrl mediaType status createdAt textSummary visualizationUrl detectionResults.totalVehicles isAccident');
      
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

// Accept a detection task
exports.acceptTask = async (req, res) => {
  try {
    const { detectionId } = req.params;
    const officialId = req.official.id;
    
    const detection = await Detection.findById(detectionId);
    
    if (!detection) {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    // Check if the detection is already accepted by someone else
    if (detection.acceptedBy && detection.acceptedBy.toString() !== officialId) {
      return res.status(400).json({ 
        msg: 'This task has already been accepted by another official' 
      });
    }
    
    // Check if the official previously rejected this task
    if (detection.rejectedBy && detection.rejectedBy.includes(officialId)) {
      return res.status(400).json({ 
        msg: 'You previously rejected this task and cannot accept it now' 
      });
    }
    
    // Update detection with the accepting official
    detection.acceptedBy = officialId;
    detection.taskStatus = 'accepted';
    detection.currentlyNotified = null; // Clear the currently notified field
    await detection.save();
    
    // Update the notification status
    const notification = await Notification.findOne({ 
      detection: detectionId,
      official: officialId
    });
    
    if (notification) {
      notification.status = 'accepted';
      await notification.save();
    }
    
    res.json({ 
      msg: 'Task accepted successfully',
      detection
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


  // Reject a detection task
  exports.rejectTask = async (req, res) => {
    try {
      const { detectionId } = req.params;
      const officialId = req.official.id;
      
      const detection = await Detection.findById(detectionId);
      
      if (!detection) {
        return res.status(404).json({ msg: 'Detection not found' });
      }
      
      // Check if the task is already accepted by this official
      if (detection.acceptedBy && detection.acceptedBy.toString() === officialId) {
        return res.status(400).json({ 
          msg: 'You have already accepted this task. Please release it first.' 
        });
    }
    
    // Add official to rejected list if not already there
    if (!detection.rejectedBy) {
      detection.rejectedBy = [];
    }
    
    if (!detection.rejectedBy.includes(officialId)) {
      detection.rejectedBy.push(officialId);
    }
    
    await detection.save();
    
    console.log("current detection state",detection)
    
    // Update the notification status
    const notification = await Notification.findOne({ 
      detection: detectionId,
      official: officialId
    });
    
    if (notification) {
      notification.status = 'rejected';
      await notification.save();
    }
    
    // Clear the currently notified field since this official rejected
    if (detection.currentlyNotified && detection.currentlyNotified.toString() === officialId) {
      detection.currentlyNotified = null;
      await detection.save();
    }
    
    // Find the next nearest official to notify
    await notifyNextNearestOfficial(detection);
    
    res.json({ 
      msg: 'Task rejected successfully',
      detection
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


// Mark task as completed
exports.completeTask = async (req, res) => {
  try {
    const { detectionId } = req.params;
    const officialId = req.official.id;
    
    const detection = await Detection.findById(detectionId);
    
    if (!detection) {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    // Check if the task is accepted by this official
    if (!detection.acceptedBy || detection.acceptedBy.toString() !== officialId) {
      return res.status(400).json({ 
        msg: 'You must accept this task before marking it as complete' 
      });
    }
    
    // Update detection status
    detection.taskStatus = 'completed';
    detection.completedAt = new Date();
    await detection.save();
    
    // Update notification status
    const notification = await Notification.findOne({ 
      detection: detectionId,
      official: officialId
    });
    
    if (notification) {
      notification.status = 'completed';
      await notification.save();
    }
    
    res.json({ 
      msg: 'Task marked as completed',
      detection
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


// const notifyNextNearestOfficial = async (detection) => {
//         try {
//           // Get detection location
//     const [longitude, latitude] = detection.location.coordinates;
    
//     // Find the next nearest official who hasn't rejected this task and hasn't been notified
//     const nearbyOfficials = await Official.find({
//       isOnDuty: true,
//       dutyLocation: {
//         $near: {
//           $geometry: {
//             type: 'Point',
//             coordinates: [parseFloat(longitude), parseFloat(latitude)]
//           },
//           $maxDistance: 1000000 // 10 km radius (increased from 5km)
//         }
//       },
//       phoneNumber: { $ne: null }, // Only officials with phone numbers
//       _id: { 
//         $nin: detection.rejectedBy, // Exclude officials who rejected
//         $ne: detection.acceptedBy   // Exclude official who accepted
//       }
//     }).sort({ dutyLocation: 1 }); // Sort by proximity (nearest first)
    
//     console.log("nearby",nearbyOfficials)
//     console.log("notified nearby",detection?.notifiedOfficials)
    
//     // Filter out officials who have already been notified
//     const unnotifiedOfficials = nearbyOfficials.filter(official => 
//       !detection.notifiedOfficials.some(id => id.toString() === official._id.toString())
//     );
    

    
//     if (unnotifiedOfficials.length === 0) {
//       console.log('No more officials available nearby');
//       return false;
//     }
    
//     const nextOfficial = unnotifiedOfficials[0];
    
//     // Create notification link for SMS
//     const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
    
//     // Format message
//     let message = `🚨 Traffic Alert: `;
    
//     if (detection.detectionResults && detection.detectionResults.totalVehicles) {
//       message += `${detection.detectionResults.totalVehicles} vehicles detected. `;
      
//       if (detection.detectionResults.potentialEmergencyVehicles > 0) {
//         message += `${detection.detectionResults.potentialEmergencyVehicles} possible emergency vehicles. `;
//       }
//     }
    
//     // Add accident info if applicable
//     if (detection.isAccident) {
//       message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed. `;
//     }
    
//     message += `Task needs attention as previous official(s) unavailable. Details: ${detectionLink}`;
    
//     console.log("Sending WhatsApp notification to next official:", nextOfficial.phoneNumber);
    
//     // Send WhatsApp notification
//     const smsResponse = await sendWhatsAppNotification(nextOfficial.phoneNumber, message);
    
//     console.log("WhatsApp notification sent to next official, SID:", smsResponse.sid);
    
//     // Save notification record
//     const notification = new Notification({
//       detection: detection._id,
//       official: nextOfficial._id,
//       smsMessageSid: smsResponse.sid,
//       notificationText: message,
//       status: 'sent'
//     });
    
//     await notification.save();
    
//     // Add to notified officials list
//     if (!detection.notifiedOfficials.includes(nextOfficial._id)) {
//       detection.notifiedOfficials.push(nextOfficial._id);
//     }
    
//     // Update the currently notified field to this new official
//     detection.currentlyNotified = nextOfficial._id;
//     await detection.save();
    
//     return true;
//   } catch (err) {
//     console.error('Error notifying next official:', err);
//     return false;
//   }
// };


const notifyNextNearestOfficial = async (detection) => {
  try {
    // Get detection location
    const [longitude, latitude] = detection.location.coordinates;
    
    // Find the next nearest official who hasn't rejected this task and hasn't been notified
    const nearbyOfficials = await Official.find({
      isOnDuty: true,
      dutyLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: 1000000 // 10 km radius (increased from 5km)
        }
      },
      phoneNumber: { $ne: null }, // Only officials with phone numbers
      _id: { 
        $nin: detection.rejectedBy, // Exclude officials who rejected
        $ne: detection.acceptedBy   // Exclude official who accepted
      }
    }).sort({ dutyLocation: 1 }); // Sort by proximity (nearest first)
    
    console.log("nearby",nearbyOfficials)
    console.log("notified nearby",detection?.notifiedOfficials)
    
    // Filter out officials who have already been notified
    const unnotifiedOfficials = nearbyOfficials.filter(official => 
      !detection.notifiedOfficials.some(id => id.toString() === official._id.toString())
    );
    
    if (unnotifiedOfficials.length === 0) {
      console.log('No more officials available nearby');
      return false;
    }
    
    const nextOfficial = unnotifiedOfficials[0];
    
    // Create notification link for SMS
    const detectionLink = `${process.env.FRONTEND_URL}/official/detection/${detection._id}`;
    
    // Format message
    let message = `🚨 Traffic Alert: `;
    
    if (detection.detectionResults && detection.detectionResults.totalVehicles) {
      message += `${detection.detectionResults.totalVehicles} vehicles detected. `;
      
      if (detection.detectionResults.potentialEmergencyVehicles > 0) {
        message += `${detection.detectionResults.potentialEmergencyVehicles} possible emergency vehicles. `;
      }
    }
    
    // Add accident info if applicable
    if (detection.isAccident) {
      message = `🚑 ACCIDENT ALERT: ${message} Medical attention needed. `;
    }
    
    message += `Task needs attention as previous official(s) unavailable. Details: ${detectionLink}`;
    
    console.log("Sending WhatsApp notification to next official:", nextOfficial.phoneNumber);
    
    // Send WhatsApp notification
    const smsResponse = await sendWhatsAppNotification(nextOfficial.phoneNumber, message);
    
    console.log("WhatsApp notification sent to next official, SID:", smsResponse.sid);
    
    // Send web push notification if the official has a subscription
    if (nextOfficial.pushSubscription) {
      try {
        // Create notification payload based on detection data
        const notificationPayload = createNotificationPayload(detection, detection.detectionResults);
        notificationPayload.body += 'Task needs attention as previous official(s) unavailable.';
        
        await sendWebPushNotification(
          nextOfficial.pushSubscription,
          notificationPayload
        );
        
        console.log("Web push notification sent to next official:", nextOfficial._id);
      } catch (pushError) {
        console.error("Failed to send web push notification to next official:", pushError);
        // Continue execution even if push notification fails
      }
    }
    
    // Save notification record
    const notification = new Notification({
      detection: detection._id,
      official: nextOfficial._id,
      smsMessageSid: smsResponse.sid,
      notificationText: message,
      status: 'sent'
    });
    
    await notification.save();
    
    // Add to notified officials list
    if (!detection.notifiedOfficials.includes(nextOfficial._id)) {
      detection.notifiedOfficials.push(nextOfficial._id);
    }
    
    // Update the currently notified field to this new official
    detection.currentlyNotified = nextOfficial._id;
    await detection.save();
    
    return true;
  } catch (err) {
    console.error('Error notifying next official:', err);
    return false;
  }
};


// Get detailed detection status including notification history
exports.getDetectionStatus = async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.id)
    .populate('user', 'name email')
    .populate('notifiedOfficials', 'name badgeId phoneNumber')
    .populate('currentlyNotified', 'name badgeId phoneNumber')
    .populate('acceptedBy', 'name badgeId phoneNumber')
    .populate('rejectedBy', 'name badgeId phoneNumber');
    
    if (!detection) {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    // Get all notifications related to this detection to build a timeline
    const notifications = await Notification.find({ detection: req.params.id })
    .populate('official', 'name badgeId')
    .sort({ createdAt: 1 });
    
    // Build notification timeline
    const timeline = notifications.map(notification => ({
      timestamp: notification.createdAt,
      officialId: notification.official._id,
      officialName: notification.official.name,
      badgeId: notification.official.badgeId,
      status: notification.status,
      messageId: notification.smsMessageSid
    }));
    
    res.json({
      detection,
      notificationTimeline: timeline,
      currentStatus: {
        processingStatus: detection.status,
        taskStatus: detection.taskStatus,
        currentlyNotified: detection.currentlyNotified,
        acceptedBy: detection.acceptedBy,
        totalNotified: detection.notifiedOfficials.length,
        totalRejected: detection.rejectedBy.length
      }
    });
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Detection not found' });
    }
    
    res.status(500).send('Server error');
  }
};




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