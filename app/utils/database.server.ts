import mysql,  { type RowDataPacket } from "mysql2/promise";

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

export const getCurrentMonth = async () => {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth() + 1; // JavaScript months are 0-based

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, year, month, status 
     FROM months 
     WHERE year = ? AND month = ?
     LIMIT 1`,
    [utcYear, utcMonth]
  );

  if (!rows || rows.length === 0) {
    // If no month exists for current UTC date, fall back to latest
    const [latestRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, year, month, status 
       FROM months 
       ORDER BY year DESC, month DESC 
       LIMIT 1`
    );
    
    if (!latestRows || latestRows.length === 0) {
      throw new Response("No months found", { status: 404 });
    }
    
    return latestRows[0];
  }

  return rows[0];
};
