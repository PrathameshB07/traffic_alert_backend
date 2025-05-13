// Run this script once to generate VAPID keys for web push notifications
// Save this as generate-vapid-keys.js and run it with Node.js:
// node generate-vapid-keys.js

const webpush = require('web-push');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('=======================================');
console.log('VAPID Keys for Web Push Notifications:');
console.log('=======================================');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('=======================================');
console.log('Add these to your .env file as:');
console.log('WEB_PUSH_PUBLIC_KEY=publicKeyValue');
console.log('WEB_PUSH_PRIVATE_KEY=privateKeyValue');
console.log('WEB_PUSH_EMAIL=your-email@example.com');
console.log('=======================================');