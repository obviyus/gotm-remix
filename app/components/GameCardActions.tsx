import React from "react";
import {
	ArrowDown,
	ArrowUp,
	Edit,
	ExternalLink,
	MessageCircle,
	Trash2,
} from "lucide-react";
import type { Nomination } from "~/types";

interface GameCardActionsProps {
	game: Nomination;
	variant: "default" | "nomination" | "search";
	onRank?: () => void;
	onUnrank?: () => void;
	isRanked?: boolean;
	onViewPitches?: () => void;
	pitchCount?: number;
	showVotingButtons?: boolean;
	showPitchesButton?: boolean;
	onNominate?: (game: Nomination) => void;
	alreadyNominated?: boolean;
	isCurrentUserNomination?: boolean;
	buttonText?: string;
	buttonDisabled?: boolean;
	isPreviousWinner?: boolean;
	onEdit?: (game: Nomination) => void;
	onDelete?: (game: Nomination) => void;
}

export function GameCardActions({
	game,
	variant,
	onRank,
	onUnrank,
	isRanked,
	onViewPitches,
	pitchCount = 0,
	showVotingButtons,
	showPitchesButton,
	onNominate,
	alreadyNominated,
	isCurrentUserNomination,
	buttonText,
	buttonDisabled,
	isPreviousWinner,
	onEdit,
	onDelete,
}: GameCardActionsProps) {
	const handleNominateClick = React.useCallback(() => {
		if (onNominate) {
			onNominate(game);
		}
	}, [onNominate, game]);

	const handleEditClick = React.useCallback(() => {
		if (onEdit) {
			onEdit(game);
		}
	}, [onEdit, game]);

	const handleDeleteClick = React.useCallback(() => {
		if (onDelete) {
			onDelete(game);
		}
	}, [onDelete, game]);

	return (
		<div className="flex flex-col gap-2 mt-auto min-w-0">
			{showVotingButtons && (
				<div className="flex flex-col w-full gap-2">
					<button
						type="button"
						onClick={isRanked ? onUnrank : onRank}
						className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${isRanked
							? "text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors"
							: "text-emerald-500 shadow-sm shadow-emerald-500/20 border border-emerald-400/20 hover:bg-emerald-500/10 hover:border-emerald-400/30 hover:shadow-emerald-500/40 after:absolute after:inset-0 after:bg-emerald-400/0 hover:after:bg-emerald-400/5 after:transition-colors"
							}`}
					>
						<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
							{isRanked ? (
								<>
									<ArrowDown className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
									Remove from Ranking
								</>
							) : (
								<>
									<ArrowUp className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
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
							<MessageCircle className="w-4 h-4" />
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
					<MessageCircle className="w-4 h-4" />
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
					onClick={handleNominateClick}
					disabled={
						buttonDisabled ||
						(alreadyNominated && isCurrentUserNomination) ||
						isPreviousWinner
					}
					className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden ${isPreviousWinner
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
								<ExternalLink className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
								{variant === "nomination" ? "View on IGDB" : "IGDB"}
							</span>
						</a>
					)}
					{variant === "nomination" && (
						<>
							{onEdit && (
								<button
									type="button"
									onClick={handleEditClick}
									className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-blue-500 shadow-sm shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500/10 hover:border-blue-400/30 hover:shadow-blue-500/40 after:absolute after:inset-0 after:bg-blue-400/0 hover:after:bg-blue-400/5 after:transition-colors w-full"
									title={game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
								>
									<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
										<Edit className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
										{game.pitches.length > 0 ? "Edit pitch" : "Add pitch"}
									</span>
								</button>
							)}
							{onDelete && (
								<button
									type="button"
									onClick={handleDeleteClick}
									className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden text-red-500 shadow-sm shadow-red-500/20 border border-red-400/20 hover:bg-red-500/10 hover:border-red-400/30 hover:shadow-red-500/40 after:absolute after:inset-0 after:bg-red-400/0 hover:after:bg-red-400/5 after:transition-colors w-full"
									title="Delete nomination"
								>
									<span className="relative z-10 flex items-center justify-center gap-2 transition-transform group-hover/btn:scale-105">
										<Trash2 className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
										Delete
									</span>
								</button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

export type { GameCardActionsProps };
