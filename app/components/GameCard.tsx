import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
	ChatBubbleBottomCenterTextIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	PencilSquareIcon,
	TrashIcon,
	LinkIcon,
} from "@heroicons/react/20/solid";
import type { Game } from "~/types";

interface GameCardProps {
	game: Game;
	variant?: "default" | "nomination" | "search";
	onNominate?: (game: Game) => void;
	onEdit?: (game: Game) => void;
	onDelete?: (game: Game) => void;
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
	buttonText?: string;
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
	buttonText,
}: GameCardProps) {
	const getCoverUrl = (cover: Game["cover"]) => {
		if (!cover) return null;
		if (typeof cover === "string") return cover;
		return cover.url.replace("t_thumb", "t_cover_big");
	};

	const getYear = (game: Game) => {
		if (game.game_year) return game.game_year;
		if (game.first_release_date)
			return new Date(game.first_release_date * 1000).getFullYear().toString();
		return null;
	};

	const coverUrl = getCoverUrl(game.cover);
	const year = getYear(game);

	return (
		<div
			ref={innerRef}
			{...draggableProps}
			{...dragHandleProps}
			className="group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl shadow-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-500 flex h-52 min-w-0 hover:shadow-xl hover:shadow-zinc-900/30"
		>
			{/* Cover Image */}
			<div className="w-[9.75rem] flex-shrink-0 overflow-hidden rounded-l-xl relative">
				{coverUrl ? (
					<>
						<div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent z-10" />
						<img
							src={coverUrl}
							alt={game.name}
							className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110"
						/>
					</>
				) : (
					<div className="h-full w-full bg-zinc-800/50 flex items-center justify-center backdrop-blur-sm">
						<span className="text-zinc-500">No cover</span>
					</div>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<h3 className="text-sm font-medium text-zinc-100 break-words bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent leading-snug">
							{game.name}
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

					{onNominate && (
						<button
							type="button"
							onClick={() => onNominate(game)}
							disabled={alreadyNominated && isCurrentUserNomination}
							className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${
								alreadyNominated && !isCurrentUserNomination
									? "text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors"
									: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
							} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:text-zinc-400 disabled:border-zinc-400/20`}
						>
							<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105 group-disabled:transform-none">
								{alreadyNominated
									? isCurrentUserNomination
										? "Already nominated"
										: buttonText || "Add Pitch"
									: buttonText || "Nominate"}
							</span>
						</button>
					)}

					{(onEdit || onDelete || game.game_url) && (
						<div
							className={
								variant === "nomination" ? "grid grid-cols-3 gap-1.5" : "w-full"
							}
						>
							{game.game_url && (
								<a
									href={game.game_url}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-purple-500 shadow-sm shadow-purple-500/20 border border-purple-400/20 hover:bg-purple-500/10 hover:border-purple-400/30 hover:shadow-purple-500/40 after:absolute after:inset-0 after:bg-purple-400/0 hover:after:bg-purple-400/5 after:transition-colors w-full"
									title="View on IGDB"
								>
									<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
										<LinkIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
										{variant === "nomination" ? "" : "IGDB"}
									</span>
								</a>
							)}
							{variant === "nomination" && (
								<>
									{onEdit && (
										<button
											type="button"
											onClick={() => onEdit(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors"
											title={game.pitch ? "Edit pitch" : "Add pitch"}
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<PencilSquareIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
											</span>
										</button>
									)}
									{onDelete && (
										<button
											type="button"
											onClick={() => onDelete(game)}
											className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
											title="Delete nomination"
										>
											<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
												<TrashIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
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
