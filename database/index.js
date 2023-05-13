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
db.getConnection((err) => {
  if (err) {
    return console.error(`error: ${err.message}`);
  }
  console.log("Connected to mysql server");
});

module.exports = { db };
