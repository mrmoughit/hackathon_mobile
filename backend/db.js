import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: '13.60.16.112',   
  user: 'avatar',        
  password:  'avatar123',   
  database: 'app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export { pool };

//sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
