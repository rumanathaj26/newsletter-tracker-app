const MongoDB = require('./mongodb');
const Subscriber = require('../models/Subscriber');
const BehavioralData = require('../models/BehavioralData');
const DeviceLocationData = require('../models/DeviceLocationData');

class MongoDatabase {
  constructor() {
    this.mongodb = new MongoDB();
  }

  async connect() {
    await this.mongodb.connect();
  }

  async disconnect() {
    await this.mongodb.disconnect();
  }

  // Add subscriber
  async addSubscriber(subscriberData) {
    try {
      const {
        email,
        firstName,
        shopifyCustomerId,
        ipAddress,
        userAgent,
        referrer,
        source = 'shopify_store',
        sectionId,
        sessionId
      } = subscriberData;

      const subscriber = new Subscriber({
        email,
        firstName,
        shopifyCustomerId,
        ipAddress,
        userAgent,
        referrer,
        source,
        sectionId,
        sessionId
      });

      const saved = await subscriber.save();
      return saved._id;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  // Check if subscriber exists
  async getSubscriberByEmail(email) {
    try {
      return await Subscriber.findOne({ email: email.toLowerCase() });
    } catch (error) {
      throw error;
    }
  }

  // Add behavioral data
  async addBehavioralData(data) {
    try {
      const {
        subscriberId,
        sessionId,
        eventType,
        eventData,
        pageUrl,
        pageTitle,
        referrer
      } = data;

      const behavioralData = new BehavioralData({
        subscriberId,
        sessionId,
        eventType,
        eventData,
        pageUrl,
        pageTitle,
        referrer
      });

      const saved = await behavioralData.save();
      return saved._id;
    } catch (error) {
      throw error;
    }
  }

  // Add multiple behavioral events (batch insert)
  async addMultipleBehavioralData(events) {
    try {
      if (!Array.isArray(events) || events.length === 0) {
        return [];
      }

      const result = await BehavioralData.insertMany(events);
      return result.map(item => item._id);
    } catch (error) {
      throw error;
    }
  }

  // Add device/location data
  async addDeviceLocationData(data) {
    try {
      const {
        subscriberId,
        deviceData,
        locationData,
        pageData
      } = data;

      const deviceLocationData = new DeviceLocationData({
        subscriberId,
        deviceData,
        locationData,
        pageData
      });

      const saved = await deviceLocationData.save();
      return saved._id;
    } catch (error) {
      throw error;
    }
  }

  // Get all active subscribers with their data (not deleted)
  async getAllSubscribersWithData() {
    try {
      const subscribers = await Subscriber.aggregate([
        {
          $match: { deletedAt: null }
        },
        {
          $lookup: {
            from: 'devicelocationdatas',
            localField: '_id',
            foreignField: 'subscriberId',
            as: 'deviceLocation'
          }
        },
        {
          $lookup: {
            from: 'behavioraldatas',
            localField: '_id',
            foreignField: 'subscriberId',
            as: 'behavioralEvents'
          }
        },
        {
          $addFields: {
            behavioral_events_count: { $size: '$behavioralEvents' },
            deviceLocation: { $arrayElemAt: ['$deviceLocation', 0] },
            country: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.country', 0] }, null] },
            region: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.region', 0] }, null] },
            city: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.city', 0] }, null] }
          }
        },
        {
          $project: {
            behavioralEvents: 0 // Don't include all events in list view
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ]);

      return subscribers;
    } catch (error) {
      throw error;
    }
  }

  // Get all deleted subscribers (trash can)
  async getDeletedSubscribersWithData() {
    try {
      const subscribers = await Subscriber.aggregate([
        {
          $match: { deletedAt: { $ne: null } }
        },
        {
          $lookup: {
            from: 'devicelocationdatas',
            localField: '_id',
            foreignField: 'subscriberId',
            as: 'deviceLocation'
          }
        },
        {
          $lookup: {
            from: 'behavioraldatas',
            localField: '_id',
            foreignField: 'subscriberId',
            as: 'behavioralEvents'
          }
        },
        {
          $addFields: {
            behavioral_events_count: { $size: '$behavioralEvents' },
            deviceLocation: { $arrayElemAt: ['$deviceLocation', 0] },
            country: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.country', 0] }, null] },
            region: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.region', 0] }, null] },
            city: { $ifNull: [{ $arrayElemAt: ['$deviceLocation.locationData.city', 0] }, null] }
          }
        },
        {
          $project: {
            behavioralEvents: 0
          }
        },
        {
          $sort: { deletedAt: -1 }
        }
      ]);

      return subscribers;
    } catch (error) {
      throw error;
    }
  }

  // Soft delete subscriber
  async softDeleteSubscriber(subscriberId) {
    try {
      const result = await Subscriber.findByIdAndUpdate(
        subscriberId,
        { deletedAt: new Date() },
        { new: true }
      );
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  // Restore deleted subscriber
  async restoreSubscriber(subscriberId) {
    try {
      const result = await Subscriber.findByIdAndUpdate(
        subscriberId,
        { deletedAt: null },
        { new: true }
      );
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  // Permanently delete subscriber and all related data
  async permanentlyDeleteSubscriber(subscriberId) {
    try {
      // Delete all related data first
      await Promise.all([
        BehavioralData.deleteMany({ subscriberId }),
        DeviceLocationData.deleteMany({ subscriberId })
      ]);

      // Then delete the subscriber
      const result = await Subscriber.findByIdAndDelete(subscriberId);
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  // Update subscription status
  async updateSubscriptionStatus(subscriberId, status) {
    try {
      const result = await Subscriber.findByIdAndUpdate(
        subscriberId,
        { subscriptionStatus: status },
        { new: true }
      );
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  // Get detailed subscriber data
  async getSubscriberDetails(subscriberId) {
    try {
      const subscriber = await Subscriber.findById(subscriberId);
      if (!subscriber) {
        return null;
      }

      const [deviceLocation, behavioral] = await Promise.all([
        DeviceLocationData.findOne({ subscriberId }),
        BehavioralData.find({ subscriberId }).sort({ timestamp: -1 })
      ]);

      return {
        subscriber,
        deviceLocation,
        behavioral,
        pageViews: behavioral.filter(event => event.eventType === 'page_view')
      };
    } catch (error) {
      throw error;
    }
  }

  // Get statistics
  async getStats() {
    try {
      const [
        totalSubscribers,
        activeSubscribers,
        deletedSubscribers,
        totalEvents
      ] = await Promise.all([
        Subscriber.countDocuments(),
        Subscriber.countDocuments({ deletedAt: null }),
        Subscriber.countDocuments({ deletedAt: { $ne: null } }),
        BehavioralData.countDocuments()
      ]);

      return {
        totalSubscribers,
        activeSubscribers,
        deletedSubscribers,
        totalEvents
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = MongoDatabase;