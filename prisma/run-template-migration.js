const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting template fields migration...');
  
  const migrationFile = path.join(__dirname, 'migrations', '002_add_template_fields.sql');
  console.log('📄 Migration file:', migrationFile);
  
  // Read .env.local file
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Find DATABASE_URL, skipping comments
  const lines = envContent.split('\n');
  let dbUrl = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.replace(/^DATABASE_URL="?([^"]+)"?$/, '$1');
      break;
    }
  }
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in .env.local');
  }
  
  // Parse mysql://user:password@host:port/database
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^\s]+)/);
  if (!match) {
    console.error('Failed to parse DATABASE_URL:', dbUrl);
    throw new Error('Invalid DATABASE_URL format');
  }
  
  const [, user, password, host, port, database] = match;
  
  console.log(`🔌 Connecting to database: ${database} on ${host}:${port}`);
  
  const connection = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    multipleStatements: true
  });
  
  console.log('✅ Connected to database');
  
  try {
    console.log('⚙️  Executing migration...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await connection.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    console.log('🔌 Database connection closed');
    await connection.end();
  }
  
  console.log('🎉 All done!');
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
