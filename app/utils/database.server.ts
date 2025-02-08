import mysql from "mysql2/promise";

export const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	port: Number.parseInt(process.env.DB_PORT ?? '3306'),
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	timezone: "Z",
});
