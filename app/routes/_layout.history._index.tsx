import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { pool, getCurrentMonth } from "~/utils/database.server";
import type { RowDataPacket } from "mysql2";

interface Month {
	id: number;
	month: number;
	year: number;
	status: string;
}

export const loader = async () => {
	const currentMonth = await getCurrentMonth();

	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT id, month, year, status
     FROM months 
     WHERE status IN ('playing', 'over', 'voting')
     ORDER BY year DESC, month DESC;`,
	);

	return { months: rows as Month[] };
};

export default function History() {
	const { months } = useLoaderData<{ months: Month[] }>();

	return (
		<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{months.map((month) => (
					<Link
						key={month.id}
						to={`/history/${month.id}`}
						className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
					>
						<h2 className="text-xl font-semibold text-gray-900">
							{new Date(month.year, month.month - 1).toLocaleString("default", {
								month: "long",
								year: "numeric",
							})}
						</h2>
					</Link>
				))}
			</div>
		</div>
	);
}
