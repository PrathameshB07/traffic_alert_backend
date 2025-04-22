// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const officialRoutes = require('./routes/officialRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
// const webhookRoutes = require('./routes/webhooks');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'https://traffic-alert-app.vercel.app',
    'http://localhost:3000' // Keep this for local development
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/api/webhooks', webhookRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/officials', officialRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/telegram', telegramRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});