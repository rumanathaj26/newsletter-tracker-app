const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(process.env.DATABASE_PATH || './newsletter_data.db');
    this.initializeTables();
  }

  initializeTables() {
    // Subscribers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        shopify_customer_id TEXT,
        subscription_status TEXT DEFAULT 'pending',
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        deleted_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add deleted_at column to existing tables (for migration)
    this.db.run(`PRAGMA table_info(subscribers)`, (err, rows) => {
      if (!err) {
        this.db.all(`PRAGMA table_info(subscribers)`, (err, columns) => {
          if (!err) {
            const hasDeletedAt = columns.some(col => col.name === 'deleted_at');
            if (!hasDeletedAt) {
              this.db.run(`ALTER TABLE subscribers ADD COLUMN deleted_at DATETIME NULL`, (err) => {
                if (err) {
                  console.log('⚠️ Could not add deleted_at column:', err.message);
                } else {
                  console.log('✅ Added deleted_at column to subscribers table');
                }
              });
            }
          }
        });
      }
    });

    // Behavioral data table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS behavioral_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER,
        session_id TEXT,
        event_type TEXT NOT NULL,
        event_data TEXT,
        page_url TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers (id)
      )
    `);

    // Device and location data
    this.db.run(`
      CREATE TABLE IF NOT EXISTS device_location_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER,
        device_type TEXT,
        browser TEXT,
        operating_system TEXT,
        screen_resolution TEXT,
        country TEXT,
        region TEXT,
        city TEXT,
        timezone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers (id)
      )
    `);

    // Page views tracking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER,
        session_id TEXT,
        page_url TEXT,
        page_title TEXT,
        time_spent INTEGER,
        referrer TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers (id)
      )
    `);
  }

  // Add subscriber
  addSubscriber(subscriberData) {
    return new Promise((resolve, reject) => {
      const {
        email,
        firstName,
        shopifyCustomerId,
        ipAddress,
        userAgent,
        referrer
      } = subscriberData;

      const query = `
        INSERT INTO subscribers 
        (email, first_name, shopify_customer_id, ip_address, user_agent, referrer)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [email, firstName, shopifyCustomerId, ipAddress, userAgent, referrer], 
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Check if subscriber exists
  getSubscriberByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM subscribers WHERE email = ?`;
      
      this.db.get(query, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Add behavioral data
  addBehavioralData(data) {
    return new Promise((resolve, reject) => {
      const {
        subscriberId,
        sessionId,
        eventType,
        eventData,
        pageUrl
      } = data;

      const query = `
        INSERT INTO behavioral_data 
        (subscriber_id, session_id, event_type, event_data, page_url)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(query, [subscriberId, sessionId, eventType, JSON.stringify(eventData), pageUrl], 
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Add device/location data
  addDeviceLocationData(data) {
    return new Promise((resolve, reject) => {
      const {
        subscriberId,
        deviceType,
        browser,
        operatingSystem,
        screenResolution,
        country,
        region,
        city,
        timezone
      } = data;

      const query = `
        INSERT INTO device_location_data 
        (subscriber_id, device_type, browser, operating_system, screen_resolution, country, region, city, timezone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [subscriberId, deviceType, browser, operatingSystem, screenResolution, country, region, city, timezone], 
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Get all active subscribers with their data (not deleted)
  getAllSubscribersWithData() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.*,
          dl.device_type,
          dl.browser,
          dl.country,
          dl.region,
          dl.city,
          COUNT(bd.id) as behavioral_events_count,
          COUNT(pv.id) as page_views_count
        FROM subscribers s
        LEFT JOIN device_location_data dl ON s.id = dl.subscriber_id
        LEFT JOIN behavioral_data bd ON s.id = bd.subscriber_id
        LEFT JOIN page_views pv ON s.id = pv.subscriber_id
        WHERE s.deleted_at IS NULL
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get all deleted subscribers (trash can)
  getDeletedSubscribersWithData() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.*,
          dl.device_type,
          dl.browser,
          dl.country,
          dl.region,
          dl.city,
          COUNT(bd.id) as behavioral_events_count,
          COUNT(pv.id) as page_views_count
        FROM subscribers s
        LEFT JOIN device_location_data dl ON s.id = dl.subscriber_id
        LEFT JOIN behavioral_data bd ON s.id = bd.subscriber_id
        LEFT JOIN page_views pv ON s.id = pv.subscriber_id
        WHERE s.deleted_at IS NOT NULL
        GROUP BY s.id
        ORDER BY s.deleted_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Soft delete subscriber
  softDeleteSubscriber(subscriberId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscribers 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND deleted_at IS NULL
      `;

      this.db.run(query, [subscriberId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Restore deleted subscriber
  restoreSubscriber(subscriberId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscribers 
        SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND deleted_at IS NOT NULL
      `;

      this.db.run(query, [subscriberId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Permanently delete subscriber and all related data
  permanentlyDeleteSubscriber(subscriberId) {
    return new Promise((resolve, reject) => {
      // Start transaction
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");

        // Delete related data first
        const deleteQueries = [
          'DELETE FROM behavioral_data WHERE subscriber_id = ?',
          'DELETE FROM device_location_data WHERE subscriber_id = ?',
          'DELETE FROM page_views WHERE subscriber_id = ?',
          'DELETE FROM subscribers WHERE id = ? AND deleted_at IS NOT NULL'
        ];

        let completed = 0;
        let hasError = false;

        deleteQueries.forEach((query) => {
          this.db.run(query, [subscriberId], (err) => {
            if (err && !hasError) {
              hasError = true;
              this.db.run("ROLLBACK");
              reject(err);
              return;
            }

            completed++;
            if (completed === deleteQueries.length && !hasError) {
              this.db.run("COMMIT", (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(true);
                }
              });
            }
          });
        });
      });
    });
  }

  // Update subscription status
  updateSubscriptionStatus(subscriberId, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscribers 
        SET subscription_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(query, [status, subscriberId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Get detailed subscriber data
  getSubscriberDetails(subscriberId) {
    return new Promise((resolve, reject) => {
      const queries = {
        subscriber: `SELECT * FROM subscribers WHERE id = ?`,
        deviceLocation: `SELECT * FROM device_location_data WHERE subscriber_id = ?`,
        behavioral: `SELECT * FROM behavioral_data WHERE subscriber_id = ? ORDER BY timestamp DESC`,
        pageViews: `SELECT * FROM page_views WHERE subscriber_id = ? ORDER BY timestamp DESC`
      };

      const results = {};

      // Get subscriber info
      this.db.get(queries.subscriber, [subscriberId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        results.subscriber = row;

        // Get device/location data
        this.db.get(queries.deviceLocation, [subscriberId], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          results.deviceLocation = row;

          // Get behavioral data
          this.db.all(queries.behavioral, [subscriberId], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            results.behavioral = rows;

            // Get page views
            this.db.all(queries.pageViews, [subscriberId], (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              results.pageViews = rows;
              resolve(results);
            });
          });
        });
      });
    });
  }

  // Add page view tracking
  addPageView(data) {
    return new Promise((resolve, reject) => {
      const {
        subscriberId,
        sessionId,
        pageUrl,
        pageTitle,
        timeSpent,
        referrer
      } = data;

      const query = `
        INSERT INTO page_views 
        (subscriber_id, session_id, page_url, page_title, time_spent, referrer)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [subscriberId, sessionId, pageUrl, pageTitle, timeSpent, referrer], 
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }
}

module.exports = Database;