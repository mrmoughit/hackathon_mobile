import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: 'localhost',   
  user: 'avatar',        
  password:  'avatar123',   
  database: 'app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export { pool };

//sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
