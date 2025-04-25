// utils/twilioSms.js (renamed to twilioMessaging.js would be more appropriate)
const twilio = require('twilio');
require('dotenv').config();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send WhatsApp notification using Twilio
 * @param {string} phoneNumber - Recipient's phone number (must include country code)
 * @param {string} message - The message to send
 * @returns {Promise} - Resolves with message details or rejects with error
 */
exports.sendWhatsAppNotification = async (phoneNumber, message) => {
  try {
    // Ensure phone number is formatted with country code
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must include country code (e.g., +1)');
    }
    
    // Create and send the WhatsApp message
    const messageResponse = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phoneNumber}`
    });
    
    console.log(`WhatsApp message sent to ${phoneNumber}, SID: ${messageResponse.sid}`);
    return messageResponse;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw error;
  }
};

// Keep the original SMS function for backward compatibility
exports.sendSmsNotification = async (phoneNumber, message) => {
  try {
    // Ensure phone number is formatted with country code
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must include country code (e.g., +1)');
    }
    
    // Create and send the SMS message
    const messageResponse = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    console.log(`SMS sent to ${phoneNumber}, SID: ${messageResponse.sid}`);
    return messageResponse;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
};