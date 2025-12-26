import type { ChangeEvent, FormEvent } from "react";
import { useId, useState } from "react";
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
import type { Nomination, Pitch } from "~/types";
import type { Route } from "./+types/nominate";

interface NominationResponse {
	error?: string;
	success?: boolean;
	nominationId?: number;
}

interface SearchResultCardProps {
	game: Nomination;
	existingNomination?: Nomination;
	isCurrentUserNomination: boolean;
	isPreviousWinner: boolean;
	buttonText: string;
	buttonDisabled: boolean;
	canNominateMore: boolean;
	onNominateGame: (game: Nomination) => void;
	onOpenNominationModal: (nomination: Nomination) => void;
}

function SearchResultCard({
	game,
	existingNomination,
	isCurrentUserNomination,
	isPreviousWinner,
	buttonText,
	buttonDisabled,
	canNominateMore,
	onNominateGame,
	onOpenNominationModal,
}: SearchResultCardProps) {
	const disableNominationAction =
		buttonDisabled || (!existingNomination && !canNominateMore);

	const handleNominateClick = () => {
		if (isPreviousWinner || disableNominationAction) {
			return;
		}

		if (existingNomination) {
			onOpenNominationModal(existingNomination);
			return;
		}

		onNominateGame(game);
	};

	return (
		<GameCard
			key={game.id}
			game={game}
			variant="search"
			onNominate={handleNominateClick}
			alreadyNominated={Boolean(existingNomination)}
			isCurrentUserNomination={isCurrentUserNomination}
			isPreviousWinner={isPreviousWinner}
			buttonText={buttonText}
			buttonDisabled={disableNominationAction}
		/>
	);
}

interface PitchCardProps {
	nomination: Nomination;
	pitch: Pitch;
	onEditPitch: (nomination: Nomination) => void;
	onDeletePitch: (nomination: Nomination) => void;
	onViewPitches: (nomination: Nomination) => void;
}

function PitchCard({
	nomination,
	pitch,
	onEditPitch,
	onDeletePitch,
	onViewPitches,
}: PitchCardProps) {
	const coverUrl = nomination.gameCover?.replace("t_thumb", "t_cover_big");
	const year = nomination.gameYear;

	return (
		<div className="group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl border border-zinc-800/50 transition-colors duration-200 flex">
			{coverUrl ? (
				<div className="w-[6.5rem] sm:w-[7.5rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
					<img
						src={coverUrl}
						alt={nomination.gameName}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				</div>
			) : (
				<div className="w-[6.5rem] sm:w-[7.5rem] flex-shrink-0 overflow-hidden rounded-l-xl bg-zinc-800/60" />
			)}

			<div className="flex-1 p-4 sm:p-5 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<h3 className="text-base font-semibold text-zinc-100 truncate">
							{nomination.gameName}
						</h3>
						{year && (
							<p className="text-xs text-zinc-500 font-medium mt-1">{year}</p>
						)}
					</div>
					<button
						type="button"
						onClick={() => onViewPitches(nomination)}
						className="inline-flex shrink-0 items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40"
					>
						View pitches
					</button>
				</div>

				<div className="text-sm text-zinc-200 bg-black/20 border border-white/5 rounded-lg p-3 whitespace-pre-line leading-relaxed line-clamp-4">
					{pitch.pitch}
				</div>

				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						onClick={() => onEditPitch(nomination)}
						className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40"
					>
						Edit pitch
					</button>
					<button
						type="button"
						onClick={() => onDeletePitch(nomination)}
						className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40"
					>
						Delete pitch
					</button>
				</div>
			</div>
		</div>
	);
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
	const method = request.method.toUpperCase();
	const formData = await request.formData();
	const intent = (formData.get("intent") || "").toString();

	// Handle search (POST + intent=search) to keep existing UX
	if (method === "POST" && intent === "search") {
		const query = formData.get("query");
		if (typeof query !== "string" || !query.trim()) {
			return Response.json({ games: [] });
		}
		const games = await searchGames(query);
		return Response.json({ games });
	}

	// All mutations below require auth
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");
	if (!discordId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Reuse previous winners check
	const winners = await db.execute("SELECT DISTINCT game_id FROM winners");
	const previousWinners = new Set(
		winners.rows.map((w) => (w.game_id ?? "").toString()),
	);

	if (method === "POST" && intent === "createNomination") {
		try {
			const monthId = formData.get("monthId")?.toString() ?? "";
			const short = formData.get("short") === "true";
			const pitch = formData.get("pitch")?.toString() || null;

			const gameIdStr = formData.get("gameId")?.toString();
			const gameName = formData.get("gameName")?.toString() || "";
			const gameCover = formData.get("gameCover")?.toString() || null;
			const gameYear = formData.get("gameYear")?.toString() || null;
			const gameUrl = formData.get("gameUrl")?.toString() || null;

			if (!monthId || !gameIdStr || !gameName) {
				return Response.json(
					{ error: "Missing required fields" },
					{ status: 400 },
				);
			}

			// Reject previous winners
			if (previousWinners.has(gameIdStr)) {
				return Response.json(
					{ error: "This game has already won GOTM in a previous month" },
					{ status: 400 },
				);
			}

			// Check if user already nominated/pitched this game for the month
			const existing = await db.execute({
				sql: "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
				args: [monthId, gameIdStr, discordId],
			});

			if (existing.rows.length > 0) {
				return Response.json(
					{
						error:
							"You have already nominated or pitched this game for this month",
					},
					{ status: 400 },
				);
			}

			// Normalize cover size like before
			const normalizedCover =
				gameCover?.replace("t_thumb", "t_cover_big") || null;

			// Insert nomination
			const nomination = await db.execute({
				sql: "INSERT INTO nominations (month_id, game_id, discord_id, short, game_name, game_year, game_cover, game_url, jury_selected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())",
				args: [
					monthId,
					gameIdStr,
					discordId,
					short ? 1 : 0,
					gameName,
					gameYear || null,
					normalizedCover,
					gameUrl || null,
					0,
				],
			});

			if (pitch && nomination.lastInsertRowid) {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nomination.lastInsertRowid, discordId, pitch],
				});
			}

			return Response.json({
				success: true,
				nominationId: nomination.lastInsertRowid
					? Number(nomination.lastInsertRowid)
					: null,
			});
		} catch (error) {
			console.error("Error processing nomination:", error);
			return Response.json(
				{
					error:
						"Failed to process nomination. Please make sure all required fields are provided.",
				},
				{ status: 500 },
			);
		}
	}

	if (method === "PATCH") {
		try {
			const nominationIdStr = formData.get("nominationId")?.toString();
			const nominationId = nominationIdStr
				? Number.parseInt(nominationIdStr, 10)
				: null;
			if (!nominationId || Number.isNaN(nominationId)) {
				return Response.json(
					{ error: "Invalid nomination ID" },
					{ status: 400 },
				);
			}

			// Fetch nomination and any existing pitch by this user
			const nomination = await db.execute({
				sql: `SELECT n.*, p.discord_id as pitch_discord_id
                      FROM nominations n
                      LEFT JOIN pitches p ON n.id = p.nomination_id AND p.discord_id = ?
                      WHERE n.id = ?`,
				args: [discordId, nominationId],
			});

			if (nomination.rows.length === 0) {
				return Response.json(
					{ error: "Nomination not found" },
					{ status: 404 },
				);
			}

			const gameId = nomination.rows[0].game_id?.toString() ?? "";
			if (previousWinners.has(gameId)) {
				return Response.json(
					{ error: "Cannot modify nominations for previous GOTM winners" },
					{ status: 400 },
				);
			}

			const hasExistingPitch =
				nomination.rows[0].pitch_discord_id === discordId;
			const patchIntent = intent || "savePitch";

			if (patchIntent === "deletePitch") {
				if (!hasExistingPitch) {
					return Response.json(
						{ error: "No existing pitch to delete" },
						{ status: 400 },
					);
				}

				await db.execute({
					sql: "DELETE FROM pitches WHERE nomination_id = ? AND discord_id = ?",
					args: [nominationId, discordId],
				});

				return Response.json({ success: true });
			}

			const pitchInput = formData.get("pitch");
			const pitch = typeof pitchInput === "string" ? pitchInput.trim() : "";
			if (!pitch) {
				return Response.json(
					{ error: "Pitch cannot be empty" },
					{ status: 400 },
				);
			}

			if (hasExistingPitch) {
				await db.execute({
					sql: "UPDATE pitches SET pitch = ?, updated_at = unixepoch() WHERE nomination_id = ? AND discord_id = ?",
					args: [pitch, nominationId, discordId],
				});
			} else {
				await db.execute({
					sql: "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
					args: [nominationId, discordId, pitch],
				});
			}

			return Response.json({ success: true });
		} catch (error) {
			console.error("Error processing edit:", error);
			return Response.json(
				{ error: "Failed to process edit. Please try again." },
				{ status: 500 },
			);
		}
	}

	if (method === "DELETE") {
		const nominationId = formData.get("nominationId")?.toString();
		if (!nominationId) {
			return Response.json({ error: "Missing nomination ID" }, { status: 400 });
		}

		// Verify ownership
		const nomination = await db.execute({
			sql: "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
			args: [nominationId, discordId],
		});

		if (nomination.rows.length === 0) {
			return Response.json(
				{ error: "Nomination not found or unauthorized" },
				{ status: 404 },
			);
		}

		await db.execute({
			sql: "DELETE FROM nominations WHERE id = ?",
			args: [nominationId],
		});

		return Response.json({ success: true });
	}

	return Response.json({ error: "Invalid action" }, { status: 400 });
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

	// Generate unique IDs for form elements
	const pitchId = useId();
	const editPitchId = useId();

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
	const [isDeletePitchOpen, setIsDeletePitchOpen] = useState(false);
	const [pitchToDelete, setPitchToDelete] = useState<Nomination | null>(null);

	// Track short and long nominations
	const shortNomination = userNominations.find((n) => n.short);
	const longNomination = userNominations.find((n) => !n.short);
	const hasReachedNominationLimit = shortNomination && longNomination;

	const nominationsWithUserPitches = allNominations.filter((nomination) =>
		nomination.pitches.some((pitchEntry) => pitchEntry.discordId === userDiscordId),
	);
	const userPitchNominations = nominationsWithUserPitches.filter(
		(nomination) => nomination.discordId !== userDiscordId,
	);

	const shouldUseLocalSearch = Boolean(hasReachedNominationLimit);
	const normalizedSearchTerm = searchTerm.trim().toLowerCase();
	const filteredLocalNominations = shouldUseLocalSearch
		? allNominations.filter((nomination) =>
				nomination.gameName.toLowerCase().includes(normalizedSearchTerm),
			)
		: [];
	const displayedGames = shouldUseLocalSearch ? filteredLocalNominations : games;
	const filteredDisplayedGames = displayedGames.filter((game) => {
		const rawGameId = game.gameId ?? game.id;
		const igdbId = rawGameId ? String(rawGameId) : "";
		const existingNomination = shouldUseLocalSearch
			? game
			: allNominations.find((nomination) => nomination.gameId === igdbId);
		if (!existingNomination) {
			return true;
		}

		const hasUserPitch = existingNomination.pitches.some(
			(pitchEntry) => pitchEntry.discordId === userDiscordId,
		);
		return !hasUserPitch;
	});
	const isSearching = shouldUseLocalSearch
		? false
		: search.state === "submitting" || search.state === "loading";
	const hasSearched = shouldUseLocalSearch
		? normalizedSearchTerm.length > 0
		: search.data !== undefined;
	const searchPlaceholder = shouldUseLocalSearch
		? "Search existing nominations..."
		: "Search for games...";
	const searchButtonLabel = shouldUseLocalSearch
		? "Filter"
		: isSearching
			? "Searching..."
			: "Search";

	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);
	const editingPitchEntry = editingNomination?.pitches.find(
		(pitchEntry) => pitchEntry.discordId === userDiscordId,
	);
	const hasExistingEditingPitch = Boolean(editingPitchEntry);
	const isSaveDisabled = editPitch.trim().length === 0;

	const handleSearch = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (shouldUseLocalSearch) {
			return;
		}
		if (!searchTerm.trim()) return;
		void search.submit({ intent: "search", query: searchTerm }, { method: "post" });
	};

	const handleGameSelect = (
		game: Nomination,
		existingNomination?: Nomination,
	) => {
		if (hasReachedNominationLimit && !existingNomination) {
			return;
		}

		if (existingNomination) {
			openNominationModal(existingNomination);
			return;
		}

		setSelectedGame(game);
		setIsOpen(true);
	};

	const handleEdit = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (!fullNomination) {
			return;
		}

		openNominationModal(fullNomination);
	};

	const handleDelete = (nomination: Nomination) => {
		const fullNomination = userNominations.find((n) => n.id === nomination.id);
		if (!fullNomination) {
			return;
		}

		setDeletingNomination(fullNomination);
		setIsDeleteOpen(true);
	};

	const handlePitchEdit = (nomination: Nomination) => {
		openNominationModal(nomination);
	};

	const openDeletePitchDialog = (nomination: Nomination) => {
		setPitchToDelete(nomination);
		setIsDeletePitchOpen(true);
	};

	const handleEditSubmit = () => {
		if (!editingNomination || isSaveDisabled) {
			return;
		}

		void nominate.submit(
			{
				intent: "savePitch",
				nominationId: editingNomination.id.toString(),
				pitch: editPitch.trim(),
			},
			{ method: "PATCH" },
		);

		setIsEditOpen(false);
		setEditingNomination(null);
		setEditPitch("");
	};

	const handleDeleteConfirm = () => {
		if (!deletingNomination) {
			return;
		}

		void nominate.submit(
			{
				nominationId: deletingNomination.id.toString(),
			},
			{ method: "DELETE" },
		);

		setIsDeleteOpen(false);
		setDeletingNomination(null);
	};

	const handleGameLength = (isShort: boolean) => {
		if (!selectedGame) {
			return;
		}

		void nominate.submit(
			{
				intent: "createNomination",
				monthId: monthId?.toString() ?? "",
				short: String(isShort),
				pitch: pitch.trim() || "",
				gameId: String(selectedGame.gameId),
				gameName: selectedGame.gameName,
				gameCover: selectedGame.gameCover || "",
				gameYear: selectedGame.gameYear || "",
				gameUrl: selectedGame.gameUrl || "",
			},
			{ method: "POST" },
		);

		setIsOpen(false);
		setSelectedGame(null);
		setPitch("");
	};

	const selectShortGame = () => {
		handleGameLength(true);
	};

	const selectLongGame = () => {
		handleGameLength(false);
	};

	const handleEditPitchChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setEditPitch(event.target.value);
	};

	const handleEditDialogOpenChange = (open: boolean) => {
		setIsEditOpen(open);
		if (!open) {
			setEditPitch("");
		}
	};

	const handleDeleteDialogOpenChange = (open: boolean) => {
		setIsDeleteOpen(open);
		if (!open) {
			setDeletingNomination(null);
		}
	};

	const closeEditModal = () => {
		setIsEditOpen(false);
		setEditPitch("");
	};

	const closeDeleteModal = () => {
		setIsDeleteOpen(false);
		setDeletingNomination(null);
	};

	const handleDeletePitchDialogOpenChange = (open: boolean) => {
		setIsDeletePitchOpen(open);
		if (!open) {
			setPitchToDelete(null);
		}
	};

	const handleDeletePitchConfirm = () => {
		if (!pitchToDelete) {
			return;
		}

		void nominate.submit(
			{
				intent: "deletePitch",
				nominationId: pitchToDelete.id.toString(),
			},
			{ method: "PATCH" },
		);

		setIsDeletePitchOpen(false);
		setPitchToDelete(null);
		setIsEditOpen(false);
		setEditingNomination(null);
		setEditPitch("");
	};

	const closePitchesModal = () => {
		setIsViewingPitches(false);
		setSelectedNomination(null);
	};

	const handleViewPitches = (nomination: Nomination) => {
		setSelectedNomination(nomination);
		setIsViewingPitches(true);
	};

	const openNominationModal = (nomination: Nomination) => {
		setEditingNomination(nomination);
		setEditPitch(
			nomination.pitches.find((p) => p.discordId === userDiscordId)?.pitch ||
				"",
		);
		setIsEditOpen(true);
	};

	const handleSearchTermChange = (event: ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(event.target.value);
	};

	const handleNominationDialogOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setPitch("");
			setSelectedGame(null);
		}
	};

	const handlePitchChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setPitch(event.target.value);
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
								onViewPitches={() => handleViewPitches(nomination)}
								pitchCount={nomination.pitches.length}
								showVotingButtons={false}
							/>
						))}
					</div>
				</div>
			)}

			{userPitchNominations.length > 0 && (
				<div className="mb-8">
					<h2 className="text-xl font-semibold mb-4">Your Pitches</h2>
					<div className="space-y-4">
						{userPitchNominations.map((nomination) => {
							const currentPitch = nomination.pitches.find(
								(pitchEntry) => pitchEntry.discordId === userDiscordId,
							);
							if (!currentPitch) {
								return null;
							}

							return (
								<PitchCard
									key={nomination.id}
									nomination={nomination}
									pitch={currentPitch}
									onEditPitch={handlePitchEdit}
									onDeletePitch={openDeletePitchDialog}
									onViewPitches={handleViewPitches}
								/>
							);
						})}
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

				{hasReachedNominationLimit && (
					<div className="mb-6 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
						You have nominated a short and a long game. You can still add
						pitches to existing nominations using the search below.
					</div>
				)}

				<search.Form method="post" onSubmit={handleSearch} className="mb-8">
					<div className="flex gap-4">
						<Input
							type="search"
							name="query"
							value={searchTerm}
							onChange={handleSearchTermChange}
							placeholder={searchPlaceholder}
							className="flex-1 bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500"
						/>
						<input type="hidden" name="intent" value="search" />
						<button
							type="submit"
							disabled={
								!shouldUseLocalSearch && (isSearching || !searchTerm.trim())
							}
							className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-emerald-500 border border-emerald-400/20 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:border-zinc-400/20"
						>
							{searchButtonLabel}
						</button>
					</div>
				</search.Form>
				{isSearching ? (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						{Array.from({ length: 10 }).map((_, i) => (
							<GameSkeleton key={`skeleton-${Date.now()}-${i}`} />
						))}
					</div>
					) : filteredDisplayedGames.length > 0 ? (
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{filteredDisplayedGames.map((game: Nomination) => {
								const rawGameId = game.gameId ?? game.id;
								const igdbId = rawGameId ? String(rawGameId) : "";
								const existingNomination = shouldUseLocalSearch
									? game
									: allNominations.find((n) => n.gameId === igdbId);
							const isCurrentUserNomination =
								existingNomination?.discordId === userDiscordId;
							const isPreviousWinner =
								igdbId !== "" && previousWinners.includes(igdbId);
							const canNominateMore = !hasReachedNominationLimit;
							const blockNewNomination =
								!existingNomination && !canNominateMore;

							let buttonText = "Nominate";
							if (isPreviousWinner) {
								buttonText = "Previous GOTM";
							} else if (isCurrentUserNomination) {
								buttonText = "Edit Pitch";
							} else if (existingNomination) {
								buttonText = "Add Pitch";
							} else if (blockNewNomination) {
								buttonText = "Nomination limit reached";
							}
							const disableButton = isPreviousWinner || blockNewNomination;

							return (
								<SearchResultCard
									key={game.id}
									game={game}
									existingNomination={existingNomination}
									isCurrentUserNomination={isCurrentUserNomination}
									isPreviousWinner={isPreviousWinner}
									buttonText={buttonText}
									buttonDisabled={disableButton}
									canNominateMore={canNominateMore}
									onNominateGame={handleGameSelect}
									onOpenNominationModal={openNominationModal}
								/>
							);
						})}
					</div>
				) : shouldUseLocalSearch ? (
					allNominations.length === 0 ? (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								No nominations yet
							</h3>
							<p className="mt-2 text-zinc-400">
								Once nominations start rolling in, you can add pitches to them
								here.
							</p>
						</div>
					) : (
						<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
							<h3 className="text-lg font-semibold text-zinc-200">
								{normalizedSearchTerm.length > 0 ? (
									<>
										No nominations match{" "}
										<span className="text-emerald-200">
											&quot;{searchTerm}&quot;
										</span>
									</>
								) : (
									"You're all caught up"
								)}
							</h3>
							<p className="mt-2 text-zinc-400">
								{normalizedSearchTerm.length > 0
									? "Try a different name or browse the full list to find a game to pitch."
									: "You've already added pitches to every nomination currently available."}
							</p>
						</div>
					)
				) : hasSearched ? (
					<div className="text-center py-12 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10">
						<h3 className="text-lg font-semibold text-zinc-200">
							No results found
						</h3>
						<p className="mt-2 text-zinc-400">
							No games found matching &quot;{searchTerm}&quot;. Try a different
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

			{/* Game Length Selection Modal */}
			<Dialog open={isOpen} onOpenChange={handleNominationDialogOpenChange}>
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
						<Label htmlFor={pitchId} className="text-zinc-400">
							Pitch (Optional)
						</Label>
						<Textarea
							id={pitchId}
							name="pitch"
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={pitch}
							onChange={handlePitchChange}
						/>
					</div>

					<DialogFooter>
						<div className="grid grid-cols-2 gap-4 w-full">
							<button
								type="button"
								onClick={selectShortGame}
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
								onClick={selectLongGame}
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
			<Dialog open={isEditOpen} onOpenChange={handleEditDialogOpenChange}>
				<DialogContent className="w-full sm:w-[32rem] bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">
							{hasExistingEditingPitch ? "Edit" : "Add"} Pitch:{" "}
							{editingNomination?.gameName}
						</DialogTitle>
					</DialogHeader>

					<div className="mb-6">
						<Label htmlFor={editPitchId} className="text-zinc-400">
							Pitch
						</Label>
						<Textarea
							id={editPitchId}
							rows={3}
							className="bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:ring-blue-500 mt-2"
							value={editPitch}
							onChange={handleEditPitchChange}
							placeholder="Write your pitch here..."
						/>
					</div>

					<DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
						{hasExistingEditingPitch && editingNomination && (
							<button
								type="button"
								onClick={() => openDeletePitchDialog(editingNomination)}
								className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40"
							>
								Delete pitch
							</button>
						)}
						<div className="flex w-full justify-end gap-2 sm:w-auto">
							<Button
								type="button"
								onClick={closeEditModal}
								variant="outline"
								className="bg-zinc-800 border-white/10 text-zinc-200 hover:bg-zinc-700"
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={handleEditSubmit}
								className="bg-blue-600 hover:bg-blue-700 text-white"
								disabled={isSaveDisabled}
							>
								{hasExistingEditingPitch ? "Save Changes" : "Add Pitch"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isDeletePitchOpen}
				onOpenChange={handleDeletePitchDialogOpenChange}
			>
				<DialogContent className="w-full max-w-sm bg-zinc-900 border-white/10">
					<DialogHeader>
						<DialogTitle className="text-zinc-200">Delete Pitch</DialogTitle>
					</DialogHeader>

					<p className="text-sm text-zinc-400 mb-6">
						Are you sure you want to remove your pitch for{" "}
						{pitchToDelete?.gameName}? You can always add a new pitch later.
					</p>

					<DialogFooter>
						<button
							type="button"
							onClick={() => handleDeletePitchDialogOpenChange(false)}
							className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-zinc-200 border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleDeletePitchConfirm}
							className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40"
						>
							Delete pitch
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Modal */}
			<Dialog open={isDeleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
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
							onClick={closeDeleteModal}
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
				onClose={closePitchesModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
