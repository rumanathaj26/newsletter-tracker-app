const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  shopifyCustomerId: {
    type: String
  },
  subscriptionStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'unsubscribed'],
    default: 'pending'
  },
  ipAddress: String,
  userAgent: String,
  referrer: String,
  source: {
    type: String,
    default: 'shopify_store'
  },
  sectionId: String,
  sessionId: String,
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Creates createdAt and updatedAt automatically
});

// Create indexes for better performance
subscriberSchema.index({ email: 1 });
subscriberSchema.index({ deletedAt: 1 });
subscriberSchema.index({ sessionId: 1 });
subscriberSchema.index({ createdAt: -1 });

// Virtual for checking if subscriber is active
subscriberSchema.virtual('isActive').get(function() {
  return !this.deletedAt;
});

// Instance method to soft delete
subscriberSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
subscriberSchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

// Static method to find active subscribers
subscriberSchema.statics.findActive = function() {
  return this.find({ deletedAt: null });
};

// Static method to find deleted subscribers
subscriberSchema.statics.findDeleted = function() {
  return this.find({ deletedAt: { $ne: null } });
};

module.exports = mongoose.model('Subscriber', subscriberSchema);