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

const isActiveStatus = (status: string) => {
  return ["nominating", "jury", "voting"].includes(status);
};

export const hasActiveMonth = async () => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id 
     FROM months 
     WHERE status IN ('nominating', 'jury', 'voting')
     LIMIT 1`
  );
  
  return rows.length > 0;
};

export const getCurrentMonth = async () => {
  // Get the current active month (nominating/jury/voting)
  const [activeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, year, month, status 
     FROM months 
     WHERE status IN ('nominating', 'jury', 'voting')
     LIMIT 1`
  );
  
  if (activeRows && activeRows.length > 0) {
    return activeRows[0];
  }
  
  // If no active month, fall back to latest month
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
};
