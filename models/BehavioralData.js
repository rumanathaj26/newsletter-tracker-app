const mongoose = require('mongoose');

const behavioralDataSchema = new mongoose.Schema({
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscriber',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'page_view',
      'newsletter_form_view',
      'newsletter_form_field_focus',
      'newsletter_form_submit',
      'newsletter_form_success',
      'newsletter_form_error',
      'newsletter_form_validation_error',
      'newsletter_form_api_call',
      'newsletter_form_api_error',
      'newsletter_form_network_error',
      'newsletter_form_message_shown',
      'newsletter_signup_attempt',
      'newsletter_signup_success',
      'newsletter_signup_error',
      'scroll_depth',
      'add_to_cart_click',
      'form_field_focus',
      'button_click',
      'product_view',
      'collection_view',
      'cart_view',
      'checkout_view'
    ]
  },
  eventData: {
    type: mongoose.Schema.Types.Mixed, // Flexible object storage
    default: {}
  },
  pageUrl: {
    type: String,
    required: true
  },
  pageTitle: String,
  referrer: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
behavioralDataSchema.index({ subscriberId: 1, timestamp: -1 });
behavioralDataSchema.index({ sessionId: 1, timestamp: -1 });
behavioralDataSchema.index({ eventType: 1 });
behavioralDataSchema.index({ timestamp: -1 });

// Static method to get events by subscriber
behavioralDataSchema.statics.findBySubscriber = function(subscriberId) {
  return this.find({ subscriberId }).sort({ timestamp: -1 });
};

// Static method to get events by session
behavioralDataSchema.statics.findBySession = function(sessionId) {
  return this.find({ sessionId }).sort({ timestamp: -1 });
};

// Static method to get events by type
behavioralDataSchema.statics.findByEventType = function(eventType) {
  return this.find({ eventType }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('BehavioralData', behavioralDataSchema);