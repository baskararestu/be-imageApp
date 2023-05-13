const mysql = require("mysql2/promise");

const mysqlConfig = require("../config/mysql.config");

const db = mysql.createPool({
  host: mysqlConfig.HOST,
  user: mysqlConfig.USER,
  password: mysqlConfig.PASS,
  database: mysqlConfig.DB,
  port: mysqlConfig.PORT,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = { db };
