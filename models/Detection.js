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


// // models/Detection.js - Updated for Cloudinary
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
//   // Add Cloudinary public ID field
//   cloudinaryPublicId: {
//     type: String,
//     required: false // Not required for backward compatibility with existing records
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
//         type: {type: String},
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
//   // You could add a Cloudinary public ID for visualization too if needed
//   visualizationCloudinaryId: {
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
// });

// // Add index for geospatial queries
// DetectionSchema.index({ location: '2dsphere' });

// module.exports = mongoose.model('Detection', DetectionSchema);



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
//   // Add Cloudinary public ID field
//   cloudinaryPublicId: {
//     type: String,
//     required: false // Not required for backward compatibility with existing records
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
//   // Add accident flag
//   isAccident: {
//     type: Boolean,
//     default: false
//   },
//   // Add medical services info
//   medicalServices: {
//     hospitals: [
//       {
//         name: String,
//         vicinity: String,
//         rating: Number,
//         place_id: String,
//         location: {
//           lat: Number,
//           lng: Number
//         },
//         open_now: Boolean
//       }
//     ],
//     ambulances: [
//       {
//         name: String,
//         vicinity: String,
//         rating: Number,
//         place_id: String,
//         location: {
//           lat: Number,
//           lng: Number
//         },
//         open_now: Boolean
//       }
//     ]
//   },
//   detectionResults: {
//     totalVehicles: Number,
//     vehicles: [
//       {
//         type: {type: String},
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
//   // You could add a Cloudinary public ID for visualization too if needed
//   visualizationCloudinaryId: {
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
//   //changes
//   // Add to your existing DetectionSchema:

// acceptedBy: {
//   type: Schema.Types.ObjectId,
//   ref: 'Official',
//   default: null
// },
// rejectedBy: [
//   {
//     type: Schema.Types.ObjectId,
//     ref: 'Official'
//   }
// ],
// taskStatus: {
//   type: String,
//   enum: ['pending', 'accepted', 'completed'],
//   default: 'pending'
// },
// completedAt: {
//   type: Date,
//   default: null
// }
// });

// // Add index for geospatial queries
// DetectionSchema.index({ location: '2dsphere' });

// module.exports = mongoose.model('Detection', DetectionSchema);




//changed on 1 may
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
  // Add accident flag
  isAccident: {
    type: Boolean,
    default: false
  },
  // Add medical services info
  medicalServices: {
    hospitals: [
      {
        name: String,
        vicinity: String,
        rating: Number,
        place_id: String,
        location: {
          lat: Number,
          lng: Number
        },
        open_now: Boolean
      }
    ],
    ambulances: [
      {
        name: String,
        vicinity: String,
        rating: Number,
        place_id: String,
        location: {
          lat: Number,
          lng: Number
        },
        open_now: Boolean
      }
    ]
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
  // All officials that have been notified at any point
  notifiedOfficials: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Official'
    }
  ],
  // All available officials in the area when detection was created
  availableOfficials: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Official'
    }
  ],
  // Official currently being notified (waiting for response)
  currentlyNotified: {
    type: Schema.Types.ObjectId,
    ref: 'Official',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Task handling
  acceptedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Official',
    default: null
  },
  rejectedBy: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Official'
    }
  ],
  taskStatus: {
    type: String,
    enum: ['pending', 'accepted', 'completed'],
    default: 'pending'
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Add index for geospatial queries
DetectionSchema.index({ location: '2dsphere' });

const setupIndexes = async () => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection;
    
    // Wait for the connection to be ready
    if (db.readyState !== 1) {
      console.log('Waiting for database connection to be ready before creating indexes...');
      await new Promise(resolve => {
        db.once('open', resolve);
      });
    }
    
    // Create or recreate the 2dsphere index on location.coordinates
    console.log('Creating geospatial index on Detection.location...');
    await mongoose.model('Detection').collection.createIndex({ 'location': '2dsphere' });
    console.log('Geospatial index created successfully!');
    
  } catch (error) {
    console.error('Error creating geospatial index:', error);
  }
};

// Call the setup function when the model is required
setupIndexes();

module.exports = mongoose.model('Detection', DetectionSchema);