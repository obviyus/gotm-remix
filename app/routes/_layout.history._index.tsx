import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { pool } from "~/utils/database.server";
import type { RowDataPacket } from "mysql2";

interface Month {
	id: number;
	month: string;
	year: number;
}

export const loader = async () => {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, month, year 
         FROM months 
         ORDER BY id DESC;`,
	);

	return { months: rows as Month[] };
};

export default function History() {
	const { months } = useLoaderData<{ months: Month[] }>();

	return (
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<header className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
					Voting History
				</h1>
			</header>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{months.map((month) => (
					<Link
						key={month.id}
						to={`/history/${month.id}`}
						className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
					>
						<h2 className="text-lg font-semibold">
							{/* Readable month, year */}
							{new Date(`${month.year}-${month.month}-01`).toLocaleString(
								"en-US",
								{
									month: "long",
									year: "numeric",
								},
							)}
						</h2>
					</Link>
				))}
			</div>

			<Outlet />
		</div>
	);
}
