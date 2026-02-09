/**
 * Migration Runner for Inbox Feature Parity Upgrade
 * 
 * This script runs the SQL migration file against the MySQL database.
 * It reads the DATABASE_URL from .env.local and executes the migration.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '001_inbox_feature_parity_upgrade.sql');
  
  console.log('🚀 Starting migration...');
  console.log(`📄 Migration file: ${migrationFile}`);
  
  // Read migration SQL
  const sql = fs.readFileSync(migrationFile, 'utf8');
  
  // Parse DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment variables');
  }
  
  // Parse connection string
  const urlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  const [, user, password, host, port, database] = urlMatch;
  
  console.log(`🔌 Connecting to database: ${database} on ${host}:${port}`);
  
  // Create connection
  const connection = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    multipleStatements: true
  });
  
  try {
    console.log('✅ Connected to database');
    
    // Execute migration
    console.log('⚙️  Executing migration...');
    await connection.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN (
        'quick_reply_templates',
        'customer_segments',
        'broadcast_messages_v2',
        'rich_menus',
        'conversation_assignees',
        'ghost_drafts',
        'image_analysis_results',
        'scheduled_messages',
        'sla_tracking'
      )
    `, [database]);
    
    console.log('\n📊 Created tables:');
    tables.forEach(table => {
      console.log(`  ✓ ${table.TABLE_NAME}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
