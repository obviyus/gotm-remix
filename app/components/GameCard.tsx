import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChatBubbleBottomCenterTextIcon,
	LinkIcon,
	PencilSquareIcon,
	TrashIcon,
} from "@heroicons/react/20/solid";
import type { Nomination } from "~/types";

interface GameCardProps {
	game: Nomination;
	variant?: "default" | "nomination" | "search";
	onNominate?: (game: Nomination) => void;
	onEdit?: (game: Nomination) => void;
	onDelete?: (game: Nomination) => void;
	draggableProps?: DraggableProvidedDraggableProps;
	dragHandleProps?: DraggableProvidedDragHandleProps;
	innerRef?: (element?: HTMLElement | null) => void;
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
	showPitchesButton?: boolean;
	buttonText?: string;
	buttonDisabled?: boolean;
	isPreviousWinner?: boolean;
	isWinner?: boolean;
	isJurySelected?: boolean;
}

export default function GameCard({
	game,
	variant = "default",
	onNominate,
	onEdit,
	onDelete,
	draggableProps,
	dragHandleProps,
	innerRef,
	onRank,
	onUnrank,
	isRanked,
	alreadyNominated,
	isCurrentUserNomination,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons = false,
	showPitchesButton = false,
	buttonText,
	buttonDisabled,
	isPreviousWinner = false,
	isWinner = false,
	isJurySelected = false,
}: GameCardProps) {
	const getYear = (game: Nomination) => {
		if (game.gameYear) return game.gameYear;
		return null;
	};

	const coverUrl = game.gameCover?.replace("t_thumb", "t_cover_big");
	const year = getYear(game);

	// Determine status for highlighting and badges
	// Winner takes precedence over jury selected
	const status = isWinner ? "winner" : isJurySelected ? "jury" : "regular";

	return (
		<div
			ref={innerRef}
			{...draggableProps}
			{...dragHandleProps}
			className={`group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl border-1 ${
				status === "winner"
					? "border-amber-500"
					: status === "jury"
						? "border-blue-500"
						: "border-zinc-800/50"
			} hover:border-zinc-700/50 transition-all duration-500 flex h-52 min-w-0`}
		>
			{/* Cover Image */}
			<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
				{coverUrl ? (
					<>
						<div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent z-10" />
						<img
							src={coverUrl}
							alt={game.gameName}
							className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
								status === "winner"
									? "group-hover:brightness-125 filter-none"
									: status === "jury"
										? "group-hover:brightness-110 filter-none"
										: "group-hover:brightness-110"
							}`}
						/>
						{/* Status badge - show only one badge (winner takes priority) */}
						<div className="absolute top-2 left-2 z-20">
							{status === "winner" && (
								<span className="px-2.5 py-1 bg-amber-600 text-amber-100 text-xs font-medium rounded-md border border-amber-400/50">
									Winner
								</span>
							)}
							{status === "jury" && (
								<span className="px-2.5 py-1 bg-blue-600 text-blue-100 text-xs font-medium rounded-md border border-blue-400/50">
									Jury Selected
								</span>
							)}
						</div>
					</>
				) : (
					<div className="h-full w-full bg-zinc-800/50 flex items-center justify-center backdrop-blur-sm relative">
						<span className="text-zinc-500">No cover</span>
						{/* Status badge for images without cover - show only one badge */}
						<div className="absolute top-2 left-2 z-20">
							{status === "winner" && (
								<span className="px-2.5 py-1 bg-amber-600 text-amber-100 text-xs font-medium rounded-md border border-amber-400/50">
									Winner
								</span>
							)}
							{status === "jury" && (
								<span className="px-2.5 py-1 bg-blue-600 text-blue-100 text-xs font-medium rounded-md border border-blue-400/50">
									Jury Selected
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<h3
							className={`text-sm font-medium break-words leading-snug ${
								status === "winner"
									? "text-amber-200 font-semibold"
									: status === "jury"
										? "text-blue-200 font-medium"
										: "text-zinc-100"
							}`}
						>
							{game.gameName}
						</h3>
						{year && (
							<p className="text-xs text-zinc-500 flex-shrink-0 font-medium">
								{year}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-col gap-2 mt-auto min-w-0">
					{showVotingButtons && (
						<div className="flex flex-col w-full gap-2">
							<button
								type="button"
								onClick={isRanked ? onUnrank : onRank}
								className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
									isRanked
										? "text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
								}`}
							>
								<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
									{isRanked ? (
										<>
											<ArrowDownIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
											Remove from Ranking
										</>
									) : (
										<>
											<ArrowUpIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
											Add to Ranking
										</>
									)}
								</span>
							</button>

							{onViewPitches && (
								<button
									type="button"
									onClick={onViewPitches}
									className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-zinc-200 bg-zinc-500/10 hover:bg-zinc-500/20 transition-all duration-300 backdrop-blur-sm border border-zinc-500/20 hover:border-zinc-500/30"
								>
									<ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
									{pitchCount > 0 ? (
										<>
											View {pitchCount} {pitchCount === 1 ? "Pitch" : "Pitches"}
										</>
									) : (
										"No Pitches Yet"
									)}
								</button>
							)}
						</div>
					)}

					{showPitchesButton && onViewPitches && (
						<button
							type="button"
							onClick={onViewPitches}
							className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-zinc-200 bg-zinc-500/10 hover:bg-zinc-500/20 transition-all duration-300 backdrop-blur-sm border border-zinc-500/20 hover:border-zinc-500/30"
						>
							<ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
							{pitchCount > 0 ? (
								<>
									View {pitchCount} {pitchCount === 1 ? "Pitch" : "Pitches"}
								</>
							) : (
								"No Pitches Yet"
							)}
						</button>
					)}

					{onNominate && (
						<button
							type="button"
							onClick={() => onNominate(game)}
							disabled={
								buttonDisabled ||
								(alreadyNominated && isCurrentUserNomination) ||
								isPreviousWinner
							}
							className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
								isPreviousWinner
									? "text-amber-500 shadow-sm shadow-amber-500/20 border border-amber-400/20 hover:bg-amber-500/10 hover:border-amber-400/30 hover:shadow-amber-500/40 after:absolute after:inset-0 after:bg-amber-400/0 hover:after:bg-amber-400/5 after:transition-colors"
									: alreadyNominated && !isCurrentUserNomination
										? "text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors"
										: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
							} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:text-zinc-400 disabled:border-zinc-400/20`}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105 group-disabled:transform-none">
								{buttonText ||
									(alreadyNominated
										? isCurrentUserNomination
											? "Already nominated"
											: "Add Pitch"
										: "Nominate")}
							</span>
						</button>
					)}

					{(onEdit || onDelete || game.gameUrl) && (
						<div
							className={
								variant === "nomination" ? "flex flex-col gap-1.5" : "w-full"
							}
						>
							{game.gameUrl && (
								<a
									href={game.gameUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-purple-500 shadow-sm shadow-purple-500/20 border border-purple-400/20 hover:bg-purple-500/10 hover:border-purple-400/30 hover:shadow-purple-500/40 after:absolute after:inset-0 after:bg-purple-400/0 hover:after:bg-purple-400/5 after:transition-colors w-full"
									title="View on IGDB"
								>
									<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
										<LinkIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
										{variant === "nomination" ? "View on IGDB" : "IGDB"}
									</span>
								</a>
							)}
							{variant === "nomination" && (
								<>
									{onEdit && (
										<button
											type="button"
											onClick={() => onEdit(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors w-full"
											title={
												game.pitches.length > 0 ? "Edit pitch" : "Add pitch"
											}
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<PencilSquareIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
												{game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
											</span>
										</button>
									)}
									{onDelete && (
										<button
											type="button"
											onClick={() => onDelete(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors w-full"
											title="Delete nomination"
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
												Delete
											</span>
										</button>
									)}
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
