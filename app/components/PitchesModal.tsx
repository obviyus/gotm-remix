import { useEffect, useMemo, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
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
	userDiscordId?: string | null;
	canManagePitch?: boolean;
}

interface PitchMutationResponse {
	error?: string;
	success?: boolean;
}

export default function PitchesModal({
	isOpen,
	onClose,
	nomination,
	userDiscordId,
	canManagePitch = false,
}: PitchesModalProps) {
	const fetcher = useFetcher<PitchMutationResponse>();
	const revalidator = useRevalidator();
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [draftPitch, setDraftPitch] = useState("");

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	const currentUserPitch = useMemo(() => {
		if (!nomination || !userDiscordId) {
			return null;
		}

		return nomination.pitches.find((pitch) => pitch.discordId === userDiscordId) ?? null;
	}, [nomination, userDiscordId]);

	useEffect(() => {
		if (!isOpen || !nomination) {
			setIsEditorOpen(false);
			setDraftPitch("");
			return;
		}

		setDraftPitch(currentUserPitch?.pitch ?? "");
		setIsEditorOpen(false);
	}, [currentUserPitch, isOpen, nomination]);

	useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data?.success) {
			return;
		}

		revalidator.revalidate();
		onClose();
	}, [fetcher.data?.success, fetcher.state, onClose, revalidator]);

	if (!nomination) {
		return null;
	}

	const isSaveDisabled = draftPitch.trim().length === 0;
	const isSubmitting = fetcher.state !== "idle";

	const handleSavePitch = () => {
		if (isSaveDisabled) {
			return;
		}

		fetcher.submit(
			{
				intent: "savePitch",
				nominationId: nomination.id.toString(),
				pitch: draftPitch.trim(),
			},
			{ action: "/nominate", method: "PATCH" },
		);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-3xl bg-gray-900 border-gray-700 shadow-2xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-xl font-bold text-white">
						Pitches for {nomination?.gameName}
					</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[65vh] pr-2">
					<div className="space-y-4">
						{nomination.pitches.length > 0 ? (
							nomination.pitches.map((pitch) => (
								<div
									key={pitch.id}
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
								<p className="text-sm text-gray-400">No pitches available for this game</p>
							</div>
						)}
					</div>
				</ScrollArea>
				{canManagePitch && (
					<div className="border-t border-gray-800 pt-5">
						{isEditorOpen ? (
							<div className="space-y-3">
								<label htmlFor="pitch-modal-input" className="text-sm font-medium text-gray-200">
									{currentUserPitch ? "Edit your pitch" : "Add your pitch"}
								</label>
								<textarea
									id="pitch-modal-input"
									name="pitch"
									rows={4}
									value={draftPitch}
									onChange={(event) => setDraftPitch(event.target.value)}
									placeholder="Write your pitch here…"
									className="flex min-h-[96px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
								/>
								{fetcher.data?.error && (
									<p className="text-sm text-red-400">{fetcher.data.error}</p>
								)}
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setIsEditorOpen(false);
											setDraftPitch(currentUserPitch?.pitch ?? "");
										}}
										className="border-gray-600 bg-gray-800/50 text-gray-200 hover:text-white hover:bg-gray-700/70 hover:border-gray-500"
									>
										Cancel
									</Button>
									<Button
										type="button"
										onClick={handleSavePitch}
										disabled={isSaveDisabled || isSubmitting}
										className="bg-blue-600 text-white hover:bg-blue-700"
									>
										{isSubmitting
											? currentUserPitch
												? "Saving..."
												: "Adding..."
											: currentUserPitch
												? "Save Changes"
												: "Add Pitch"}
									</Button>
								</div>
							</div>
						) : (
							<div className="flex items-center justify-between gap-3">
								<p className="text-sm text-gray-400">
									{currentUserPitch
										? "Want to tighten your case for this game?"
										: "Have a case for this game?"}
								</p>
								<Button
									type="button"
									onClick={() => setIsEditorOpen(true)}
									className="bg-blue-600 text-white hover:bg-blue-700"
								>
									{currentUserPitch ? "Edit Pitch" : "Add Pitch"}
								</Button>
							</div>
						)}
					</div>
				)}
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
