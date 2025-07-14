const Database = require('./database'); // SQLite database
const MongoDatabase = require('./mongoDatabase'); // MongoDB database

class DatabaseFactory {
  static create() {
    const dbType = process.env.DATABASE_TYPE || 'sqlite';
    
    console.log(`🗄️ Initializing ${dbType.toUpperCase()} database...`);
    
    switch (dbType.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoDatabase();
      
      case 'sqlite':
      default:
        return new Database();
    }
  }
}

module.exports = DatabaseFactory;