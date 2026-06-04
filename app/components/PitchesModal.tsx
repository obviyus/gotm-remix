import { useState } from "react";
import { useRevalidator } from "react-router";
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

async function savePitch(nominationId: number, pitch: string): Promise<PitchMutationResponse> {
	const formData = new FormData();
	formData.set("intent", "savePitch");
	formData.set("nominationId", nominationId.toString());
	formData.set("pitch", pitch);

	const response = await fetch("/nominate", { method: "PATCH", body: formData });
	return (await response.json()) as PitchMutationResponse;
}

export default function PitchesModal({
	isOpen,
	onClose,
	nomination,
	userDiscordId,
	canManagePitch = false,
}: PitchesModalProps) {
	if (!isOpen || !nomination) {
		return null;
	}

	return (
		<OpenPitchesModal
			key={nomination.id}
			onClose={onClose}
			nomination={nomination}
			userDiscordId={userDiscordId}
			canManagePitch={canManagePitch}
		/>
	);
}

interface OpenPitchesModalProps {
	onClose: () => void;
	nomination: Nomination;
	userDiscordId?: string | null;
	canManagePitch: boolean;
}

function OpenPitchesModal({
	onClose,
	nomination,
	userDiscordId,
	canManagePitch,
}: OpenPitchesModalProps) {
	const revalidator = useRevalidator();
	const currentUserPitch =
		nomination.pitches.find((pitch) => pitch.discordId === userDiscordId) ?? null;
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [draftPitch, setDraftPitch] = useState(currentUserPitch?.pitch ?? "");
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	const isSaveDisabled = draftPitch.trim().length === 0;

	const handleSavePitch = async () => {
		if (isSaveDisabled) {
			return;
		}

		setIsSubmitting(true);
		setSaveError(null);
		const result = await savePitch(nomination.id, draftPitch.trim());

		if (result.error) {
			setSaveError(result.error);
			setIsSubmitting(false);
			return;
		}

		setIsEditorOpen(false);
		await revalidator.revalidate();
		setIsSubmitting(false);
	};

	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-3xl bg-gray-900 border-gray-700 shadow-2xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-xl font-bold text-white">
						Pitches for {nomination.gameName}
					</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[65vh] pr-2">
					<div className="space-y-4">
						{nomination.pitches.length > 0 ? (
							nomination.pitches.map((pitch) => {
								const isCurrentUserPitch = pitch.discordId === userDiscordId;

								return (
									<div
										key={pitch.id}
										className={`rounded-xl border p-5 transition-all duration-200 backdrop-blur-sm ${
											isCurrentUserPitch
												? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-950/40"
												: "border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/60 hover:border-gray-600/70"
										}`}
									>
										<div className="mb-3 flex items-center gap-2">
											{isCurrentUserPitch && (
												<span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
													Your pitch
												</span>
											)}
											<Badge
												variant="default"
												className={`font-medium px-3 py-1 text-xs text-white ${
													isCurrentUserPitch
														? "bg-emerald-600 hover:bg-emerald-600"
														: "bg-blue-600 hover:bg-blue-600"
												}`}
											>
												{pitch.generatedName}
											</Badge>
										</div>
										<div
											className={`whitespace-pre-wrap text-sm leading-relaxed ${
												isCurrentUserPitch ? "text-emerald-50" : "text-gray-200"
											}`}
										>
											{pitch.pitch}
										</div>
									</div>
								);
							})
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
									placeholder="Why is this game worth playing? What makes it a good fit for the month's theme?"
									className="flex min-h-[96px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
								/>
								{saveError && <p className="text-sm text-red-400">{saveError}</p>}
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
						) : null}
					</div>
				)}
				<DialogFooter className="pt-6 sm:justify-between">
					<div className="flex w-full items-center justify-between gap-3">
						<div>
							{canManagePitch && !isEditorOpen && (
								<Button
									type="button"
									onClick={() => setIsEditorOpen(true)}
									className="bg-blue-600 text-white hover:bg-blue-700"
								>
									{currentUserPitch ? "Edit Pitch" : "Add Pitch"}
								</Button>
							)}
						</div>
						<Button
							variant="outline"
							onClick={onClose}
							className="border-gray-600 bg-gray-800/50 text-gray-200 hover:text-white hover:bg-gray-700/70 hover:border-gray-500 transition-all duration-200 px-6"
						>
							Close
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
