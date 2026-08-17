import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import * as stylex from "@stylexjs/stylex";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import TwoColumnLayout, { Column } from "~/components/TwoColumnLayout";
import { authenticatedUserContext, requireAuthenticatedUser } from "~/route-context.server";
import { db } from "~/server/database.server";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsByIds } from "~/server/nomination.server";
import { control } from "~/styles/markers.stylex";
import { color, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination } from "~/types";
import { categoryGameTitle, categoryLabelsFromMonth } from "~/utils/categoryLabels";
import { findNominationById } from "~/utils/nominations";
import { buildOrderFromRankings, resolveVotedStatus } from "~/utils/votingOrder";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/voting";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Vote | ${SITE_NAME}`,
		description: "Rank this month's ballot.",
		path: "/voting",
		noIndex: true,
	});

type VoteActionResponse = {
	success: boolean;
	error?: string;
	voteId?: number;
};

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser];

export async function loader({ context }: Route.LoaderArgs) {
	const { discordId } = context.get(authenticatedUserContext);
	const monthRow = await getCurrentMonth();
	const monthId = monthRow.status === "voting" ? monthRow.id : undefined;

	if (!monthId) {
		return Response.json({ monthId: undefined, labels: categoryLabelsFromMonth(monthRow) });
	}

	const [shortVoteResult, longVoteResult, shortNomIds, longNomIds] = await Promise.all([
		db.execute({
			sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 1`,
			args: [monthId, discordId],
		}),
		db.execute({
			sql: `SELECT id
         FROM votes
         WHERE month_id = ?
           AND discord_id = ?
           AND short = 0`,
			args: [monthId, discordId],
		}),
		db.execute({
			sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 1`,
			args: [monthId],
		}),
		db.execute({
			sql: `SELECT id
         FROM nominations
         WHERE month_id = ?
           AND jury_selected = 1
           AND short = 0`,
			args: [monthId],
		}),
	]);

	// Extract IDs
	const shortNominationIds = shortNomIds.rows.map((row) => Number(row.id));
	const longNominationIds = longNomIds.rows.map((row) => Number(row.id));

	// Fetch nominations in batch (in parallel)
	const [shortNoms, longNoms] = await Promise.all([
		getNominationsByIds(shortNominationIds),
		getNominationsByIds(longNominationIds),
	]);

	// Fetch existing rankings if user has voted
	let shortRankings: Array<{ nomination_id: number; rank: number }> = [];
	let longRankings: Array<{ nomination_id: number; rank: number }> = [];

	// Prepare ranking queries for parallel execution
	const rankingQueries = [];

	if (shortVoteResult.rows[0]) {
		rankingQueries.push(
			db
				.execute({
					sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
					args: [shortVoteResult.rows[0].id],
				})
				.then((shortRankResult) => {
					shortRankings = shortRankResult.rows.map((row) => ({
						nomination_id: row.nomination_id as number,
						rank: row.rank as number,
					}));
				}),
		);
	}

	if (longVoteResult.rows[0]) {
		rankingQueries.push(
			db
				.execute({
					sql: `SELECT nomination_id, rank
             FROM rankings
             WHERE vote_id = ?
             ORDER BY \`rank\``,
					args: [longVoteResult.rows[0].id],
				})
				.then((longRankResult) => {
					longRankings = longRankResult.rows.map((row) => ({
						nomination_id: row.nomination_id as number,
						rank: row.rank as number,
					}));
				}),
		);
	}

	// Execute ranking queries in parallel if any exist
	if (rankingQueries.length > 0) {
		await Promise.all(rankingQueries);
	}

	return {
		monthId,
		userId: discordId,
		shortNominations: shortNoms,
		longNominations: longNoms,
		votedShort: Boolean(shortVoteResult.rows[0]),
		votedLong: Boolean(longVoteResult.rows[0]),
		shortRankings,
		longRankings,
		labels: categoryLabelsFromMonth(monthRow),
	};
}

const styles = stylex.create({
	cardList: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	emptySlot: {
		borderColor: "oklch(87.2% 0.01 258.338)",
		borderRadius: radius.lg,
		borderStyle: "dashed",
		borderWidth: 1,
		padding: 32,
		textAlign: "center",
	},
	emptyText: {
		color: "oklch(55.1% 0.027 264.364)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	divider: {
		borderTopColor: "oklch(44.6% 0.03 256.802 / 0.6)",
		borderTopWidth: 2,
		marginBlock: 32,
		marginInline: "auto",
		maxWidth: "48rem",
		position: "relative",
		width: "100%",
	},
	dividerLabel: {
		backgroundColor: "oklch(21% 0.034 264.665)",
		borderColor: "oklch(44.6% 0.03 256.802 / 0.6)",
		borderRadius: radius.pill,
		borderWidth: 1,
		color: "oklch(92.8% 0.006 264.531)",
		fontSize: "0.875rem",
		fontWeight: 500,
		left: "50%",
		lineHeight: 1.4286,
		paddingBlock: 6,
		paddingInline: 24,
		position: "absolute",
		top: "50%",
		translate: "-50% -50%",
		userSelect: "none",
	},
	clearVote: {
		alignItems: "center",
		backgroundColor: { default: null, ":hover": "oklch(63.7% 0.237 25.331 / 0.1)" },
		borderColor: {
			default: "oklch(70.4% 0.191 22.216 / 0.2)",
			":hover": "oklch(70.4% 0.191 22.216 / 0.3)",
		},
		borderRadius: radius.lg,
		borderWidth: 1,
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(63.7% 0.237 25.331 / 0.2), 0 1px 2px -1px oklch(63.7% 0.237 25.331 / 0.2)",
			":hover":
				"0 1px 3px 0 oklch(63.7% 0.237 25.331 / 0.4), 0 1px 2px -1px oklch(63.7% 0.237 25.331 / 0.4)",
		},
		color: color.deny,
		display: "inline-flex",
		fontSize: "0.875rem",
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		lineHeight: 1.4286,
		overflow: "hidden",
		paddingBlock: 8,
		paddingInline: 16,
		position: "relative",
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: "100%",
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(70.4% 0.191 22.216 / 0.05)" },
			content: "''",
			inset: 0,
			position: "absolute",
			transitionDuration: motion.duration,
			transitionProperty: "color, background-color, border-color",
			transitionTimingFunction: motion.easing,
		},
	},
	clearLabel: {
		alignItems: "center",
		display: "flex",
		gap: 8,
		justifyContent: "center",
		position: "relative",
		transform: { default: null, [stylex.when.ancestor(":hover", control)]: "scale(1.05)" },
		transitionDuration: motion.duration,
		transitionProperty: "transform, translate, scale, rotate",
		transitionTimingFunction: motion.easing,
		zIndex: 10,
	},
	clearIcon: {
		height: 16,
		transitionDuration: motion.duration,
		transitionProperty: "transform, translate, scale, rotate",
		transitionTimingFunction: motion.easing,
		translate: { default: null, [stylex.when.ancestor(":hover", control)]: "2px -2px" },
		width: 16,
	},
});

interface VotingGamesListProps {
	droppableId: "long" | "short";
	games: Nomination[];
	order: string[];
	onViewPitches: (nomination: Nomination) => void;
	onRank: (itemId: string) => void;
	onUnrank: (itemId: string) => void;
}

function VotingGamesList({
	droppableId,
	games,
	order,
	onViewPitches,
	onRank,
	onUnrank,
}: VotingGamesListProps) {
	const dividerIndex = order.indexOf("divider");

	const rankedGames = games
		.filter((game) => dividerIndex > -1 && order.slice(0, dividerIndex).includes(String(game.id)))
		.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));

	const unrankedGames = games
		.filter(
			(game) =>
				dividerIndex === -1 ||
				order.slice(dividerIndex + 1).includes(String(game.id)) ||
				!order.includes(String(game.id)),
		)
		.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));

	return (
		<Droppable droppableId={droppableId}>
			{(provided) => (
				<div {...provided.droppableProps} ref={provided.innerRef}>
					<div {...stylex.props(styles.cardList)}>
						{rankedGames.length === 0 && order.length === 0 ? (
							<div {...stylex.props(styles.emptySlot)}>
								<p {...stylex.props(styles.emptyText)}>
									Drag games here to rank them in order of preference
								</p>
							</div>
						) : (
							rankedGames.map((game, index) => (
								<Draggable key={game.id} draggableId={String(game.id)} index={index}>
									{(draggableProvided) => (
										<GameCard
											game={game}
											draggableProps={draggableProvided.draggableProps}
											dragHandleProps={draggableProvided.dragHandleProps ?? undefined}
											innerRef={draggableProvided.innerRef}
											isRanked={true}
											onUnrank={() => onUnrank(String(game.id))}
											onViewPitches={() => onViewPitches(game)}
											pitchCount={game.pitches?.length || 0}
											showVotingButtons={true}
										/>
									)}
								</Draggable>
							))
						)}
					</div>

					<Draggable draggableId="divider" index={rankedGames.length} isDragDisabled>
						{(draggableProvided) => (
							<div
								ref={draggableProvided.innerRef}
								{...stylex.props(styles.divider)}
								{...draggableProvided.draggableProps}
								{...draggableProvided.dragHandleProps}
							>
								<span {...stylex.props(styles.dividerLabel)}>Drag above to rank</span>
							</div>
						)}
					</Draggable>

					<div {...stylex.props(styles.cardList)}>
						{unrankedGames.length === 0 ? (
							<div {...stylex.props(styles.emptySlot)}>
								<p {...stylex.props(styles.emptyText)}>No unranked games</p>
							</div>
						) : (
							unrankedGames.map((game, index) => (
								<Draggable
									key={game.id}
									draggableId={String(game.id)}
									index={rankedGames.length + 1 + index}
								>
									{(draggableProvided) => (
										<GameCard
											game={game}
											draggableProps={draggableProvided.draggableProps}
											dragHandleProps={draggableProvided.dragHandleProps ?? undefined}
											innerRef={draggableProvided.innerRef}
											isRanked={false}
											onRank={() => onRank(String(game.id))}
											onViewPitches={() => onViewPitches(game)}
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
}

export default function Voting({ loaderData }: Route.ComponentProps) {
	const {
		userId,
		shortNominations,
		longNominations,
		votedShort: loaderVotedShort,
		votedLong: loaderVotedLong,
		shortRankings,
		longRankings,
		labels,
	} = loaderData;

	const voteFetcher = useFetcher<VoteActionResponse>();
	const loaderOrder = useMemo(
		() => ({
			0: buildOrderFromRankings(longNominations, longRankings),
			1: buildOrderFromRankings(shortNominations, shortRankings),
		}),
		[longNominations, longRankings, shortNominations, shortRankings],
	);
	const [currentOrder, setCurrentOrder] = useState(loaderOrder);

	useEffect(() => {
		if (voteFetcher.state === "idle") {
			setCurrentOrder(loaderOrder);
		}
	}, [voteFetcher.state, loaderOrder]);

	const votedLong = resolveVotedStatus(Boolean(loaderVotedLong), false, voteFetcher);
	const votedShort = resolveVotedStatus(Boolean(loaderVotedShort), true, voteFetcher);
	const [selectedNominationId, setSelectedNominationId] = useState<number | null>(null);
	const selectedNomination = findNominationById(
		selectedNominationId,
		longNominations,
		shortNominations,
	);
	const handleOpenPitches = (nomination: Nomination) => {
		setSelectedNominationId(nomination.id);
	};
	const closePitchesModal = () => {
		setSelectedNominationId(null);
	};

	const deleteVote = (short: boolean) => {
		void voteFetcher.submit(
			{ short },
			{ method: "DELETE", action: "/api/votes", encType: "application/json" },
		);

		const shortKey = short ? 1 : 0;
		const games = short ? shortNominations : longNominations;

		setCurrentOrder((prev) => ({
			...prev,
			[shortKey]: ["divider", ...(games ?? []).map((n) => String(n.id))],
		}));
	};

	const saveVote = (short: boolean, order: string[]) => {
		const validOrder = order
			.filter((id) => id && id !== "divider")
			.map((id) => Number.parseInt(id, 10));

		if (validOrder.length === 0) {
			deleteVote(short);
			return;
		}

		void voteFetcher.submit(
			{ short, order: validOrder },
			{
				method: "POST",
				action: "/api/votes",
				encType: "application/json",
			},
		);
	};

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return;

		const isShort = result.source.droppableId === "short";
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		const [reorderedItem] = items.splice(result.source.index, 1);
		items.splice(result.destination.index, 0, reorderedItem);

		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));

		const newDividerIndex = items.indexOf("divider");
		const rankedItems = items.slice(0, newDividerIndex);

		if (rankedItems.length > 0) {
			saveVote(isShort, rankedItems);
		} else {
			deleteVote(isShort);
		}
	};

	const moveItemAboveDivider = (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		const newDividerIndex = items.indexOf("divider");
		items.splice(newDividerIndex, 0, itemId);

		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, items.indexOf("divider"));
		if (rankedItems.length > 0) {
			saveVote(isShort, rankedItems);
		}
	};

	const moveItemBelowDivider = (isShort: boolean, itemId: string) => {
		const shortKey = isShort ? 1 : 0;
		const items = Array.from(currentOrder[shortKey]);

		const currentIndex = items.indexOf(itemId);
		if (currentIndex === -1) return;
		items.splice(currentIndex, 1);

		const dividerIndex = items.indexOf("divider");
		items.splice(dividerIndex + 1, 0, itemId);

		setCurrentOrder((prevOrder) => ({ ...prevOrder, [shortKey]: items }));
		const rankedItems = items.slice(0, dividerIndex);
		if (rankedItems.length > 0) {
			saveVote(isShort, rankedItems);
		} else {
			deleteVote(isShort);
		}
	};

	const statusBadges = {
		long: {
			text: votedLong ? "Voted" : "Not Voted",
			isSuccess: votedLong,
		},
		short: {
			text: votedShort ? "Voted" : "Not Voted",
			isSuccess: votedShort,
		},
	};

	const handleClearLongVote = () => {
		deleteVote(false);
	};

	const handleClearShortVote = () => {
		deleteVote(true);
	};

	const longAction = votedLong ? (
		<button
			type="button"
			onClick={handleClearLongVote}
			{...stylex.props(control, styles.clearVote)}
		>
			<span {...stylex.props(styles.clearLabel)}>
				<Trash2 {...stylex.props(styles.clearIcon)} />
				Clear Vote
			</span>
		</button>
	) : null;

	const shortAction = votedShort ? (
		<button
			type="button"
			onClick={handleClearShortVote}
			{...stylex.props(control, styles.clearVote)}
		>
			<span {...stylex.props(styles.clearLabel)}>
				<Trash2 {...stylex.props(styles.clearIcon)} />
				Clear Vote
			</span>
		</button>
	) : null;

	return (
		<TwoColumnLayout
			title="Drag and Drop the games"
			subtitle="to sort them in the priority you want them to win"
			description="Please only vote for games you actually want to play next month :)"
		>
			<Column
				title={categoryGameTitle(labels.long)}
				statusBadge={statusBadges.long}
				action={longAction}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					<VotingGamesList
						droppableId="long"
						games={longNominations}
						order={currentOrder[0]}
						onViewPitches={handleOpenPitches}
						onRank={(itemId) => {
							moveItemAboveDivider(false, itemId);
						}}
						onUnrank={(itemId) => {
							moveItemBelowDivider(false, itemId);
						}}
					/>
				</DragDropContext>
			</Column>

			<Column
				title={categoryGameTitle(labels.short)}
				statusBadge={statusBadges.short}
				action={shortAction}
			>
				<DragDropContext onDragEnd={onDragEnd}>
					<VotingGamesList
						droppableId="short"
						games={shortNominations}
						order={currentOrder[1]}
						onViewPitches={handleOpenPitches}
						onRank={(itemId) => {
							moveItemAboveDivider(true, itemId);
						}}
						onUnrank={(itemId) => {
							moveItemBelowDivider(true, itemId);
						}}
					/>
				</DragDropContext>
			</Column>

			<PitchesModal
				isOpen={selectedNomination !== null}
				onClose={closePitchesModal}
				nomination={selectedNomination}
				userDiscordId={userId}
			/>
		</TwoColumnLayout>
	);
}
