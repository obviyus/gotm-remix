import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Nomination } from "~/types";
import { uniqueNameGenerator } from "~/utils/nameGenerator";

interface PitchesModalProps {
	isOpen: boolean;
	onClose: () => void;
	nomination: Nomination | null;
	pitches: Array<{ discord_id: string; pitch: string }>;
}

export default function PitchesModal({
	isOpen,
	onClose,
	nomination,
	pitches = [],
}: PitchesModalProps) {
	return (
		<Dialog open={isOpen} onClose={onClose} className="relative z-50">
			<div
				className="fixed inset-0 bg-black/30 backdrop-blur-sm"
				aria-hidden="true"
			/>
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="mx-auto max-w-2xl w-full rounded-xl bg-gray-900 p-6 shadow-xl ring-1 ring-white/10">
					<DialogTitle className="text-lg font-medium text-gray-100 mb-4">
						Pitches for {nomination?.title}
					</DialogTitle>
					<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
						{pitches.length > 0 ? (
							pitches.map((pitch, index) => (
								<div
									key={`${nomination?.id}-${pitch.discord_id}-${index}`}
									className="rounded-lg border border-gray-700 p-4 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-colors"
								>
									<div className="flex items-center mb-2">
										<div className="text-sm bg-blue-600 px-2 py-0.5 rounded-full">
											{uniqueNameGenerator(pitch.discord_id)}
										</div>
									</div>
									<div className="whitespace-pre-wrap text-sm">
										{pitch.pitch}
									</div>
								</div>
							))
						) : (
							<div className="rounded-lg border border-dashed border-gray-700 p-8 text-center">
								<p className="text-sm text-gray-400">
									No pitches available for this game
								</p>
							</div>
						)}
					</div>
					<div className="mt-6 flex justify-end gap-3">
						<button
							type="button"
							className="px-4 py-2 text-sm font-medium rounded-lg text-gray-300 transition-colors hover:text-gray-100 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
							onClick={onClose}
						>
							Close
						</button>
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
}
