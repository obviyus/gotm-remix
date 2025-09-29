import React from "react";
import type {
	DraggableProvidedDraggableProps,
	DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/utils";
import type { Nomination } from "~/types";
import { GameCardActions } from "./GameCardActions";
import { GameCardImage } from "./GameCardImage";

const extractGameYear = (nomination: Nomination) => {
	if (nomination.gameYear) {
		return nomination.gameYear;
	}

	return null;
};

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

const cardVariants = cva(
	"group relative bg-zinc-900/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/20 rounded-xl border-1 hover:border-zinc-700/50 transition-colors duration-200 will-change-transform flex h-52 min-w-0",
	{
		variants: {
			status: {
				winner: "border-amber-500",
				jury: "border-blue-500",
				regular: "border-zinc-800/50",
			},
		},
		defaultVariants: {
			status: "regular",
		},
	},
);

const titleVariants = cva("text-sm font-medium break-words leading-snug", {
	variants: {
		status: {
			winner: "text-amber-200 font-semibold",
			jury: "text-blue-200 font-medium",
			regular: "text-zinc-100",
		},
	},
	defaultVariants: {
		status: "regular",
	},
});

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
	const coverUrl = game.gameCover?.replace("t_thumb", "t_cover_big");
	const year = extractGameYear(game);

	// Determine status for highlighting and badges
	// Winner takes precedence over jury selected
	const status = isWinner ? "winner" : isJurySelected ? "jury" : "regular";

	return (
		<div
			ref={innerRef}
			{...draggableProps}
			{...dragHandleProps}
			className={cn(cardVariants({ status }))}
		>
			<GameCardImage
				coverUrl={coverUrl ?? null}
				gameName={game.gameName}
				status={status}
			/>

			<div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-w-0">
				<div className="min-w-0 space-y-2">
					<div className="flex justify-between items-start gap-2">
						<h3 className={cn(titleVariants({ status }))}>{game.gameName}</h3>
						{year && (
							<p className="text-xs text-zinc-500 flex-shrink-0 font-medium">
								{year}
							</p>
						)}
					</div>
				</div>

				<GameCardActions
					game={game}
					variant={variant}
					onRank={onRank}
					onUnrank={onUnrank}
					isRanked={isRanked}
					onViewPitches={onViewPitches}
					pitchCount={pitchCount}
					showVotingButtons={showVotingButtons}
					showPitchesButton={showPitchesButton}
					onNominate={onNominate}
					alreadyNominated={alreadyNominated}
					isCurrentUserNomination={isCurrentUserNomination}
					buttonText={buttonText}
					buttonDisabled={buttonDisabled}
					isPreviousWinner={isPreviousWinner}
					onEdit={onEdit}
					onDelete={onDelete}
				/>
			</div>
		</div>
	);
}
