require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import our custom modules
const DatabaseFactory = require('./utils/databaseFactory');
const ShopifyAPI = require('./utils/shopify');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and Shopify API
const db = DatabaseFactory.create();
const shopify = new ShopifyAPI();

// Connect to database (important for MongoDB)
async function initializeDatabase() {
  try {
    if (db.connect) {
      await db.connect();
    }
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Initialize database
initializeDatabase();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false
}));

// Additional headers for Shopify compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('X-Frame-Options', 'ALLOWALL');
  res.header('X-Content-Type-Options', 'nosniff');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration - Allow all origins for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Shopify domains
    if (origin.includes('.myshopify.com') || origin.includes('shopify.com')) {
      return callback(null, true);
    }
    
    // Allow your actual shop domain
    if (process.env.SHOPIFY_SHOP_DOMAIN && origin.includes(process.env.SHOPIFY_SHOP_DOMAIN.replace('.myshopify.com', ''))) {
      return callback(null, true);
    }
    
    // For development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // For production, allow Render domain
    if (origin.includes('render.com') || origin.includes('onrender.com')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Utility function to get client IP - Enhanced
function getClientIP(req) {
  // Check various headers for real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;
  
  let ip = forwarded || realIP || cfConnectingIP || remoteAddr || 'unknown';
  
  // If forwarded header has multiple IPs, take the first one
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Remove IPv6 prefix if present
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Convert localhost IPv6 to IPv4 for better readability
  if (ip === '::1') {
    ip = '127.0.0.1 (localhost)';
  }
  
  console.log('🌐 Client IP detected:', ip);
  return ip;
}

// Utility function to parse user agent for device info
function parseUserAgent(userAgent) {
  const deviceInfo = {
    deviceType: 'unknown',
    browser: 'unknown',
    operatingSystem: 'unknown'
  };

  if (!userAgent) return deviceInfo;

  // Detect device type
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceInfo.deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
  } else {
    deviceInfo.deviceType = 'desktop';
  }

  // Detect browser
  if (/Chrome/.test(userAgent)) deviceInfo.browser = 'Chrome';
  else if (/Firefox/.test(userAgent)) deviceInfo.browser = 'Firefox';
  else if (/Safari/.test(userAgent)) deviceInfo.browser = 'Safari';
  else if (/Edge/.test(userAgent)) deviceInfo.browser = 'Edge';

  // Detect OS
  if (/Windows/.test(userAgent)) deviceInfo.operatingSystem = 'Windows';
  else if (/Mac/.test(userAgent)) deviceInfo.operatingSystem = 'macOS';
  else if (/Linux/.test(userAgent)) deviceInfo.operatingSystem = 'Linux';
  else if (/Android/.test(userAgent)) deviceInfo.operatingSystem = 'Android';
  else if (/iOS/.test(userAgent)) deviceInfo.operatingSystem = 'iOS';

  return deviceInfo;
}

// API Routes

// Test endpoint for CORS
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

// Update subscription status endpoint
app.post('/api/update-subscription-status', async (req, res) => {
  try {
    const { email, status } = req.body;
    
    if (!email || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and status are required' 
      });
    }

    console.log('📧 Updating subscription status:', email, status);

    // Update in our database
    const subscriber = await db.getSubscriberByEmail(email);
    if (subscriber) {
      await db.updateSubscriptionStatus(subscriber.id, status);
      console.log('✅ Updated subscription status in database');
    }

    res.json({ success: true, message: 'Status updated successfully' });

  } catch (error) {
    console.error('❌ Status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Check and sync Shopify customer status endpoint
app.post('/api/sync-shopify-status', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    console.log('🔄 Syncing Shopify status for:', email);

    // Get customer from Shopify
    const shopifyCustomer = await shopify.findCustomerByEmail(email);
    
    if (shopifyCustomer) {
      const isSubscribed = shopify.isNewsletterSubscriber(shopifyCustomer);
      const status = isSubscribed ? 'confirmed' : 'pending';
      
      // Update in our database
      const subscriber = await db.getSubscriberByEmail(email);
      if (subscriber) {
        await db.updateSubscriptionStatus(subscriber.id, status);
        console.log('✅ Synced status from Shopify:', status);
      }
      
      res.json({ 
        success: true, 
        status: status,
        shopifyCustomer: {
          id: shopifyCustomer.id,
          email: shopifyCustomer.email,
          accepts_marketing: shopifyCustomer.accepts_marketing
        }
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Customer not found in Shopify' 
      });
    }

  } catch (error) {
    console.error('❌ Shopify sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync with Shopify' });
  }
});

// Newsletter signup endpoint
app.post('/api/newsletter/signup', async (req, res) => {
  try {
    const { 
      email, 
      firstName, 
      captchaToken,
      sessionId,
      behavioralData,
      deviceData,
      locationData 
    } = req.body;

    console.log('📧 Newsletter signup request received:', { email, firstName });

    // Basic validation
    if (!email || !firstName) {
      console.log('❌ Validation failed: Missing email or firstName');
      return res.status(400).json({ 
        success: false, 
        message: 'Email and first name are required' 
      });
    }

    // Check if subscriber already exists in our database
    const existingSubscriber = await db.getSubscriberByEmail(email);
    
    if (existingSubscriber) {
      console.log('📝 Existing subscriber found:', email);
      return res.json({
        success: true,
        message: "You're already subscribed to our newsletter.",
        alreadySubscribed: true
      });
    }

    console.log('🔍 Checking Shopify for existing customer...');

    // Check Shopify for existing customer
    let existingCustomer = null;
    try {
      existingCustomer = await shopify.findCustomerByEmail(email);
    } catch (shopifyError) {
      console.log('⚠️ Shopify check failed, continuing without Shopify integration:', shopifyError.message);
    }
    
    if (existingCustomer && shopify.isNewsletterSubscriber(existingCustomer)) {
      console.log('📋 Found existing Shopify subscriber:', email);
      
      // Add to our database if they exist in Shopify but not in our DB
      const subscriberId = await db.addSubscriber({
        email,
        firstName,
        shopifyCustomerId: existingCustomer.id ? existingCustomer.id.toString() : null,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      });

      console.log('✅ Added existing Shopify customer to our database with ID:', subscriberId);

      return res.json({
        success: true,
        message: "You're already subscribed to our newsletter.",
        alreadySubscribed: true
      });
    }

    console.log('👤 Creating new customer...');

    // Create new customer in Shopify
    let newCustomer = null;
    try {
      newCustomer = await shopify.createCustomer({ email, firstName });
      console.log('✅ Created new Shopify customer:', newCustomer.id);
    } catch (shopifyError) {
      console.log('⚠️ Shopify customer creation failed, continuing without Shopify integration:', shopifyError.message);
    }

    // Add to our database
    const subscriberId = await db.addSubscriber({
      email,
      firstName,
      shopifyCustomerId: newCustomer && newCustomer.id ? newCustomer.id.toString() : null,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer
    });

    console.log('✅ Added subscriber to database with ID:', subscriberId);

    // Add device and location data
    const userAgentInfo = parseUserAgent(req.headers['user-agent']);
    await db.addDeviceLocationData({
      subscriberId,
      deviceType: userAgentInfo.deviceType,
      browser: userAgentInfo.browser,
      operatingSystem: userAgentInfo.operatingSystem,
      screenResolution: deviceData?.screenResolution || null,
      country: locationData?.country || null,
      region: locationData?.region || null,
      city: locationData?.city || null,
      timezone: deviceData?.timezone || null
    });

    console.log('✅ Added device/location data for subscriber:', subscriberId);

    // Add behavioral data if provided
    if (behavioralData && Array.isArray(behavioralData)) {
      for (const event of behavioralData) {
        await db.addBehavioralData({
          subscriberId,
          sessionId,
          eventType: event.type,
          eventData: event.data,
          pageUrl: event.pageUrl
        });
      }
      console.log('✅ Added behavioral data for subscriber:', subscriberId);
    }

    console.log('🎉 Newsletter signup completed successfully for:', email);

    res.json({
      success: true,
      message: "Thank you for subscribing! Please check your email to confirm your subscription.",
      newSubscriber: true
    });

  } catch (error) {
    console.error('❌ Newsletter signup error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.'
    });
  }
});

// Track behavioral events
app.post('/api/track/event', async (req, res) => {
  try {
    const { email, sessionId, eventType, eventData, pageUrl } = req.body;

    if (!email || !eventType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and event type are required' 
      });
    }

    // Find subscriber
    const subscriber = await db.getSubscriberByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscriber not found' 
      });
    }

    // Add behavioral data
    await db.addBehavioralData({
      subscriberId: subscriber.id,
      sessionId,
      eventType,
      eventData,
      pageUrl
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Event tracking error:', error);
    res.status(500).json({ success: false, message: 'Tracking failed' });
  }
});

// Track page views
app.post('/api/track/page-view', async (req, res) => {
  try {
    const { email, sessionId, pageUrl, pageTitle, timeSpent, referrer } = req.body;

    if (!email || !pageUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and page URL are required' 
      });
    }

    // Find subscriber
    const subscriber = await db.getSubscriberByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscriber not found' 
      });
    }

    // Add page view data
    await db.addPageView({
      subscriberId: subscriber.id,
      sessionId,
      pageUrl,
      pageTitle,
      timeSpent,
      referrer
    });

    console.log('📊 Page view tracked:', pageUrl, 'for', email);
    res.json({ success: true });

  } catch (error) {
    console.error('Page view tracking error:', error);
    res.status(500).json({ success: false, message: 'Page view tracking failed' });
  }
});

// Admin API routes
app.get('/api/admin/subscribers', async (req, res) => {
  try {
    const subscribers = await db.getAllSubscribersWithData();
    res.json({ success: true, data: subscribers });
  } catch (error) {
    console.error('Admin subscribers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscribers' });
  }
});

app.get('/api/admin/subscribers/trash', async (req, res) => {
  try {
    const deletedSubscribers = await db.getDeletedSubscribersWithData();
    res.json({ success: true, data: deletedSubscribers });
  } catch (error) {
    console.error('Admin trash subscribers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deleted subscribers' });
  }
});

app.get('/api/admin/subscriber/:id', async (req, res) => {
  try {
    const subscriberId = req.params.id;
    const details = await db.getSubscriberDetails(subscriberId);
    res.json({ success: true, data: details });
  } catch (error) {
    console.error('Admin subscriber details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscriber details' });
  }
});

// Soft delete subscriber (move to trash)
app.delete('/api/admin/subscriber/:id', async (req, res) => {
  try {
    const subscriberId = req.params.id;
    const deleted = await db.softDeleteSubscriber(subscriberId);
    
    if (deleted) {
      console.log('📧 Subscriber soft deleted (moved to trash):', subscriberId);
      res.json({ success: true, message: 'Subscriber moved to trash successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Subscriber not found or already deleted' });
    }
  } catch (error) {
    console.error('Soft delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete subscriber' });
  }
});

// Restore subscriber from trash
app.post('/api/admin/subscriber/:id/restore', async (req, res) => {
  try {
    const subscriberId = req.params.id;
    const restored = await db.restoreSubscriber(subscriberId);
    
    if (restored) {
      console.log('📧 Subscriber restored from trash:', subscriberId);
      res.json({ success: true, message: 'Subscriber restored successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Subscriber not found in trash' });
    }
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore subscriber' });
  }
});

// Permanently delete subscriber from trash
app.delete('/api/admin/subscriber/:id/permanent', async (req, res) => {
  try {
    const subscriberId = req.params.id;
    const deleted = await db.permanentlyDeleteSubscriber(subscriberId);
    
    if (deleted) {
      console.log('🗑️ Subscriber permanently deleted:', subscriberId);
      res.json({ success: true, message: 'Subscriber permanently deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Subscriber not found in trash' });
    }
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to permanently delete subscriber' });
  }
});

// Bulk soft delete subscribers (move to trash)
app.post('/api/admin/subscribers/bulk-delete', async (req, res) => {
  try {
    const { subscriberIds } = req.body;
    
    if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Subscriber IDs array is required' });
    }
    
    let deletedCount = 0;
    const errors = [];
    
    for (const subscriberId of subscriberIds) {
      try {
        const deleted = await db.softDeleteSubscriber(subscriberId);
        if (deleted) {
          deletedCount++;
        }
      } catch (error) {
        errors.push({ subscriberId, error: error.message });
      }
    }
    
    console.log(`📧 Bulk soft delete completed: ${deletedCount}/${subscriberIds.length} subscribers moved to trash`);
    
    res.json({ 
      success: true, 
      message: `${deletedCount} subscribers moved to trash successfully`,
      deletedCount,
      totalRequested: subscriberIds.length,
      errors
    });
  } catch (error) {
    console.error('Bulk soft delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk delete subscribers' });
  }
});

// Bulk restore subscribers from trash
app.post('/api/admin/subscribers/bulk-restore', async (req, res) => {
  try {
    const { subscriberIds } = req.body;
    
    if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Subscriber IDs array is required' });
    }
    
    let restoredCount = 0;
    const errors = [];
    
    for (const subscriberId of subscriberIds) {
      try {
        const restored = await db.restoreSubscriber(subscriberId);
        if (restored) {
          restoredCount++;
        }
      } catch (error) {
        errors.push({ subscriberId, error: error.message });
      }
    }
    
    console.log(`📧 Bulk restore completed: ${restoredCount}/${subscriberIds.length} subscribers restored`);
    
    res.json({ 
      success: true, 
      message: `${restoredCount} subscribers restored successfully`,
      restoredCount,
      totalRequested: subscriberIds.length,
      errors
    });
  } catch (error) {
    console.error('Bulk restore error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk restore subscribers' });
  }
});

// Bulk permanently delete subscribers from trash
app.post('/api/admin/subscribers/bulk-permanent-delete', async (req, res) => {
  try {
    const { subscriberIds } = req.body;
    
    if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Subscriber IDs array is required' });
    }
    
    let deletedCount = 0;
    const errors = [];
    
    for (const subscriberId of subscriberIds) {
      try {
        const deleted = await db.permanentlyDeleteSubscriber(subscriberId);
        if (deleted) {
          deletedCount++;
        }
      } catch (error) {
        errors.push({ subscriberId, error: error.message });
      }
    }
    
    console.log(`🗑️ Bulk permanent delete completed: ${deletedCount}/${subscriberIds.length} subscribers permanently deleted`);
    
    res.json({ 
      success: true, 
      message: `${deletedCount} subscribers permanently deleted`,
      deletedCount,
      totalRequested: subscriberIds.length,
      errors
    });
  } catch (error) {
    console.error('Bulk permanent delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk permanently delete subscribers' });
  }
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve tracking script
app.get('/tracking.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tracking.js'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Newsletter Tracker App running on port ${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;