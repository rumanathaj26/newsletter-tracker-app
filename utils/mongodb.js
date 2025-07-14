const mongoose = require('mongoose');

class MongoDB {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
      
      if (!mongoUri) {
        throw new Error('MongoDB connection string is required. Set MONGODB_URI in your environment variables.');
      }

      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      this.isConnected = true;
      console.log('✅ Connected to MongoDB');

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📤 Disconnected from MongoDB');
    }
  }

  // Check if connected
  isConnectionReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

module.exports = MongoDB;