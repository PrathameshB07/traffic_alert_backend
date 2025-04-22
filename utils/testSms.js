// utils/testSms.js
const { sendSmsNotification } = require('./twilioSms');
require('dotenv').config();

// Test function
async function testSmsService() {
  try {
    const phoneNumber = process.argv[2];
    
    if (!phoneNumber) {
      console.error('Please provide a phone number as argument (with country code)');
      console.error('Example: node testSms.js +12025550123');
      process.exit(1);
    }
    
    console.log(`Sending test SMS to ${phoneNumber}...`);
    
    const result = await sendSmsNotification(
      phoneNumber, 
      'This is a test message from your traffic detection system.'
    );
    
    console.log('SMS sent successfully!');
    console.log('Message SID:', result.sid);
    console.log('Status:', result.status);
  } catch (error) {
    console.error('Error sending test SMS:', error);
  }
}

testSmsService();