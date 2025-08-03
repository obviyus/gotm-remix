import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { Nomination } from "~/types";

interface PitchesModalProps {
	isOpen: boolean;
	onClose: () => void;
	nomination: Nomination | null;
}

export default function PitchesModal({
	isOpen,
	onClose,
	nomination,
}: PitchesModalProps) {
	if (!nomination) {
		return null;
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-3xl bg-gray-900 border-gray-700 shadow-2xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-xl font-bold text-white">
						Pitches for {nomination?.gameName}
					</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[65vh] pr-2">
					<div className="space-y-4">
						{nomination.pitches.length > 0 ? (
							nomination.pitches.map((pitch, index) => (
								<div
									key={`${nomination?.id}-${pitch.discordId}-${index}`}
									className="rounded-xl border border-gray-700/50 p-5 bg-gray-800/30 hover:bg-gray-800/60 hover:border-gray-600/70 transition-all duration-200 backdrop-blur-sm"
								>
									<div className="flex items-center mb-3">
										<Badge
											variant="default"
											className="bg-blue-600 hover:bg-blue-600 text-white font-medium px-3 py-1 text-xs"
										>
											{pitch.generatedName}
										</Badge>
									</div>
									<div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
										{pitch.pitch}
									</div>
								</div>
							))
						) : (
							<div className="rounded-xl border border-dashed border-gray-700/50 p-8 text-center bg-gray-800/20">
								<p className="text-sm text-gray-400">
									No pitches available for this game
								</p>
							</div>
						)}
					</div>
				</ScrollArea>
				<DialogFooter className="pt-6">
					<Button
						variant="outline"
						onClick={onClose}
						className="border-gray-600 bg-gray-800/50 text-gray-200 hover:text-white hover:bg-gray-700/70 hover:border-gray-500 transition-all duration-200 px-6"
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
