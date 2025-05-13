// 3. Create utils/webPushNotification.js
const webpush = require('web-push');
require('dotenv').config();

// Configure web-push with VAPID keys
const vapidKeys = {
  publicKey: process.env.WEB_PUSH_PUBLIC_KEY,
  privateKey: process.env.WEB_PUSH_PRIVATE_KEY
};

webpush.setVapidDetails(
  `mailto:${process.env.WEB_PUSH_EMAIL}`,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Function to send web push notification
exports.sendWebPushNotification = async (subscription, payload) => {
  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return result;
  } catch (error) {
    console.error('Error sending web push notification:', error);
    throw error;
  }
};



exports.createNotificationPayload = (detection, detectionResults) => {
  // Create notification payload
  let title = detection.isAccident ? '🚑 ACCIDENT ALERT' : '🚨 Traffic Alert';
  
  let body = '';
  if (detectionResults && detectionResults.totalVehicles) {
    body += `${detectionResults.totalVehicles} vehicles detected. `;
    
    if (detectionResults.potentialEmergencyVehicles > 0) {
      body += `${detectionResults.potentialEmergencyVehicles} possible emergency vehicles. `;
    }
  }
  
  if (detection.isAccident) {
    body += 'Medical attention needed. ';
  }
  
  return {
    title,
    body,
    icon: '/logo192.png', // Ensure this path exists in your public folder
    badge: '/badge.png',  // Optional badge icon
    vibrate: [100, 50, 100],
    data: {
      detectionId: detection._id.toString(),
      url: `/official/detection/${detection._id}`,
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
};