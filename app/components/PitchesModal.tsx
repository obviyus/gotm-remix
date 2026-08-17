import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
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
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Nomination, Pitch } from "~/types";

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

const styles = stylex.create({
	popup: {
		backgroundColor: "oklch(21% 0.034 264.665)",
		borderColor: "oklch(37.3% 0.034 259.733)",
		boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
		maxWidth: { default: "48rem", [media.sm]: "32rem" },
	},
	header: {
		paddingBottom: 16,
	},
	title: {
		color: color.white,
		fontSize: "1.25rem",
		fontWeight: 700,
	},
	scroller: {
		maxHeight: "65vh",
		paddingRight: 8,
	},
	pitchList: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	pitch: {
		backdropFilter: "blur(8px)",
		borderRadius: radius.xl,
		borderWidth: 1,
		padding: 20,
		transitionDuration: "0.2s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
	},
	ownPitch: {
		backgroundColor: "oklch(69.6% 0.17 162.48 / 0.1)",
		borderColor: "oklch(69.6% 0.17 162.48 / 0.5)",
		boxShadow:
			"0 10px 15px -3px oklch(26.2% 0.051 172.552 / 0.4), 0 4px 6px -4px oklch(26.2% 0.051 172.552 / 0.4)",
	},
	otherPitch: {
		backgroundColor: {
			default: "oklch(27.8% 0.033 256.848 / 0.3)",
			":hover": "oklch(27.8% 0.033 256.848 / 0.6)",
		},
		borderColor: {
			default: "oklch(37.3% 0.034 259.733 / 0.5)",
			":hover": "oklch(44.6% 0.03 256.802 / 0.7)",
		},
	},
	byline: {
		alignItems: "center",
		display: "flex",
		gap: 8,
		marginBottom: 12,
	},
	ownMark: {
		backgroundColor: "oklch(69.6% 0.17 162.48 / 0.15)",
		borderColor: "oklch(76.5% 0.177 163.223 / 0.3)",
		borderRadius: radius.pill,
		borderWidth: 1,
		color: "oklch(90.5% 0.093 164.15)",
		fontSize: "0.75rem",
		fontWeight: 600,
		letterSpacing: "0.025em",
		lineHeight: 1.3333,
		paddingBlock: 4,
		paddingInline: 10,
		textTransform: "uppercase",
	},
	authorBadge: {
		color: color.white,
		fontSize: "0.75rem",
		fontWeight: 500,
		paddingBlock: 4,
		paddingInline: 12,
	},
	ownAuthor: {
		backgroundColor: "oklch(59.6% 0.145 163.225)",
	},
	otherAuthor: {
		backgroundColor: color.action,
	},
	pitchBody: {
		fontSize: "0.875rem",
		lineHeight: 1.625,
		whiteSpace: "pre-wrap",
	},
	ownBody: { color: "oklch(97.9% 0.021 166.113)" },
	otherBody: { color: "oklch(92.8% 0.006 264.531)" },
	empty: {
		backgroundColor: "oklch(27.8% 0.033 256.848 / 0.2)",
		borderColor: "oklch(37.3% 0.034 259.733 / 0.5)",
		borderRadius: radius.xl,
		borderStyle: "dashed",
		borderWidth: 1,
		padding: 32,
		textAlign: "center",
	},
	emptyText: {
		color: "oklch(70.7% 0.022 261.325)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	editorPane: {
		borderTopColor: "oklch(27.8% 0.033 256.848)",
		borderTopWidth: 1,
		paddingTop: 20,
	},
	form: {
		display: "flex",
		flexDirection: "column",
		gap: 12,
	},
	fieldLabel: {
		color: "oklch(92.8% 0.006 264.531)",
		fontSize: "0.875rem",
		fontWeight: 500,
		lineHeight: 1.4286,
	},
	draft: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.md,
		borderWidth: 1,
		color: color.body,
		display: "flex",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		minHeight: 96,
		paddingBlock: 8,
		paddingInline: 12,
		width: "100%",
		"::placeholder": { color: color.muted },
		boxShadow: { default: null, ":focus-visible": "0 0 0 2px oklch(62.3% 0.214 259.815)" },
		opacity: { default: null, ":disabled": 0.6 },
		outlineStyle: { default: null, ":focus-visible": "none" },
	},
	saveError: {
		color: "oklch(70.4% 0.191 22.216)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	formActions: {
		display: "flex",
		gap: 8,
		justifyContent: "flex-end",
	},
	footer: {
		paddingTop: 24,
		justifyContent: { default: null, [media.sm]: "space-between" },
	},
	footerRow: {
		alignItems: "center",
		display: "flex",
		gap: 12,
		justifyContent: "space-between",
		width: "100%",
	},
	quietButton: {
		backgroundColor: {
			default: "oklch(27.8% 0.033 256.848 / 0.5)",
			":hover": "oklch(37.3% 0.034 259.733 / 0.7)",
		},
		borderColor: {
			default: "oklch(44.6% 0.03 256.802)",
			":hover": "oklch(55.1% 0.027 264.364)",
		},
		color: { default: "oklch(92.8% 0.006 264.531)", ":hover": color.white },
	},
	closeButton: {
		paddingInline: 24,
		transitionDuration: "0.2s",
	},
	primaryButton: {
		backgroundColor: { default: color.action, ":hover": color.actionHover },
		color: color.white,
	},
});

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

function upsertCurrentUserPitch(
	pitches: Pitch[],
	nominationId: number,
	discordId: string,
	pitchText: string,
): Pitch[] {
	const existingIndex = pitches.findIndex((pitch) => pitch.discordId === discordId);
	if (existingIndex >= 0) {
		return pitches.map((pitch, index) =>
			index === existingIndex ? { ...pitch, pitch: pitchText } : pitch,
		);
	}

	return [
		...pitches,
		{
			id: -1,
			nominationId,
			discordId,
			pitch: pitchText,
			generatedName: "You",
		},
	];
}

function OpenPitchesModal({
	onClose,
	nomination,
	userDiscordId,
	canManagePitch,
}: OpenPitchesModalProps) {
	const fetcher = useFetcher<PitchMutationResponse>();
	const pendingPitch =
		fetcher.formData?.get("intent") === "savePitch"
			? String(fetcher.formData.get("pitch") ?? "")
			: null;
	const pitches =
		pendingPitch && userDiscordId
			? upsertCurrentUserPitch(nomination.pitches, nomination.id, userDiscordId, pendingPitch)
			: nomination.pitches;
	const serverUserPitch =
		nomination.pitches.find((pitch) => pitch.discordId === userDiscordId) ?? null;
	const currentUserPitch = pitches.find((pitch) => pitch.discordId === userDiscordId) ?? null;
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [draftPitch, setDraftPitch] = useState(serverUserPitch?.pitch ?? "");

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	const isSubmitting = fetcher.state !== "idle";
	const isSaveDisabled = draftPitch.trim().length === 0;
	const saveError = fetcher.data?.error ?? null;

	useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data?.success) {
			return;
		}
		setIsEditorOpen(false);
	}, [fetcher.state, fetcher.data]);

	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent style={styles.popup}>
				<DialogHeader style={styles.header}>
					<DialogTitle style={styles.title}>Pitches for {nomination.gameName}</DialogTitle>
				</DialogHeader>
				<ScrollArea style={styles.scroller}>
					<div {...stylex.props(styles.pitchList)}>
						{pitches.length > 0 ? (
							pitches.map((pitch) => {
								const isCurrentUserPitch = pitch.discordId === userDiscordId;

								return (
									<div
										key={pitch.id === -1 ? `pending-${pitch.discordId}` : pitch.id}
										{...stylex.props(
											styles.pitch,
											isCurrentUserPitch ? styles.ownPitch : styles.otherPitch,
										)}
									>
										<div {...stylex.props(styles.byline)}>
											{isCurrentUserPitch && (
												<span {...stylex.props(styles.ownMark)}>Your pitch</span>
											)}
											<Badge
												variant="default"
												style={[
													styles.authorBadge,
													isCurrentUserPitch ? styles.ownAuthor : styles.otherAuthor,
												]}
											>
												{pitch.generatedName}
											</Badge>
										</div>
										<div
											{...stylex.props(
												styles.pitchBody,
												isCurrentUserPitch ? styles.ownBody : styles.otherBody,
											)}
										>
											{pitch.pitch}
										</div>
									</div>
								);
							})
						) : (
							<div {...stylex.props(styles.empty)}>
								<p {...stylex.props(styles.emptyText)}>No pitches available for this game</p>
							</div>
						)}
					</div>
				</ScrollArea>
				{canManagePitch && (
					<div {...stylex.props(styles.editorPane)}>
						{isEditorOpen ? (
							<fetcher.Form
								method="patch"
								action="/nominate"
								{...stylex.props(styles.form)}
								onSubmit={(event) => {
									if (isSaveDisabled || isSubmitting) {
										event.preventDefault();
									}
								}}
							>
								<input type="hidden" name="intent" value="savePitch" />
								<input type="hidden" name="nominationId" value={nomination.id} />
								<label htmlFor="pitch-modal-input" {...stylex.props(styles.fieldLabel)}>
									{serverUserPitch ? "Edit your pitch" : "Add your pitch"}
								</label>
								<textarea
									id="pitch-modal-input"
									name="pitch"
									rows={4}
									value={draftPitch}
									onChange={(event) => setDraftPitch(event.target.value)}
									disabled={isSubmitting}
									placeholder="Why is this game worth playing? What makes it a good fit for the month's theme?"
									{...stylex.props(styles.draft)}
								/>
								{saveError && <p {...stylex.props(styles.saveError)}>{saveError}</p>}
								<div {...stylex.props(styles.formActions)}>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setIsEditorOpen(false);
											setDraftPitch(currentUserPitch?.pitch ?? "");
										}}
										disabled={isSubmitting}
										style={styles.quietButton}
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={isSaveDisabled || isSubmitting}
										style={styles.primaryButton}
									>
										{isSubmitting
											? serverUserPitch
												? "Saving..."
												: "Adding..."
											: serverUserPitch
												? "Save Changes"
												: "Add Pitch"}
									</Button>
								</div>
							</fetcher.Form>
						) : null}
					</div>
				)}
				<DialogFooter style={styles.footer}>
					<div {...stylex.props(styles.footerRow)}>
						<div>
							{canManagePitch && !isEditorOpen && (
								<Button
									type="button"
									onClick={() => {
										setDraftPitch(currentUserPitch?.pitch ?? "");
										setIsEditorOpen(true);
									}}
									style={styles.primaryButton}
								>
									{currentUserPitch ? "Edit Pitch" : "Add Pitch"}
								</Button>
							)}
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							style={[styles.quietButton, styles.closeButton]}
						>
							Close
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
