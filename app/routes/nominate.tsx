import { useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { db } from "~/server/database.server";
import { searchGames } from "~/server/igdb.server";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";
import { getSession } from "~/sessions";
import type { Nomination, NominationFormData } from "~/types";
import type { Route } from "./+types/nominate";

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "nominating" ? monthRow.id : undefined;

	// Fetch all previous GOTM winners
	const result = await db.execute(
		`SELECT DISTINCT game_id 
        FROM winners;`,
	);
	const previousWinners = result.rows.map((w) =>
		(w.game_id as number).toString(),
	);

	// Fetch user's nominations for the current month if in nominating phase
	let userNominations: Nomination[] = [];
	let allNominations: Nomination[] = [];
	if (monthId) {
		// Fetch all nominations for the month
		allNominations = await getNominationsForMonth(monthId);

		// Filter for user's nominations
		userNominations = allNominations.filter((n) => n.discordId === discordId);
	}

	return {
		games: [],
		monthId,
		monthStatus: monthRow.status,
		userDiscordId: discordId,
		userNominations,
		allNominations,
		previousWinners,
	};
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const query = formData.get("query");

	if (typeof query !== "string") {
		return Response.json({ games: [] });
	}

	const games = await searchGames(query);
	return Response.json({ games });
}

export default function Nominate({ loaderData }: Route.ComponentProps) {
	const {
		games: initialGames,
		monthId,
		monthStatus,
		userNominations,
		allNominations,
		userDiscordId,
		previousWinners,
	} = loaderData;
	const search = useFetcher<{ games: Nomination[] }>();
	const games = search.data?.games || initialGames;
	const [searchTerm, setSearchTerm] = useState("");
	const nominate = useFetcher<NominationResponse>();
	const isSearching =
		search.state === "submitting" || search.state === "loading";
	const hasSearched = search.data !== undefined; // Track if a search was performed

	// New state for modal
	const [isOpen, setIsOpen] = useState(false);
	const [selectedGame, setSelectedGame] = useState<Nomination | null>(null);
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

	// Track short and long nominations
	const shortNomination = userNominations.find((n) => n.short);
	const longNomination = userNominations.find((n) => !n.short);
	const hasReachedNominationLimit = shortNomination && longNomination;

	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!searchTerm.trim()) return;
		search.submit(
			{ query: searchTerm },
			{ method: "post", action: "/nominate" },
		);
	};

	const handleGameSelect = (
		game: Nomination,
		existingNomination?: Nomination,
	) => {
		if (hasReachedNominationLimit && !existingNomination) {
			// Don't allow new nominations if limit reached
			return;
		}

		if (existingNomination) {
			// If game is already nominated, go straight to pitch dialog
			setEditingNomination(existingNomination);
			setEditPitch(
				existingNomination.pitches.find((p) => p.discordId === userDiscordId)
					?.pitch || "",
			);
			setIsEditOpen(true);
		} else {
			// Otherwise show the nomination dialog
			setSelectedGame(game);
			setIsOpen(true);
		}
	};

	const handleEdit = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (fullNomination) {
			setEditingNomination(fullNomination);
			setEditPitch(
				fullNomination.pitches.find((p) => p.discordId === userDiscordId)
					?.pitch || "",
			);
			setIsEditOpen(true);
		}
	};

	const handleDelete = (nomination: Nomination) => {
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

		// Build the nomination data with type checking
		const nominationData: NominationFormData = {
			game: {
				id: Number(selectedGame.gameId),
				name: selectedGame.gameName,
				cover: selectedGame.gameCover,
				gameYear: selectedGame.gameYear,
				url: selectedGame.gameUrl,
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
				<h1 className="text-3xl font-bold tracking-tight text-zinc-200 mb-4">
					Nominations{" "}
					{monthStatus === "over" ? "haven't started" : "are closed"}
				</h1>

				<div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-8 shadow-lg">
					{monthStatus === "ready" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The month is being set up. Check back soon for nominations!
							</p>
							<Link
								to="/history"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Browse Past Months →
							</Link>
						</>
					)}
					{monthStatus === "voting" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The nomination phase is over, but you can now vote for your
								favorite games!
							</p>
							<Link
								to="/voting"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go Vote Now →
							</Link>
						</>
					)}

					{monthStatus === "playing" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								Games have been selected! Check out what we&#39;re playing this
								month.
							</p>
							<Link
								to="/"
								prefetch="viewport"
								className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
							>
								See This Month&#39;s Games →
							</Link>
						</>
					)}

					{monthStatus === "jury" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The jury is currently selecting games from the nominations.
								Check back soon!
							</p>
							<p className="text-zinc-400">
								Once they&#39;re done, you&#39;ll be able to vote on the
								selected games.
							</p>
						</>
					)}

					{monthStatus === "over" && (
						<>
							<p className="text-lg mb-6 text-zinc-200">
								The next month&#39;s nominations haven&#39;t started yet. Check
								back soon!
							</p>
							<Link
								to="/history"
								prefetch="viewport"
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
		<div className="group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl shadow-lg border border-zinc-800/50 flex h-52 min-w-0">
			<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
				<div className="absolute inset-0 bg-zinc-800 animate-pulse" />
			</div>
			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<div className="h-5 bg-zinc-800 rounded w-3/4 animate-pulse" />
						<div className="h-4 bg-zinc-800 rounded w-12 shrink-0 animate-pulse" />
					</div>
				</div>
				<div className="flex flex-col gap-2 mt-auto min-w-0">
					<div className="h-9 bg-zinc-800 rounded w-full animate-pulse" />
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
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						{userNominations.map((nomination) => (
							<GameCard
								game={nomination}
								key={nomination.id}
								variant="nomination"
								onEdit={handleEdit}
								onDelete={handleDelete}
								onViewPitches={() => {
									setSelectedNomination(nomination);
									setIsViewingPitches(true);
								}}
								pitchCount={nomination.pitches.length}
								showVotingButtons={false}
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

			{!hasReachedNominationLimit && (
				<div>
					<div className="mb-4">
						<h3 className="text-lg font-medium text-zinc-200">
							Nomination Status:
						</h3>
						<ul className="mt-2 space-y-1 text-sm text-zinc-400">
							<li className="flex items-center">
								<span
									className={
										shortNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{shortNomination ? "✓" : "○"} Short Game (
									{shortNomination ? "Nominated" : "Available"})
								</span>
							</li>
							<li className="flex items-center">
								<span
									className={
										longNomination ? "text-emerald-400" : "text-zinc-400"
									}
								>
									{longNomination ? "✓" : "○"} Long Game (
									{longNomination ? "Nominated" : "Available"})
								</span>
							</li>
						</ul>
					</div>

					<search.Form method="post" onSubmit={handleSearch} className="mb-8">
						<div className="flex gap-4">
							<Input
								type="search"
								name="query"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search for games..."
								className="flex-1 bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500"
							/>
							<button
								type="submit"
								disabled={isSearching || !searchTerm.trim()}
								className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-emerald-500 border border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:border-zinc-400/20"
							>
								{isSearching ? "Searching..." : "Search"}
							</button>
						</div>
					</search.Form>
					{isSearching ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{Array.from({ length: 10 }).map((_, i) => (
								<GameSkeleton key={`skeleton-${Date.now()}-${i}`} />
							))}
						</div>
					) : games.length > 0 ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{games.map((game: Nomination) => {
								const existingNomination = allNominations.find(
									(n) => n.gameId === game.gameId.toString(),
								);
								const isCurrentUserNomination =
									existingNomination?.discordId === userDiscordId;
								const isPreviousWinner = previousWinners.includes(
									game.id.toString(),
								);

								let buttonText = "Nominate";
								if (isPreviousWinner) {
									buttonText = "Previous GOTM";
								} else if (isCurrentUserNomination) {
									buttonText = "Edit Pitch";
								} else if (existingNomination) {
									buttonText = "Add Pitch";
								}

								return (
									<GameCard
										key={game.id}
										game={game}
										onNominate={() => {
											if (isPreviousWinner) {
												return; // Do nothing for previous winners
											}
											if (existingNomination) {
												// If it's the current user's nomination, open edit modal
												// If it's another user's nomination, allow adding a pitch
												setEditingNomination(existingNomination);
												setEditPitch("");
												setIsEditOpen(true);
											} else {
												handleGameSelect(game);
											}
										}}
										variant="search"
										alreadyNominated={Boolean(existingNomination)}
										isCurrentUserNomination={isCurrentUserNomination}
										isPreviousWinner={isPreviousWinner}
										buttonText={buttonText}
										buttonDisabled={isPreviousWinner}
									/>
								);
							})}
						</div>
					) : hasSearched && searchTerm ? (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								No results found
							</h3>
							<p className="mt-2 text-zinc-400">
								No games found matching &#34;{searchTerm}&#34;. Try a different
								search term.
							</p>
						</div>
					) : (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								Search for games to nominate
							</h3>
							<p className="mt-2 text-zinc-400">
								Type in the search box above to find games. You can nominate one
								short game and one long game.
							</p>
						</div>
					)}
				</div>
			)}

			{/* Game Length Selection Modal */}
			<Dialog
				open={isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsOpen(false);
						setPitch(""); // Reset pitch when closing modal
					}
				}}
			>
				<DialogContent className="w-full sm:w-[32rem] bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							Nominate {selectedGame?.gameName} ({selectedGame?.gameYear})
						</DialogTitle>
					</DialogHeader>

					{/* Game Cover and Summary */}
					<div className="mb-6 flex gap-4">
						{selectedGame?.gameCover && (
							<div className="flex-shrink-0">
								<img
									src={selectedGame.gameCover.replace(
										"/t_thumb/",
										"/t_cover_big/",
									)}
									alt={selectedGame.gameName}
									className="w-32 rounded-lg shadow-lg border border-white/10"
								/>
							</div>
						)}
						{selectedGame?.summary && (
							<div className="flex-1">
								<p className="text-sm text-zinc-400 line-clamp-[12]">
									{selectedGame.summary}
								</p>
							</div>
						)}
					</div>

					{/* Pitch Input */}
					<div className="mb-6">
						<Label htmlFor="pitch" className="text-zinc-400">
							Pitch (Optional)
						</Label>
						<Textarea
							id="pitch"
							name="pitch"
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={pitch}
							onChange={(e) => setPitch(e.target.value)}
						/>
					</div>

					<DialogFooter>
						<div className="grid grid-cols-2 gap-4 w-full">
							<button
								type="button"
								onClick={() => handleGameLength(true)}
								disabled={Boolean(shortNomination)}
								className={`w-full inline-flex flex-col items-center justify-center gap-1 px-4 py-4 text-sm font-medium rounded-lg border transition-all duration-300 ${
									shortNomination
										? "opacity-50 cursor-not-allowed text-zinc-400 border-zinc-400/20 bg-transparent"
										: "text-emerald-500 border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30"
								}`}
							>
								<span>Short Game</span>
								<span className="text-xs opacity-80">(&lt; 12 hours)</span>
								{shortNomination && (
									<span className="text-xs">Already nominated</span>
								)}
							</button>
							<button
								type="button"
								onClick={() => handleGameLength(false)}
								disabled={Boolean(longNomination)}
								className={`w-full inline-flex flex-col items-center justify-center gap-1 px-4 py-4 text-sm font-medium rounded-lg border transition-all duration-300 ${
									longNomination
										? "opacity-50 cursor-not-allowed text-zinc-400 border-zinc-400/20 bg-transparent"
										: "text-emerald-500 border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30"
								}`}
							>
								<span>Long Game</span>
								<span className="text-xs opacity-80">(&gt; 12 hours)</span>
								{longNomination && (
									<span className="text-xs">Already nominated</span>
								)}
							</button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Modal */}
			<Dialog
				open={isEditOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsEditOpen(false);
						setEditPitch("");
					}
				}}
			>
				<DialogContent className="w-full sm:w-[32rem] bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							{editingNomination && editingNomination.pitches.length > 0
								? "Edit"
								: "Add"}{" "}
							Pitch: {editingNomination?.gameName}
						</DialogTitle>
					</DialogHeader>

					<div className="mb-6">
						<Label htmlFor="editPitch" className="text-zinc-400">
							Pitch
						</Label>
						<Textarea
							id="editPitch"
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={editPitch}
							onChange={(e) => setEditPitch(e.target.value)}
							placeholder="Write your pitch here..."
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							onClick={() => setIsEditOpen(false)}
							variant="outline"
							className="bg-zinc-800 border-white/10 text-zinc-200 hover:bg-zinc-700"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleEditSubmit}
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							{editingNomination?.pitches ? "Save Changes" : "Add Pitch"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog
				open={isDeleteOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsDeleteOpen(false);
					}
				}}
			>
				<DialogContent className="w-full max-w-sm bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							Delete Nomination
						</DialogTitle>
					</DialogHeader>

					<p className="text-sm text-zinc-400 mb-6">
						Are you sure you want to delete your nomination for{" "}
						{deletingNomination?.gameName}? This action cannot be undone.
					</p>

					<DialogFooter>
						<Button
							type="button"
							onClick={() => setIsDeleteOpen(false)}
							variant="outline"
							className="bg-zinc-800 border-white/10 text-zinc-200 hover:bg-zinc-700"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleDeleteConfirm}
							variant="destructive"
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add PitchesModal */}
			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</div>
	);
}
