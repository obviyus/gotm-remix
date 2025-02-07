import { useState } from "react";
import {
	Form,
	useLoaderData,
	useSubmit,
	useActionData,
	useFetcher,
	Link,
	useNavigation,
} from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
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
		"SELECT id, status FROM months ORDER BY year DESC, month DESC LIMIT 1",
	);

	if (!monthRow || monthRow.length === 0) {
		throw new Response("No months found", { status: 404 });
	}

	// Only return monthId if we're in nominating phase
	return json<LoaderData>({
		games: [],
		monthId: monthRow[0].status === "nominating" ? monthRow[0].id : undefined,
		monthStatus: monthRow[0].status,
		userDiscordId: discordId,
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
	const {
		games: initialGames,
		monthId,
		monthStatus,
		userDiscordId,
	} = useLoaderData<LoaderData>();
	const actionData = useActionData<typeof action>();
	const games = actionData?.games || initialGames;
	const submit = useSubmit();
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();
	const navigation = useNavigation();
	const isSearching = navigation.formData?.get("query") != null;
	const hasSearched = actionData !== undefined; // Track if a search was performed

	// New state for modal
	const [isOpen, setIsOpen] = useState(false);
	const [selectedGame, setSelectedGame] = useState<Game | null>(null);
	const [pitch, setPitch] = useState("");

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		submit(e.currentTarget);
	};

	const handleGameSelect = (game: Game) => {
		setSelectedGame(game);
		setIsOpen(true);
	};

	const handleGameLength = (isShort: boolean) => {
		if (!selectedGame) return;

		const formData = new FormData();
		formData.append("game", JSON.stringify(selectedGame));
		formData.append("monthId", monthId?.toString() ?? "");
		formData.append("short", isShort.toString());
		if (pitch.trim()) {
			formData.append("pitch", pitch);
		}

		nominate.submit(formData, {
			method: "POST",
			action: "/api/nominations",
			encType: "application/json",
		});

		setIsOpen(false);
		setSelectedGame(null);
		setPitch(""); // Reset pitch after submission
	};

	if (!monthId || monthStatus !== "nominating") {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 text-center">
				<h1 className="text-3xl font-bold tracking-tight mb-4">
					Nominations{" "}
					{monthStatus === "over" ? "haven't started" : "are closed"}
				</h1>

				<div className="bg-white p-8 rounded-lg shadow-lg">
					{monthStatus === "ready" && (
						<>
							<p className="text-lg mb-6">
								The month is being set up. Check back soon for nominations!
							</p>
							<Link
								to="/history"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
					{monthStatus === "voting" && (
						<>
							<p className="text-lg mb-6">
								The nomination phase is over, but you can now vote for your
								favorite games!
							</p>
							<Link
								to="/voting"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === "playing" && (
						<>
							<p className="text-lg mb-6">
								Games have been selected! Check out what we're playing this
								month.
							</p>
							<Link
								to="/"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								See This Month's Games →
							</Link>
						</>
					)}

					{monthStatus === "jury" && (
						<>
							<p className="text-lg mb-6">
								The jury is currently selecting games from the nominations.
								Check back soon!
							</p>
							<p className="text-gray-600">
								Once they're done, you'll be able to vote on the selected games.
							</p>
						</>
					)}

					{monthStatus === "over" && (
						<>
							<p className="text-lg mb-6">
								The next month's nominations haven't started yet. Check back
								soon!
							</p>
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

	const GameSkeleton = () => (
		<div className="flex flex-row rounded-lg border border-gray-200 bg-white shadow-sm animate-pulse">
			<div className="relative w-1/3" style={{ aspectRatio: "2/3" }}>
				<div className="absolute inset-0 bg-gray-200 rounded-l-lg" />
			</div>
			<div className="flex-1 p-2 flex flex-col">
				<div className="flex-1">
					<div className="flex justify-between items-start gap-x-1">
						<div className="h-5 bg-gray-200 rounded w-3/4" />
						<div className="h-3 bg-gray-200 rounded w-12 shrink-0" />
					</div>
					<div className="space-y-1 mt-1">
						<div className="h-3 bg-gray-200 rounded w-full" />
						<div className="h-3 bg-gray-200 rounded w-2/3" />
					</div>
				</div>
				<div className="pt-2">
					<div className="h-7 bg-gray-200 rounded w-full" />
				</div>
			</div>
		</div>
	);

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
						className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-6 pr-4"
					/>
					<button
						type="submit"
						disabled={isSearching}
						className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSearching ? "Searching..." : "Search"}
					</button>
				</div>
			</Form>

			{/* Game Length Selection Modal */}
			<Dialog
				open={isOpen}
				onClose={() => {
					setIsOpen(false);
					setPitch(""); // Reset pitch when closing modal
				}}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/30" aria-hidden="true" />

				{/* Full-screen container for mobile slide-up and desktop centered modal */}
				<div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
					<DialogPanel
						className={`
                        w-full sm:w-[32rem] rounded-t-lg sm:rounded-lg bg-white p-6 shadow-xl 
                        transform transition-all duration-300 ease-in-out
                        translate-y-0 scale-100 opacity-100
                        data-[state=closed]:translate-y-full data-[state=closed]:scale-100 data-[state=closed]:opacity-0
                        sm:data-[state=closed]:translate-y-0 sm:data-[state=closed]:scale-95
                    `}
					>
						<DialogTitle className="text-lg font-medium leading-6 text-gray-900 mb-4">
							Nominate {selectedGame?.name} (
							{selectedGame?.first_release_date
								? new Date(selectedGame.first_release_date * 1000).getFullYear()
								: "Unknown"}
							)
						</DialogTitle>

						{/* Pitch Input */}
						<div className="mb-6">
							<label
								htmlFor="pitch"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Pitch (Optional)
							</label>
							<textarea
								id="pitch"
								name="pitch"
								rows={3}
								className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								value={pitch}
								onChange={(e) => setPitch(e.target.value)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<button
								type="button"
								onClick={() => handleGameLength(true)}
								className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								Short Game
								<span className="block text-xs text-blue-200">
									(&lt; 12 hours)
								</span>
							</button>
							<button
								type="button"
								onClick={() => handleGameLength(false)}
								className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								Long Game
								<span className="block text-xs text-blue-200">
									(&gt; 12 hours)
								</span>
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>

			{isSearching ? (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 10 }).map(() => (
						<GameSkeleton key={crypto.randomUUID()} />
					))}
				</div>
			) : games.length > 0 ? (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{games.map((game: Game) => (
						<GameCard
							key={game.id}
							game={game}
							onNominate={() => handleGameSelect(game)}
						/>
					))}
				</div>
			) : hasSearched && searchTerm ? (
				<div className="text-center py-12">
					<h3 className="text-lg font-semibold text-gray-900">
						No results found
					</h3>
					<p className="mt-2 text-gray-500">
						No games found matching "{searchTerm}". Try a different search term.
					</p>
				</div>
			) : (
				<div className="text-center py-12 bg-gray-100 rounded-lg">
					<h3 className="text-lg font-semibold text-gray-900">
						Search for games to nominate
					</h3>
					<p className="mt-2 text-gray-500">
						Type in the search box above to find games
					</p>
				</div>
			)}
		</div>
	);
}
