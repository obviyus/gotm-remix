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

	// Group months by year
	const monthsByYear = months.reduce((acc, month) => {
		if (!acc[month.year]) {
			acc[month.year] = [];
		}
		acc[month.year].push(month);
		return acc;
	}, {} as Record<number, Month[]>);

	return (
		<div className="mx-auto max-w-7xl mt-6 px-4 sm:px-6 lg:px-8">
			{Object.entries(monthsByYear)
				.sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
				.map(([year, yearMonths], index, array) => (
					<div key={year}>
						<div className="mb-8">
							<div className="flex items-center gap-4 mb-4">
								<div className="h-px flex-1 bg-zinc-600" />
								<h2 className="text-2xl font-bold text-zinc-100">{year}</h2>
								<div className="h-px flex-1 bg-zinc-600" />
							</div>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{yearMonths.map((month) => (
									<Link
										key={month.id}
										to={`/history/${month.id}`}
										prefetch="viewport"
										className="block p-4 rounded-lg border transition-all duration-200 ease-in-out
										bg-zinc-900 border-zinc-600 text-zinc-100
										hover:border-blue-400 hover:shadow-lg hover:shadow-zinc-900/30"
									>
										<h2 className="text-xl font-semibold text-zinc-100">
											{new Date(month.year, month.month - 1).toLocaleString("default", {
												month: "long",
											})}
										</h2>
									</Link>
								))}
							</div>
						</div>
					</div>
				))}
		</div>
	);
}
