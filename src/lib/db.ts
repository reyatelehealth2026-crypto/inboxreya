import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '118.27.146.16',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'zrismpsz_cny',
  password: process.env.DB_PASSWORD || 'zrismpsz_cny',
  database: process.env.DB_NAME || 'zrismpsz_cny',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;
