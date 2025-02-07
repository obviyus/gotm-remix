import { useState } from "react";
import {
	Form,
	useLoaderData,
	useSubmit,
	useActionData,
	useFetcher,
	Link,
} from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { searchGames } from "~/utils/igdb.server";
import GameCard from "~/components/GameCard";
import { pool } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { RowDataPacket } from "mysql2";

interface Game {
	id: number;
	name: string;
	cover?: {
		url: string;
	};
	first_release_date?: number;
	summary?: string;
}

interface LoaderData {
	games: Game[];
	monthId?: number;
	userDiscordId: string;
	monthStatus?: string;
}

interface MonthRow extends RowDataPacket {
	id: number;
	status: string;
}

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

export const loader: LoaderFunction = async ({ request }) => {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	// Get latest month to handle different states
	const [monthRow] = await pool.execute<MonthRow[]>(
		"SELECT id, status FROM months ORDER BY year DESC, month DESC LIMIT 1"
	);

	if (!monthRow || monthRow.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	// Only return monthId if we're in nominating phase
	return json<LoaderData>({ 
		games: [],
		monthId: monthRow[0].status === 'nominating' ? monthRow[0].id : undefined,
		monthStatus: monthRow[0].status,
		userDiscordId: discordId
	});
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const query = formData.get("query");

	if (typeof query !== "string") {
		return json({ games: [] });
	}

	const games = await searchGames(query);
	return json({ games });
}

export default function Nominate() {
	const { games: initialGames, monthId, monthStatus, userDiscordId } = useLoaderData<LoaderData>();
	const actionData = useActionData<typeof action>();
	const games = actionData?.games || initialGames;
	const submit = useSubmit();
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		submit(e.currentTarget);
	};

	const handleNominate = async (game: Game) => {
		const isShort = window.confirm(
			"Is this a short game (< 12 hours)? Click OK for short, Cancel for long."
		);

		const formData = new FormData();
		formData.append('game', JSON.stringify(game));
		formData.append('monthId', monthId?.toString() ?? '');
		formData.append('short', isShort.toString());

		nominate.submit(
			formData,
			{ 
				method: "POST",
				action: "/api/nominations",
				encType: "application/json"
			}
		);
	};

	if (!monthId || monthStatus !== 'nominating') {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 text-center">
				<h1 className="text-3xl font-bold tracking-tight mb-4">Nominations {monthStatus === 'over' ? 'haven\'t started' : 'are closed'}</h1>
				
				<div className="bg-white p-8 rounded-lg shadow-lg">
					{monthStatus === 'ready' && (
						<>
							<p className="text-lg mb-6">The month is being set up. Check back soon for nominations!</p>
							<Link
								to="/history"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
						)}
					{monthStatus === 'voting' && (
						<>
							<p className="text-lg mb-6">The nomination phase is over, but you can now vote for your favorite games!</p>
							<Link
								to="/voting"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === 'playing' && (
						<>
							<p className="text-lg mb-6">Games have been selected! Check out what we're playing this month.</p>
							<Link
								to="/"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								See This Month's Games →
							</Link>
						</>
					)}

					{monthStatus === 'jury' && (
						<>
							<p className="text-lg mb-6">The jury is currently selecting games from the nominations. Check back soon!</p>
							<p className="text-gray-600">Once they're done, you'll be able to vote on the selected games.</p>
						</>
					)}

					{monthStatus === 'over' && (
						<>
							<p className="text-lg mb-6">The next month's nominations haven't started yet. Check back soon!</p>
							<Link
								to="/history"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold mb-8">Nominate Games</h1>

			{nominate.data?.error && (
				<div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
					{nominate.data.error}
				</div>
			)}

			{nominate.data?.success && (
				<div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
					Game nominated successfully!
				</div>
			)}

			<Form method="post" onSubmit={handleSearch} className="mb-8">
				<div className="flex gap-4">
					<input
						type="search"
						name="query"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search for games..."
						className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
					<button
						type="submit"
						className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						Search
					</button>
				</div>
			</Form>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{games.map((game: Game) => (
					<GameCard
						key={game.id}
						game={game}
						onNominate={() => handleNominate(game)}
					/>
				))}
			</div>

			{games.length === 0 && searchTerm && (
				<p className="text-center text-gray-500 mt-8">
					No games found for &quot;{searchTerm}&quot;
				</p>
			)}
		</div>
	);
}
