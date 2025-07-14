const mongoose = require('mongoose');

const deviceLocationDataSchema = new mongoose.Schema({
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscriber',
    required: true
  },
  deviceData: {
    screenResolution: String,
    viewport: String,
    timezone: String,
    language: String,
    platform: String,
    userAgent: String
  },
  locationData: {
    country: String,
    countryCode: String,
    region: String,
    city: String,
    timezone: String,
    ip: String,
    postal: String,
    detectionMethod: String
  },
  pageData: {
    url: String,
    title: String,
    referrer: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Create indexes
deviceLocationDataSchema.index({ subscriberId: 1 });
deviceLocationDataSchema.index({ 'locationData.country': 1 });
deviceLocationDataSchema.index({ 'locationData.city': 1 });

module.exports = mongoose.model('DeviceLocationData', deviceLocationDataSchema);