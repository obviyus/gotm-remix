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
import { pool, getCurrentMonth } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { RowDataPacket } from "mysql2";
import type { NominationFormData } from "~/types";

interface Game {
	id: number;
	name: string;
	cover?: {
		url: string;
	};
	first_release_date?: number;
	summary?: string;
}

interface Nomination extends RowDataPacket {
	id: number;
	game_name: string;
	game_cover: string;
	game_year: string;
	short: boolean;
	pitch?: string;
}

interface LoaderData {
	games: Game[];
	monthId?: number;
	userDiscordId: string;
	monthStatus?: string;
	userNominations: Nomination[];
	allNominations: Nomination[];
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

	const monthRow = await getCurrentMonth();

	const monthId = monthRow.status === "nominating" ? monthRow.id : undefined;

	// Fetch user's nominations for the current month if in nominating phase
	let userNominations: Nomination[] = [];
	let allNominations: Nomination[] = [];
	if (monthId) {
		// Fetch all nominations for the month
		const [allNominationsRows] = await pool.execute<Nomination[]>(
			`SELECT n.*, p.pitch, p.discord_id as pitch_discord_id
			 FROM nominations n 
			 LEFT JOIN pitches p ON n.id = p.nomination_id 
			 WHERE n.month_id = ?
			 ORDER BY n.created_at DESC`,
			[monthId],
		);
		allNominations = allNominationsRows;

		// Filter for user's nominations
		userNominations = allNominations.filter((n) => n.discord_id === discordId);
	}

	return json<LoaderData>({
		games: [],
		monthId,
		monthStatus: monthRow.status,
		userDiscordId: discordId,
		userNominations,
		allNominations,
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
		userNominations,
		allNominations,
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

	// State for edit modal
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingNomination, setEditingNomination] = useState<Nomination | null>(
		null,
	);
	const [editPitch, setEditPitch] = useState("");

	// Delete confirmation modal state
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [deletingNomination, setDeletingNomination] =
		useState<Nomination | null>(null);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		submit(e.currentTarget);
	};

	const handleGameSelect = (game: Game, existingNomination?: Nomination) => {
		if (existingNomination) {
			// If game is already nominated, go straight to pitch dialog
			setEditingNomination(existingNomination);
			setEditPitch("");
			setIsEditOpen(true);
		} else {
			// Otherwise show the nomination dialog
			setSelectedGame(game);
			setIsOpen(true);
		}
	};

	const handleEdit = (nomination: Game) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (fullNomination) {
			setEditingNomination(fullNomination);
			setEditPitch(fullNomination.pitch || "");
			setIsEditOpen(true);
		}
	};

	const handleDelete = (nomination: Game) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (fullNomination) {
			setDeletingNomination(fullNomination);
			setIsDeleteOpen(true);
		}
	};

	const handleEditSubmit = () => {
		if (!editingNomination) return;

		nominate.submit(
			{
				nominationId: editingNomination.id,
				pitch: editPitch.trim() || null,
			},
			{
				method: "PATCH",
				action: "/api/nominations",
				encType: "application/json",
			},
		);

		setIsEditOpen(false);
		setEditingNomination(null);
		setEditPitch("");
	};

	const handleDeleteConfirm = () => {
		if (!deletingNomination) return;

		nominate.submit(
			{
				nominationId: deletingNomination.id.toString(),
				_action: "delete",
			},
			{
				method: "DELETE",
				action: "/api/nominations",
			},
		);

		setIsDeleteOpen(false);
		setDeletingNomination(null);
	};

	const handleGameLength = (isShort: boolean) => {
		if (!selectedGame) return;

		// Convert first_release_date to a year string
		const gameYear = selectedGame.first_release_date
			? new Date(selectedGame.first_release_date * 1000)
					.getFullYear()
					.toString()
			: undefined;

		// Build the nomination data with type checking
		const nominationData: NominationFormData = {
			game: {
				id: selectedGame.id,
				name: selectedGame.name,
				cover: selectedGame.cover,
				first_release_date: selectedGame.first_release_date,
				game_year: gameYear,
				summary: selectedGame.summary,
			},
			monthId: monthId?.toString() ?? "",
			short: isShort,
			pitch: pitch.trim() || null,
		};

		// Submit as stringified JSON
		nominate.submit(
			{ json: JSON.stringify(nominationData) },
			{
				method: "POST",
				action: "/api/nominations",
				encType: "application/json",
			},
		);

		setIsOpen(false);
		setSelectedGame(null);
		setPitch("");
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

			{/* User's nominations */}
			{userNominations.length > 0 && (
				<div className="mb-8">
					<h2 className="text-xl font-semibold mb-4">Your Nominations</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{userNominations.map((nomination) => (
							<GameCard
								game={{
									id: nomination.id,
									name: nomination.game_name,
									cover: { url: nomination.game_cover },
									first_release_date: Number.parseInt(nomination.game_year),
									summary: nomination.pitch,
									short: nomination.short,
									pitch: nomination.pitch,
								}}
								key={nomination.id}
								variant="nomination"
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
					</div>
				</div>
			)}

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

			{/* Edit Modal */}
			<Dialog
				open={isEditOpen}
				onClose={() => {
					setIsEditOpen(false);
					setEditPitch("");
				}}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/30" aria-hidden="true" />
				<div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
					<DialogPanel className="w-full sm:w-[32rem] rounded-t-lg sm:rounded-lg bg-white p-6 shadow-xl">
						<DialogTitle className="text-lg font-medium leading-6 text-gray-900 mb-4">
							{editingNomination?.pitch ? "Edit" : "Add"} Pitch:{" "}
							{editingNomination?.game_name}
						</DialogTitle>
						<div className="mb-6">
							<label
								htmlFor="editPitch"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Pitch
							</label>
							<textarea
								id="editPitch"
								rows={3}
								className="pl-2 pt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								value={editPitch}
								onChange={(e) => setEditPitch(e.target.value)}
								placeholder="Write your pitch here..."
							/>
						</div>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setIsEditOpen(false)}
								className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleEditSubmit}
								className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
							>
								{editingNomination?.pitch ? "Save Changes" : "Add Pitch"}
							</button>
						</div>
					</DialogPanel>
				</div>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog
				open={isDeleteOpen}
				onClose={() => setIsDeleteOpen(false)}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/30" aria-hidden="true" />
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
						<DialogTitle className="text-lg font-medium leading-6 text-gray-900 mb-4">
							Delete Nomination
						</DialogTitle>
						<p className="text-sm text-gray-500 mb-6">
							Are you sure you want to delete your nomination for{" "}
							{deletingNomination?.game_name}? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setIsDeleteOpen(false)}
								className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDeleteConfirm}
								className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
							>
								Delete
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
					{games.map((game: Game) => {
						const existingNomination = allNominations.find(
							(n) => String(n.game_id) === String(game.id),
						);
						const isCurrentUserNomination =
							existingNomination?.discord_id === userDiscordId;

						return (
							<GameCard
								key={game.id}
								game={game}
								onNominate={() => handleGameSelect(game, existingNomination)}
								variant="search"
								alreadyNominated={Boolean(existingNomination)}
								isCurrentUserNomination={isCurrentUserNomination}
							/>
						);
					})}
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
