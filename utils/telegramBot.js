// utils/telegramBot.js
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Send notification to Telegram chat
async function sendTelegramNotification(chatId, message) {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error sending Telegram notification:', error.response?.data || error.message);
    throw error;
  }
}

// Register a webhook for updates
async function registerTelegramWebhook(webhookUrl) {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
      url: webhookUrl
    });
    
    return response.data;
  } catch (error) {
    console.error('Error registering Telegram webhook:', error.response?.data || error.message);
    throw error;
  }
}

// Process webhook updates
async function processTelegramUpdate(update) {
  try {
    // Handle messages from officials to link their Telegram account
    if (update.message && update.message.text && update.message.text.startsWith('/link')) {
      const linkCode = update.message.text.split(' ')[1];
      const chatId = update.message.chat.id;
      
      if (!linkCode) {
        await sendTelegramNotification(
          chatId,
          'Please provide a link code: /link YOUR_CODE'
        );
        return;
      }
      
      // Link official's account (implement in routes/telegramRoutes.js)
      const linkUrl = `${process.env.BACKEND_URL}/api/telegram/link`;
      await axios.post(linkUrl, {
        linkCode,
        chatId
      });
      
      await sendTelegramNotification(
        chatId,
        'Your Telegram account has been successfully linked to your Traffic Official account!'
      );
    }
  } catch (error) {
    console.error('Error processing Telegram update:', error);
  }
}

module.exports = {
  sendTelegramNotification,
  registerTelegramWebhook,
  processTelegramUpdate
};