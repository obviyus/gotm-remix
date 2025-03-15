import { useFetcher, useLoaderData } from "@remix-run/react";
import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { json, type LoaderFunction, redirect } from "@remix-run/node";
import { db } from "~/server/database.server";
import type { Nomination } from "~/types";
import { useState } from "react";
import GameCard from "~/components/GameCard";
import { getSession } from "~/sessions";
import { TrashIcon } from "@heroicons/react/20/solid";
import SplitLayout, { Column } from "~/components/SplitLayout";
import PitchesModal from "~/components/PitchesModal";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationById } from "~/server/nomination.server";

interface LoaderData {
	monthId: number;
	userId: string;
	shortNominations: Nomination[];
	longNominations: Nomination[];
	votedShort: boolean;
	votedLong: boolean;
	shortRankings: Array<{ nomination_id: number; rank: number }>;
	longRankings: Array<{ nomination_id: number; rank: number }>;
}

export const loader: LoaderFunction = async ({ request }) => {
	// Check for authentication
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	if (!discordId) {
		return redirect("/auth/discord");
	}

	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "voting" ? monthRow.id : undefined;

	if (!monthId) {
		return json({ monthId: undefined });
	}

	// Check if user has already voted
	const shortVoteResult = await db.execute({
		sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 1`,
		args: [monthId, discordId],
	});

	const longVoteResult = await db.execute({
		sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 0`,
		args: [monthId, discordId],
	});

	// Fetch nominations
	const shortNomResult = await db.execute({
		sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 1`,
		args: [monthId],
	});

	const longNomResult = await db.execute({
		sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 0`,
		args: [monthId],
	});

	const shortNoms = await Promise.all(
		shortNomResult.rows.map(
			async (row) => await getNominationById(row.id as number),
		),
	);
	const longNoms = await Promise.all(
		longNomResult.rows.map(
			async (row) => await getNominationById(row.id as number),
		),
	);

	// Fetch existing rankings if user has voted
	let shortRankings: Array<{ nomination_id: number; rank: number }> = [];
	let longRankings: Array<{ nomination_id: number; rank: number }> = [];

	if (shortVoteResult.rows[0]) {
		const shortRankResult = await db.execute({
			sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
			args: [shortVoteResult.rows[0].id],
		});
		shortRankings = shortRankResult.rows.map((row) => ({
			nomination_id: row.nomination_id as number,
			rank: row.rank as number,
		}));
	}

	if (longVoteResult.rows[0]) {
		const longRankResult = await db.execute({
			sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
			args: [longVoteResult.rows[0].id],
		});
		longRankings = longRankResult.rows.map((row) => ({
			nomination_id: row.nomination_id as number,
			rank: row.rank as number,
		}));
	}

	return json({
		monthId,
		userId: discordId,
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: Boolean(shortVoteResult.rows[0]),
		votedLong: Boolean(longVoteResult.rows[0]),
		shortRankings,
		longRankings,
	});
};

export default function Voting() {
	const {
		monthId,
		userId,
		shortNominations = [],
		longNominations = [],
		votedShort: initialVotedShort,
		votedLong: initialVotedLong,
		shortRankings = [],
		longRankings = [],
	} = useLoaderData<LoaderData>();

	const voteFetcher = useFetcher();

	// Initialize order based on existing rankings if available
	const [currentOrder, setCurrentOrder] = useState<Record<number, string[]>>(
		() => {
			const initialOrder: Record<number, string[]> = {
				0: ["divider"], // long games
				1: ["divider"], // short games
			};

			// For long games
			if (longRankings?.length > 0) {
				// Add ranked games in order
				const rankedLongIds = longRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[0].unshift(...rankedLongIds);

				// Add remaining unranked games below divider
				const unrankedLongIds = longNominations
					.filter((n) => !longRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[0].push(...unrankedLongIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[0].push(
					...(longNominations || []).map((n) => String(n.id)),
				);
			}

			// For short games
			if (shortRankings?.length > 0) {
				// Add ranked games in order
				const rankedShortIds = shortRankings
					.sort((a, b) => a.rank - b.rank)
					.map((r) => String(r.nomination_id));
				initialOrder[1].unshift(...rankedShortIds);

				// Add remaining unranked games below divider
				const unrankedShortIds = shortNominations
					.filter((n) => !shortRankings.find((r) => r.nomination_id === n.id))
					.map((n) => String(n.id));
				initialOrder[1].push(...unrankedShortIds);
			} else {
				// If no rankings, all games go below divider
				initialOrder[1].push(
					...(shortNominations || []).map((n) => String(n.id)),
				);
			}

			return initialOrder;
		},
	);

	const [votedLong, setVotedLong] = useState(initialVotedLong);
	const [votedShort, setVotedShort] = useState(initialVotedShort);
	const [selectedNomination, setSelectedNomination] =
		useState<Nomination | null>(null);
	const [isViewingPitches, setIsViewingPitches] = useState(false);

	const deleteVote = async (short: boolean) => {
		voteFetcher.submit(
			{ monthId, userId, short },
			{ method: "DELETE", action: "/api/votes" },
		);

		// Update local state
		const shortKey = short ? 1 : 0;
		const games = short ? shortNominations : longNominations;

		setCurrentOrder((prev) => ({
			...prev,
			[shortKey]: ["divider", ...games.map((n) => String(n.id))],
		}));

		if (short) {
			setVotedShort(false);
		} else {
			setVotedLong(false);
		}
	};

	const onDragEnd = async (result: DropResult) => {
		if (!result.destination) return;

		const isShort = result.source.droppableId === "short";
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Handle dragging items
		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		// Update the local state
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));

		// Get items above the divider and save them as votes
		const newDividerIndex = items.indexOf("divider");
		const rankedItems = items.slice(0, newDividerIndex);

		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		} else {
			await deleteVote(isShort);
		}
	};

	const saveVote = async (short: boolean, order: string[]) => {
		const validOrder = order
			.filter((id) => id && id !== "divider")
			.map((id) => Number.parseInt(id));

		if (validOrder.length === 0) {
			await deleteVote(short);
			return;
		}

		voteFetcher.submit(
			{ monthId, userId, short, order: validOrder },
			{
				method: "POST",
				action: "/api/votes",
				encType: "application/json",
			},
		);

		updateVoteStatus(short, true);
	};

	const updateVoteStatus = (short: boolean, voted: boolean) => {
		if (short) {
			setVotedShort(voted);
		} else {
			setVotedLong(voted);
		}
	};

	const moveItemAboveDivider = async (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just above the divider
		const newDividerIndex = items.indexOf("divider");
		items.splice(newDividerIndex, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, items.indexOf("divider"));
		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		}
	};

	const moveItemBelowDivider = async (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		// Remove the item from its current position
		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		// Insert just below the divider
		const dividerIndex = items.indexOf("divider");
		items.splice(dividerIndex + 1, 0, itemId);

		// Update state and save
		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, dividerIndex);
		if (rankedItems.length > 0) {
			await saveVote(isShort, rankedItems);
		} else {
			await deleteVote(isShort);
		}
	};

	const renderGames = (games: Nomination[], isShort: boolean) => {
		const shortKey = isShort ? 1 : 0;
		const order = currentOrder[shortKey];
		const dividerIndex = order.indexOf("divider");

		// Initialize ranked and unranked games based on the current order
		const rankedGames = games
			.filter(
				(g) =>
					dividerIndex > -1 &&
					order.slice(0, dividerIndex).includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		const unrankedGames = games
			.filter(
				(g) =>
					dividerIndex === -1 ||
					order.slice(dividerIndex + 1).includes(String(g.id)) ||
					!order.includes(String(g.id)),
			)
			.sort((a, b) => {
				const aIndex = order.indexOf(String(a.id));
				const bIndex = order.indexOf(String(b.id));
				return aIndex - bIndex;
			});

		return (
			<Droppable droppableId={isShort ? "short" : "long"}>
				{(provided) => (
					<div {...provided.droppableProps} ref={provided.innerRef}>
						{/* Ranked Section */}
						<div className="space-y-4">
							{rankedGames.length === 0 && order.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">
										Drag games here to rank them in order of preference
									</p>
								</div>
							) : (
								rankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={index}
									>
										{(provided) => (
											<GameCard
												game={game}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={true}
												onUnrank={() =>
													moveItemBelowDivider(isShort, String(game.id))
												}
												onViewPitches={() => {
													setSelectedNomination(game);
													setIsViewingPitches(true);
												}}
												pitchCount={game.pitches?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>

						{/* Divider */}
						<Draggable draggableId="divider" index={rankedGames.length}>
							{(provided) => (
								<div
									ref={provided.innerRef}
									{...provided.draggableProps}
									{...provided.dragHandleProps}
									className="border-t-2 border-gray-600/60 my-8 relative max-w-3xl mx-auto w-full"
								>
									<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-6 py-1.5 text-sm font-medium text-gray-200 select-none rounded-full border border-gray-600/60">
										Drag above to rank
									</span>
								</div>
							)}
						</Draggable>

						{/* Unranked Section */}
						<div className="space-y-4">
							{unrankedGames.length === 0 ? (
								<div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
									<p className="text-sm text-gray-500">No unranked games</p>
								</div>
							) : (
								unrankedGames.map((game, index) => (
									<Draggable
										key={game.id}
										draggableId={String(game.id)}
										index={rankedGames.length + 1 + index}
									>
										{(provided) => (
											<GameCard
												game={game}
												draggableProps={provided.draggableProps}
												dragHandleProps={provided.dragHandleProps ?? undefined}
												innerRef={provided.innerRef}
												isRanked={false}
												onRank={() =>
													moveItemAboveDivider(isShort, String(game.id))
												}
												onViewPitches={() => {
													setSelectedNomination(game);
													setIsViewingPitches(true);
												}}
												pitchCount={game.pitches?.length || 0}
												showVotingButtons={true}
											/>
										)}
									</Draggable>
								))
							)}
						</div>
						{provided.placeholder}
					</div>
				)}
			</Droppable>
		);
	};

	return (
		<SplitLayout
			title="Drag and Drop the games"
			subtitle="to sort them in the priority you want them to win"
			description="Please only vote for games you actually want to play next month :)"
		>
			<Column
				title="Long Games"
				statusBadge={{
					text: votedLong ? "Voted" : "Not Voted",
					isSuccess: votedLong,
				}}
				action={
					votedLong && (
						<button
							type="button"
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
							onClick={() => deleteVote(false)}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
								Clear Vote
							</span>
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(longNominations, false)}
				</DragDropContext>
			</Column>

			<Column
				title="Short Games"
				statusBadge={{
					text: votedShort ? "Voted" : "Not Voted",
					isSuccess: votedShort,
				}}
				action={
					votedShort && (
						<button
							type="button"
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
							onClick={() => deleteVote(true)}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
								<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
								Clear Vote
							</span>
						</button>
					)
				}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					{renderGames(shortNominations, true)}
				</DragDropContext>
			</Column>

			<PitchesModal
				isOpen={isViewingPitches}
				onClose={() => {
					setIsViewingPitches(false);
					setSelectedNomination(null);
				}}
				nomination={selectedNomination}
			/>
		</SplitLayout>
	);
}
