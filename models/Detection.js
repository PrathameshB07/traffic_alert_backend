// // models/Detection.js
// const mongoose = require('mongoose');

// const detectionSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   mediaUrl: {
//     type: String,
//     required: true
//   },
//   mediaType: {
//     type: String,
//     enum: ['image', 'video'],
//     required: true
//   },
//   location: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number], // [longitude, latitude]
//       required: true
//     }
//   },
//   detectionResults: {
//     totalVehicles: Number,
//     vehicles: [{
//       type: String,
//       count: Number
//     }],
//     timestamp: {
//       type: Date,
//       default: Date.now
//     }
//   },
//   notifiedOfficials: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Official'
//   }],
//   status: {
//     type: String,
//     enum: ['pending', 'processing', 'completed', 'failed'],
//     default: 'pending'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Create geospatial index
// detectionSchema.index({ location: '2dsphere' });

// module.exports = mongoose.model('Detection', detectionSchema);



// // models/Detection.js - Updated for MobileNet SSD
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const DetectionSchema = new Schema({
//   user: {
//     type: Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   mediaUrl: {
//     type: String,
//     required: true
//   },
//   mediaType: {
//     type: String,
//     enum: ['image', 'video'],
//     required: true
//   },
//   location: {
//     type: {
//       type: String,
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number], // [longitude, latitude]
//       required: true
//     }
//   },
//   status: {
//     type: String,
//     enum: ['processing', 'completed', 'failed'],
//     default: 'processing'
//   },
//   detectionResults: {
//     totalVehicles: Number,
//     vehicles: [
//       {
//         type: {type:String},
//         count: Number
//       }
//     ],
//     potentialEmergencyVehicles: Number,
//     detections: Array,
//     processedFrames: Number
//   },
//   textSummary: {
//     type: String
//   },
//   visualizationUrl: {
//     type: String
//   },
//   errorMessage: {
//     type: String
//   },
//   notifiedOfficials: [
//     {
//       type: Schema.Types.ObjectId,
//       ref: 'Official'
//     }
//   ],
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   cloudinaryPublicId: {
//     type: String,
//     required: false
//   }
// });

// // Add index for geospatial queries
// DetectionSchema.index({ location: '2dsphere' });

// module.exports = mongoose.model('Detection', DetectionSchema);


// models/Detection.js - Updated for Cloudinary
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DetectionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  // Add Cloudinary public ID field
  cloudinaryPublicId: {
    type: String,
    required: false // Not required for backward compatibility with existing records
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  detectionResults: {
    totalVehicles: Number,
    vehicles: [
      {
        type: {type: String},
        count: Number
      }
    ],
    potentialEmergencyVehicles: Number,
    detections: Array,
    processedFrames: Number
  },
  textSummary: {
    type: String
  },
  visualizationUrl: {
    type: String
  },
  // You could add a Cloudinary public ID for visualization too if needed
  visualizationCloudinaryId: {
    type: String
  },
  errorMessage: {
    type: String
  },
  notifiedOfficials: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Official'
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }, 
});

// Add index for geospatial queries
DetectionSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Detection', DetectionSchema);