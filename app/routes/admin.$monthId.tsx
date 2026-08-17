import type { Row, Value } from "@libsql/client";
import * as stylex from "@stylexjs/stylex";
import type { ChangeEvent } from "react";
import { useId, useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import PitchesModal from "~/components/PitchesModal";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { requireAdmin, requireAuthenticatedUser } from "~/route-context.server";
import { db } from "~/server/database.server";
import { getMonths, getThemeCategories } from "~/server/month.server";
import { getNominationsForMonth, updateNominationCategory } from "~/server/nomination.server";
import { recalculateWinnersForMonth } from "~/server/winner.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import type { Month, Nomination } from "~/types";
import {
	categoryGameLabel,
	categoryLabelsFromMonth,
	DEFAULT_CATEGORY_LABELS,
} from "~/utils/categoryLabels";
import { findNominationById } from "~/utils/nominations";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/admin.$monthId";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Manage Month | ${SITE_NAME}`,
		description: "Jury tools.",
		path: "/admin",
		noIndex: true,
	});

const csvField = (value: string | number) => {
	const text = String(value)
		.replace(/\t/g, " ")
		.replace(/[\r\n]/g, " ")
		.trim();

	return text;
};

const submitContainingForm = (event: ChangeEvent<HTMLSelectElement>) => {
	event.target.form?.requestSubmit();
};

const pulse = stylex.keyframes({ "50%": { opacity: 0.5 } });

const styles = stylex.create({
	page: {
		marginInline: "auto",
		maxWidth: "80rem",
		paddingBlock: 24,
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	monthHeader: {
		marginBottom: 32,
	},
	headerRow: {
		alignItems: "center",
		display: "flex",
		flexDirection: { default: "column", [media.sm]: "row" },
		gap: 16,
		justifyContent: "space-between",
	},
	monthIdentity: {
		alignItems: { default: null, [media.sm]: "center" },
		display: "flex",
		flexDirection: { default: "column", [media.sm]: "row" },
		gap: 12,
	},
	monthName: {
		color: color.body,
		fontSize: "1.5rem",
		fontWeight: 700,
		lineHeight: 1.3333,
	},
	activePill: {
		alignItems: "center",
		backgroundColor: "oklch(76.5% 0.177 163.223 / 0.1)",
		borderRadius: radius.pill,
		boxShadow: "inset 0 0 0 1px oklch(76.5% 0.177 163.223 / 0.2)",
		color: "oklch(76.5% 0.177 163.223)",
		display: "inline-flex",
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
		paddingBlock: 4,
		paddingInline: 12,
	},
	statusForm: {
		alignItems: "center",
		display: "flex",
		gap: 8,
		width: { default: "100%", [media.sm]: "auto" },
	},
	statusLabel: {
		borderWidth: { default: 0, [media.sm]: null },
		clipPath: { default: "inset(50%)", [media.sm]: "none" },
		color: color.muted,
		fontSize: "0.875rem",
		fontWeight: 500,
		height: { default: 1, [media.sm]: "auto" },
		lineHeight: 1.4286,
		margin: { default: -1, [media.sm]: 0 },
		overflow: { default: "hidden", [media.sm]: "visible" },
		padding: 0,
		position: { default: "absolute", [media.sm]: "static" },
		whiteSpace: { default: "nowrap", [media.sm]: "normal" },
		width: { default: 1, [media.sm]: "auto" },
	},
	// Shared by every text input, textarea, and select on this screen.
	field: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: { default: "rgba(255, 255, 255, 0.1)", ":focus": color.focus },
		boxShadow: {
			default: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
			":focus": "0 0 0 1px oklch(62.3% 0.214 259.815)",
		},
		color: color.body,
	},
	select: {
		borderRadius: radius.md,
		borderWidth: 1,
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		paddingBlock: 8,
		paddingInline: 12,
	},
	statusSelect: {
		width: { default: "100%", [media.sm]: "auto" },
	},
	blockSelect: {
		display: "block",
		width: "100%",
	},
	option: {
		paddingBlock: 4,
	},
	pending: {
		color: color.muted,
		fontSize: "0.75rem",
		lineHeight: 1.3333,
	},
	monthNav: {
		alignItems: "center",
		display: "flex",
		justifyContent: "space-between",
		marginTop: 16,
	},
	navButton: {
		backgroundColor: { default: "transparent", ":hover": "oklch(27.4% 0.006 286.033 / 0.4)" },
		borderColor: color.surfaceRaised,
		color: { default: color.body, ":hover": color.body },
		paddingBlock: 6,
		paddingInline: 12,
	},
	navButtonOff: {
		color: color.muted,
		opacity: 0.5,
		paddingBlock: 6,
		paddingInline: 12,
	},
	navActions: {
		display: "flex",
		gap: 8,
	},
	createButton: {
		backgroundColor: { default: "transparent", ":hover": "oklch(69.6% 0.17 162.48 / 0.1)" },
		borderColor: "oklch(69.6% 0.17 162.48 / 0.3)",
		color: { default: "oklch(76.5% 0.177 163.223)", ":hover": "oklch(76.5% 0.177 163.223)" },
	},
	exportButton: {
		backgroundColor: { default: "transparent", ":hover": "oklch(37% 0.013 285.805 / 0.2)" },
		borderColor: "oklch(44.2% 0.017 285.786 / 0.3)",
		color: { default: color.body, ":hover": color.body },
	},
	formError: {
		color: "oklch(70.4% 0.191 22.216)",
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		marginTop: 8,
	},
	labelForm: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.lg,
		borderWidth: 1,
		display: "grid",
		gap: 12,
		gridTemplateColumns: { default: null, [media.sm]: "1fr 1fr auto" },
		marginTop: 16,
		padding: 16,
	},
	fieldLabel: {
		color: color.muted,
		fontSize: "0.875rem",
		fontWeight: 500,
	},
	fieldLabelSpaced: {
		marginBottom: 4,
	},
	fieldSpaced: {
		marginTop: 4,
	},
	saveCell: {
		alignItems: "flex-end",
		display: "flex",
	},
	saveButton: {
		backgroundColor: { default: null, ":hover": "oklch(69.6% 0.17 162.48 / 0.1)" },
		borderColor: "oklch(76.5% 0.177 163.223 / 0.2)",
		color: { default: color.affirm, ":hover": color.affirm },
		width: { default: "100%", [media.sm]: "auto" },
	},
	createCard: {
		backgroundColor: "rgba(0, 0, 0, 0.2)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		marginBottom: 32,
	},
	createTitle: {
		color: color.body,
	},
	createGrid: {
		display: "grid",
		gap: 16,
		gridTemplateColumns: { default: null, [media.md]: "repeat(2, minmax(0, 1fr))" },
		marginBottom: 16,
	},
	wideCell: {
		gridColumn: { default: null, [media.md]: "span 2 / span 2" },
	},
	submitRow: {
		display: "flex",
		justifyContent: "flex-end",
	},
	sectionHeading: {
		color: color.body,
		fontSize: "1.25rem",
		fontWeight: 600,
		lineHeight: 1.4,
		marginBottom: 16,
	},
	tablePanel: {
		backdropFilter: "blur(8px)",
		backgroundColor: "rgba(0, 0, 0, 0.1)",
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.lg,
		borderWidth: 1,
		boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
		overflow: "hidden",
	},
	tableScroller: {
		overflowX: "auto",
	},
	table: {
		minWidth: "100%",
	},
	tableBody: {
		borderTopColor: "rgba(255, 255, 255, 0.1)",
		borderTopWidth: 1,
	},
	rowRule: {
		borderTopColor: "rgba(255, 255, 255, 0.1)",
		borderTopWidth: 1,
	},
	row: {
		backgroundColor: { default: null, ":hover": "rgba(255, 255, 255, 0.05)" },
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	columnHead: {
		color: color.muted,
		fontSize: "0.75rem",
		fontWeight: 500,
		letterSpacing: "0.05em",
		lineHeight: 1.3333,
		paddingBlock: 12,
		paddingInline: 16,
		textAlign: "left",
		textTransform: "uppercase",
	},
	centered: {
		textAlign: "center",
	},
	cell: {
		paddingBlock: 12,
		paddingInline: 16,
		whiteSpace: "nowrap",
	},
	metaCell: {
		color: color.muted,
		fontSize: "0.875rem",
		lineHeight: 1.4286,
	},
	gameCell: {
		alignItems: "center",
		display: "flex",
	},
	thumbnail: {
		borderColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: radius.sm,
		borderWidth: 1,
		height: 40,
		marginRight: 12,
		objectFit: "cover",
		width: 40,
	},
	gameName: {
		color: color.body,
		fontSize: "0.875rem",
		fontWeight: 500,
		lineHeight: 1.4286,
		maxWidth: 200,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	categorySelect: {
		borderRadius: radius.md,
		borderWidth: 1,
		fontSize: "0.75rem",
		fontWeight: 500,
		lineHeight: 1.3333,
		opacity: { default: null, ":disabled": 0.7 },
		paddingBlock: 4,
		paddingInline: 8,
	},
	pitchesButton: {
		backgroundColor: { default: "transparent", ":hover": "oklch(27.4% 0.006 286.033 / 0.4)" },
		borderColor: color.surfaceRaised,
		color: { default: "oklch(87.1% 0.006 286.286)", ":hover": "oklch(87.1% 0.006 286.286)" },
		fontSize: "0.75rem",
		paddingBlock: 4,
		paddingInline: 8,
	},
	toggle: {
		borderColor: "transparent",
		borderRadius: radius.pill,
		borderWidth: 2,
		cursor: "pointer",
		display: "inline-flex",
		height: 24,
		position: "relative",
		transitionDuration: "0.2s",
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
		width: 44,
		boxShadow: {
			default: null,
			":focus": "0 0 0 2px #fff, 0 0 0 4px oklch(62.3% 0.214 259.815)",
		},
		outlineStyle: { default: null, ":focus": "none" },
	},
	toggleOn: { backgroundColor: color.focus },
	toggleOff: { backgroundColor: color.surfaceRaised },
	toggleBusy: { opacity: 0.7 },
	knob: {
		backgroundColor: "#fff",
		borderRadius: radius.pill,
		boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
		display: "inline-block",
		height: 20,
		pointerEvents: "none",
		transitionDuration: "0.2s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		width: 20,
	},
	knobOn: { translate: "20px 0" },
	knobOff: { translate: "0 0" },
	busyOverlay: {
		alignItems: "center",
		display: "flex",
		inset: 0,
		justifyContent: "center",
		position: "absolute",
	},
	busyDot: {
		animationDuration: "2s",
		animationIterationCount: "infinite",
		animationName: { default: pulse, [media.reducedMotion]: "none" },
		animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
		backgroundColor: "oklch(85.2% 0.199 91.936)",
		borderRadius: radius.pill,
		height: 8,
		width: 8,
	},
	srOnly: {
		borderWidth: 0,
		clipPath: "inset(50%)",
		height: 1,
		margin: -1,
		overflow: "hidden",
		padding: 0,
		position: "absolute",
		whiteSpace: "nowrap",
		width: 1,
	},
});

interface ActionResponse {
	success?: boolean;
	error?: string;
}

interface DBRow extends Row {
	[key: string]: Value;
}

interface MonthRow extends DBRow {
	id: number;
}

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser, requireAdmin];

export async function loader({ params }: Route.LoaderArgs) {
	const selectedMonthId = Number(params.monthId);
	if (!Number.isFinite(selectedMonthId)) {
		throw new Response("Invalid month ID", { status: 400 });
	}
	const nominationsPromise = getNominationsForMonth(selectedMonthId);
	const themeCategoriesPromise = getThemeCategories();

	const [months, nominations, themeCategories] = await Promise.all([
		getMonths(),
		nominationsPromise,
		themeCategoriesPromise,
	]);
	const selectedMonth = months.find((month): month is Month => month.id === selectedMonthId);

	if (!selectedMonth) {
		throw new Response("Month not found", { status: 404 });
	}

	return {
		months,
		selectedMonth,
		nominations,
		themeCategories,
	};
}

export async function action({ request, url }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	switch (intent) {
		case "createMonth": {
			const year = Number(formData.get("year"));
			const month = Number(formData.get("month"));
			const status = formData.get("status");
			const themeCategoryId = Number(formData.get("themeCategoryId"));
			const themeName = formData.get("themeName");
			const themeDescription = formData.get("themeDescription");
			const longLabel = formData.get("longLabel")?.toString().trim();
			const shortLabel = formData.get("shortLabel")?.toString().trim();

			if (
				!year ||
				!month ||
				!status ||
				!themeCategoryId ||
				!themeName ||
				!longLabel ||
				!shortLabel ||
				typeof status !== "string" ||
				typeof themeName !== "string"
			) {
				return Response.json({ error: "Missing required fields" }, { status: 400 });
			}

			try {
				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(status)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting')`,
						args: [],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating / jury / voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// Get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [status],
				});

				if (statusResult.rows.length === 0) {
					return Response.json({ error: `Invalid status: ${status}` }, { status: 400 });
				}

				const statusId = statusResult.rows[0].id;

				// Create theme first
				const themeResult = await db.execute({
					sql: "INSERT INTO themes (theme_category_id, name, description) VALUES (?, ?, ?) RETURNING id",
					args: [themeCategoryId, themeName, themeDescription?.toString() || null],
				});

				const themeId = (themeResult.rows[0] as unknown as MonthRow).id;

				// Then create month with the new theme
				await db.execute({
					sql: "INSERT INTO months (year, month, status_id, theme_id, long_label, short_label) VALUES (?, ?, ?, ?, ?, ?)",
					args: [year, month, statusId, themeId, longLabel, shortLabel],
				});

				return redirect(url.pathname);
			} catch (error) {
				// Check for unique constraint violation
				if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
					return Response.json({ error: "This month already exists" }, { status: 400 });
				}
				throw error;
			}
		}

		case "updateLabels": {
			const monthId = formData.get("monthId")?.toString();
			const longLabel = formData.get("longLabel")?.toString().trim();
			const shortLabel = formData.get("shortLabel")?.toString().trim();

			if (!monthId || !longLabel || !shortLabel) {
				return Response.json({ error: "Missing required fields" }, { status: 400 });
			}
			const monthIdNumber = Number(monthId);
			if (!Number.isFinite(monthIdNumber)) {
				return Response.json({ error: "Invalid month ID" }, { status: 400 });
			}

			await db.execute({
				sql: "UPDATE months SET long_label = ?, short_label = ?, updated_at = unixepoch() WHERE id = ?",
				args: [longLabel, shortLabel, monthIdNumber],
			});

			return Response.json({ success: true });
		}

		case "updateStatus": {
			const monthId = formData.get("monthId")?.toString();
			const newStatus = formData.get("status");

			if (!monthId || !newStatus || typeof newStatus !== "string") {
				return Response.json({ error: "Missing required fields" }, { status: 400 });
			}
			const monthIdNumber = Number(monthId);
			if (!Number.isFinite(monthIdNumber)) {
				return Response.json({ error: "Invalid month ID" }, { status: 400 });
			}

			try {
				const currentStatusResult = await db.execute({
					sql: `SELECT ms.status
                          FROM months m
                          JOIN month_status ms ON m.status_id = ms.id
                          WHERE m.id = ?`,
					args: [monthId],
				});
				if (currentStatusResult.rows.length === 0) {
					return Response.json({ error: "Month not found" }, { status: 404 });
				}
				const currentStatus = String(currentStatusResult.rows[0].status);
				if (currentStatus === newStatus) {
					return Response.json({ success: true });
				}

				// Check if there's already an active month when trying to set an active status
				if (["nominating", "jury", "voting"].includes(newStatus)) {
					const activeMonthsResult = await db.execute({
						sql: `SELECT m.id, m.year, m.month, ms.status 
							  FROM months m 
							  JOIN month_status ms ON m.status_id = ms.id 
							  WHERE ms.status IN ('nominating', 'jury', 'voting') AND m.id != ?`,
						args: [monthId],
					});

					if (activeMonthsResult.rows.length > 0) {
						return Response.json(
							{
								error:
									"Another month is already active. Only one month can be in nominating/jury/voting status at a time.",
							},
							{ status: 400 },
						);
					}
				}

				// First get the status_id for the new status
				const statusResult = await db.execute({
					sql: "SELECT id FROM month_status WHERE status = ?",
					args: [newStatus],
				});

				if (statusResult.rows.length === 0) {
					return Response.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
				}

				const statusId = statusResult.rows[0].id;

				// Update the month with the new status_id
				await db.execute({
					sql: "UPDATE months SET status_id = ? WHERE id = ?",
					args: [statusId, monthId],
				});
				await recalculateWinnersForMonth(monthIdNumber);

				return Response.json({ success: true });
			} catch (error) {
				console.error("Error updating month status:", error);
				return Response.json({ error: "Failed to update month status" }, { status: 500 });
			}
		}

		case "toggleJurySelected": {
			const nominationId = formData.get("nominationId")?.toString();
			const selected = formData.get("selected") === "true";

			if (!nominationId) {
				return Response.json({ error: "Missing nomination ID" }, { status: 400 });
			}

			await db.execute({
				sql: "UPDATE nominations SET jury_selected = ? WHERE id = ?",
				args: [selected ? 1 : 0, nominationId],
			});

			return Response.json({ success: true });
		}

		case "updateNominationCategory": {
			const nominationId = Number(formData.get("nominationId"));
			const category = formData.get("category");

			if (!Number.isFinite(nominationId) || (category !== "long" && category !== "short")) {
				return Response.json({ error: "Invalid nomination category" }, { status: 400 });
			}

			const monthId = await updateNominationCategory(nominationId, category === "short");
			await recalculateWinnersForMonth(monthId);

			return Response.json({ success: true });
		}

		default:
			return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}

export default function Admin({ loaderData }: Route.ComponentProps) {
	const { months, selectedMonth, nominations, themeCategories } = loaderData;
	const [selectedNominationId, setSelectedNominationId] = useState<number | null>(null);
	const selectedNomination = findNominationById(selectedNominationId, nominations);
	const createMonthFetcher = useFetcher<ActionResponse>();
	const statusUpdateFetcher = useFetcher<ActionResponse>();
	const labelUpdateFetcher = useFetcher<ActionResponse>();
	const jurySelectionFetcher = useFetcher<ActionResponse>();
	const categoryUpdateFetcher = useFetcher<ActionResponse>();
	const [csvCopied, setCsvCopied] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const createMonthError = createMonthFetcher.data?.error ?? null;
	const labels = categoryLabelsFromMonth(selectedMonth);

	const toggleCreateForm = () => {
		setShowCreateForm((previous) => !previous);
	};
	const openPitchesModal = (nomination: Nomination) => {
		setSelectedNominationId(nomination.id);
	};
	const closePitchesModal = () => {
		setSelectedNominationId(null);
	};

	// Generate unique IDs for form elements
	const statusSelectId = useId();
	const yearInputId = useId();
	const monthInputId = useId();
	const createStatusSelectId = useId();
	const themeCategorySelectId = useId();
	const themeNameInputId = useId();
	const themeDescriptionTextareaId = useId();
	const createLongLabelInputId = useId();
	const createShortLabelInputId = useId();
	const longLabelInputId = useId();
	const shortLabelInputId = useId();

	const handleToggleJurySelected = (nomination: Nomination) => {
		void jurySelectionFetcher.submit(
			{
				intent: "toggleJurySelected",
				nominationId: nomination.id.toString(),
				selected: (!nomination.jurySelected).toString(),
			},
			{ method: "POST" },
		);
	};

	const handleNominationCategoryChange = (
		nomination: Nomination,
		event: ChangeEvent<HTMLSelectElement>,
	) => {
		void categoryUpdateFetcher.submit(
			{
				intent: "updateNominationCategory",
				nominationId: nomination.id.toString(),
				category: event.target.value,
			},
			{ method: "POST" },
		);
	};

	// Function to determine if a nomination is being processed
	const isProcessingNomination = (nominationId: number) => {
		if (jurySelectionFetcher.state === "idle") return false;

		const formData = jurySelectionFetcher.formData;
		if (!formData) return false;

		return formData.get("nominationId") === nominationId.toString();
	};

	// Function to get the optimistic selection state
	const getNominationSelectedState = (nomination: Nomination) => {
		const isProcessing = isProcessingNomination(nomination.id);
		if (!isProcessing) return nomination.jurySelected;

		// Return the optimistic state
		return jurySelectionFetcher.formData?.get("selected") === "true";
	};

	const isProcessingNominationCategory = (nominationId: number) => {
		if (categoryUpdateFetcher.state === "idle") return false;

		return categoryUpdateFetcher.formData?.get("nominationId") === nominationId.toString();
	};

	const getNominationCategory = (nomination: Nomination) => {
		const isProcessing = isProcessingNominationCategory(nomination.id);
		if (!isProcessing) return nomination.short ? "short" : "long";

		const category = categoryUpdateFetcher.formData?.get("category");
		if (category === "long" || category === "short") return category;

		throw new Error("Invalid optimistic nomination category");
	};

	const handleCopyAsCSV = () => {
		const csvString = nominations
			.map((nomination) => [
				nomination.gameName,
				nomination.short ? labels.short : labels.long,
				nomination.pitches.map((pitch) => pitch.pitch).join("; "),
				nomination.pitches.length,
			])
			.map((row) => row.map(csvField).join("\t"))
			.join("\n");

		void navigator.clipboard.writeText(csvString).then(() => {
			setCsvCopied(true);
			setTimeout(() => setCsvCopied(false), 2000);
		});
	};

	const monthStatuses = ["ready", "nominating", "jury", "voting", "playing", "over"] as const;

	return (
		<div {...stylex.props(styles.page)}>
			{/* Header with Month Navigation and Status */}
			{selectedMonth && (
				<div {...stylex.props(styles.monthHeader)}>
					<div {...stylex.props(styles.headerRow)}>
						{/* Month title and status */}
						<div {...stylex.props(styles.monthIdentity)}>
							<h1 {...stylex.props(styles.monthName)}>
								{new Date(Date.UTC(selectedMonth.year, selectedMonth.month - 1)).toLocaleString(
									"en-US",
									{
										month: "long",
										timeZone: "UTC",
										year: "numeric",
									},
								)}
							</h1>

							{["nominating", "jury", "voting"].includes(selectedMonth.status) && (
								<span {...stylex.props(styles.activePill)}>Active Month</span>
							)}
						</div>

						{/* Quick status update */}
						<statusUpdateFetcher.Form method="POST" {...stylex.props(styles.statusForm)}>
							<input type="hidden" name="monthId" value={selectedMonth.id} />
							<input type="hidden" name="intent" value="updateStatus" />
							<label htmlFor={statusSelectId} {...stylex.props(styles.statusLabel)}>
								Status:
							</label>
							<select
								id={statusSelectId}
								name="status"
								value={selectedMonth.status}
								onChange={submitContainingForm}
								{...stylex.props(styles.field, styles.select, styles.statusSelect)}
							>
								{monthStatuses.map((status) => (
									<option key={status} value={status} {...stylex.props(styles.option)}>
										{status.charAt(0).toUpperCase() + status.slice(1)}
									</option>
								))}
							</select>
							{statusUpdateFetcher.state !== "idle" && (
								<span {...stylex.props(styles.pending)}>Updating…</span>
							)}
						</statusUpdateFetcher.Form>
					</div>

					{/* Month Navigation */}
					<div {...stylex.props(styles.monthNav)}>
						{(() => {
							const currentIndex = months.findIndex((m) => m.id === selectedMonth.id);
							const prev = months[currentIndex + 1];
							return prev ? (
								<Button
									render={<Link to={`/admin/${prev.id}`} prefetch="viewport" />}
									nativeButton={false}
									variant="outline"
									size="sm"
									style={styles.navButton}
								>
									← Previous Month
								</Button>
							) : (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled
									style={styles.navButtonOff}
								>
									← Previous Month
								</Button>
							);
						})()}

						<div {...stylex.props(styles.navActions)}>
							<Button
								type="button"
								onClick={toggleCreateForm}
								variant="outline"
								size="sm"
								style={styles.createButton}
							>
								{showCreateForm ? "Cancel" : "Create New Month"}
							</Button>

							{nominations.length > 0 && (
								<Button
									type="button"
									onClick={handleCopyAsCSV}
									variant="outline"
									size="sm"
									style={styles.exportButton}
								>
									{csvCopied ? "Copied!" : "Export CSV"}
								</Button>
							)}
						</div>

						{(() => {
							const currentIndex = months.findIndex((m) => m.id === selectedMonth.id);
							const next = months[currentIndex - 1];
							return next ? (
								<Button
									render={<Link to={`/admin/${next.id}`} prefetch="viewport" />}
									nativeButton={false}
									variant="outline"
									size="sm"
									style={styles.navButton}
								>
									Next Month →
								</Button>
							) : (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled
									style={styles.navButtonOff}
								>
									Next Month →
								</Button>
							);
						})()}
					</div>

					{statusUpdateFetcher.data?.error && (
						<p {...stylex.props(styles.formError)}>{statusUpdateFetcher.data.error}</p>
					)}
					<labelUpdateFetcher.Form
						key={selectedMonth.id}
						method="POST"
						{...stylex.props(styles.labelForm)}
					>
						<input type="hidden" name="intent" value="updateLabels" />
						<input type="hidden" name="monthId" value={selectedMonth.id} />
						<div>
							<Label htmlFor={longLabelInputId} style={styles.fieldLabel}>
								Long label
							</Label>
							<Input
								id={longLabelInputId}
								name="longLabel"
								autoComplete="off"
								required
								defaultValue={labels.long}
								style={[styles.field, styles.fieldSpaced]}
							/>
						</div>
						<div>
							<Label htmlFor={shortLabelInputId} style={styles.fieldLabel}>
								Short label
							</Label>
							<Input
								id={shortLabelInputId}
								name="shortLabel"
								autoComplete="off"
								required
								defaultValue={labels.short}
								style={[styles.field, styles.fieldSpaced]}
							/>
						</div>
						<div {...stylex.props(styles.saveCell)}>
							<Button
								type="submit"
								disabled={labelUpdateFetcher.state !== "idle"}
								variant="outline"
								style={styles.saveButton}
							>
								{labelUpdateFetcher.state !== "idle" ? "Saving…" : "Save Labels"}
							</Button>
						</div>
					</labelUpdateFetcher.Form>
					{labelUpdateFetcher.data?.error && (
						<p {...stylex.props(styles.formError)}>{labelUpdateFetcher.data.error}</p>
					)}
				</div>
			)}

			{/* Create New Month Form (Collapsible) */}
			{showCreateForm && (
				<Card style={styles.createCard}>
					<CardHeader>
						<CardTitle style={styles.createTitle}>Create New Month</CardTitle>
					</CardHeader>
					<CardContent>
						<createMonthFetcher.Form method="POST">
							<input type="hidden" name="intent" value="createMonth" />
							<div {...stylex.props(styles.createGrid)}>
								<div>
									<Label htmlFor={yearInputId} style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
										Year
									</Label>
									<Input
										type="number"
										id={yearInputId}
										name="year"
										autoComplete="off"
										min="2000"
										max="2100"
										required
										style={styles.field}
									/>
								</div>
								<div>
									<Label
										htmlFor={monthInputId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Month (1-12)
									</Label>
									<Input
										type="number"
										id={monthInputId}
										name="month"
										autoComplete="off"
										min="1"
										max="12"
										required
										style={styles.field}
									/>
								</div>
								<div>
									<Label
										htmlFor={createStatusSelectId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Initial Status
									</Label>
									<select
										id={createStatusSelectId}
										name="status"
										required
										{...stylex.props(styles.field, styles.select, styles.blockSelect)}
									>
										{monthStatuses.map((status) => (
											<option key={status} value={status} {...stylex.props(styles.option)}>
												{status.charAt(0).toUpperCase() + status.slice(1)}
											</option>
										))}
									</select>
								</div>
								<div>
									<Label
										htmlFor={themeCategorySelectId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Theme Category
									</Label>
									<select
										id={themeCategorySelectId}
										name="themeCategoryId"
										required
										{...stylex.props(styles.field, styles.select, styles.blockSelect)}
									>
										<option value="">Select a category</option>
										{themeCategories.map((category) => (
											<option key={category.id} value={category.id}>
												{category.name}
											</option>
										))}
									</select>
								</div>
								<div>
									<Label
										htmlFor={themeNameInputId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Theme Name
									</Label>
									<Input
										type="text"
										id={themeNameInputId}
										name="themeName"
										autoComplete="off"
										required
										style={styles.field}
										placeholder="Enter theme name"
									/>
								</div>
								<div>
									<Label
										htmlFor={createLongLabelInputId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Long label
									</Label>
									<Input
										type="text"
										id={createLongLabelInputId}
										name="longLabel"
										autoComplete="off"
										required
										defaultValue={DEFAULT_CATEGORY_LABELS.long}
										style={styles.field}
									/>
								</div>
								<div>
									<Label
										htmlFor={createShortLabelInputId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Short label
									</Label>
									<Input
										type="text"
										id={createShortLabelInputId}
										name="shortLabel"
										autoComplete="off"
										required
										defaultValue={DEFAULT_CATEGORY_LABELS.short}
										style={styles.field}
									/>
								</div>
								<div {...stylex.props(styles.wideCell)}>
									<Label
										htmlFor={themeDescriptionTextareaId}
										style={[styles.fieldLabel, styles.fieldLabelSpaced]}
									>
										Theme Description
									</Label>
									<Textarea
										id={themeDescriptionTextareaId}
										name="themeDescription"
										autoComplete="off"
										rows={2}
										style={styles.field}
										placeholder="Enter theme description (optional)"
									/>
								</div>
							</div>
							<div {...stylex.props(styles.submitRow)}>
								<Button
									type="submit"
									disabled={createMonthFetcher.state !== "idle"}
									variant="outline"
									style={styles.saveButton}
								>
									{createMonthFetcher.state !== "idle" ? "Creating…" : "Create Month"}
								</Button>
							</div>
							{createMonthError && <p {...stylex.props(styles.formError)}>{createMonthError}</p>}
						</createMonthFetcher.Form>
					</CardContent>
				</Card>
			)}

			{/* Jury Selection Section */}
			{selectedMonth && nominations.length > 0 && (
				<section>
					<h2 {...stylex.props(styles.sectionHeading)}>
						{nominations.length} Game{nominations.length !== 1 ? "s" : ""} Nominated
					</h2>

					<div {...stylex.props(styles.tablePanel)}>
						<div {...stylex.props(styles.tableScroller)}>
							<table {...stylex.props(styles.table)}>
								<thead>
									<tr>
										<th scope="col" {...stylex.props(styles.columnHead)}>
											Game
										</th>
										<th scope="col" {...stylex.props(styles.columnHead)}>
											Year
										</th>
										<th scope="col" {...stylex.props(styles.columnHead)}>
											Type
										</th>
										<th scope="col" {...stylex.props(styles.columnHead, styles.centered)}>
											Pitches
										</th>
										<th scope="col" {...stylex.props(styles.columnHead, styles.centered)}>
											Select
										</th>
									</tr>
								</thead>
								<tbody {...stylex.props(styles.tableBody)}>
									{nominations.map((nomination, index) => (
										<tr
											key={nomination.id}
											{...stylex.props(styles.row, index > 0 && styles.rowRule)}
										>
											<td {...stylex.props(styles.cell)}>
												<div {...stylex.props(styles.gameCell)}>
													{nomination.gameCover && (
														<img
															src={nomination.gameCover}
															alt=""
															width={40}
															height={40}
															loading="lazy"
															{...stylex.props(styles.thumbnail)}
														/>
													)}
													<div {...stylex.props(styles.gameName)}>{nomination.gameName}</div>
												</div>
											</td>
											<td {...stylex.props(styles.cell, styles.metaCell)}>{nomination.gameYear}</td>
											<td {...stylex.props(styles.cell)}>
												<select
													value={getNominationCategory(nomination)}
													onChange={(event) => handleNominationCategoryChange(nomination, event)}
													disabled={isProcessingNominationCategory(nomination.id)}
													aria-label={`Category for ${nomination.gameName}`}
													{...stylex.props(styles.field, styles.categorySelect)}
												>
													<option value="long">{categoryGameLabel(labels.long)}</option>
													<option value="short">{categoryGameLabel(labels.short)}</option>
												</select>
											</td>
											<td {...stylex.props(styles.cell, styles.centered)}>
												<Button
													type="button"
													onClick={() => openPitchesModal(nomination)}
													variant="outline"
													size="sm"
													style={styles.pitchesButton}
												>
													{nomination.pitches?.length ?? 0}
												</Button>
											</td>
											<td {...stylex.props(styles.cell, styles.centered)}>
												<button
													type="button"
													onClick={() => handleToggleJurySelected(nomination)}
													disabled={isProcessingNomination(nomination.id)}
													aria-pressed={getNominationSelectedState(nomination)}
													{...stylex.props(
														styles.toggle,
														getNominationSelectedState(nomination)
															? styles.toggleOn
															: styles.toggleOff,
														isProcessingNomination(nomination.id) && styles.toggleBusy,
													)}
												>
													<span {...stylex.props(styles.srOnly)}>
														{getNominationSelectedState(nomination) ? "Selected" : "Not selected"}
													</span>
													<span
														{...stylex.props(
															styles.knob,
															getNominationSelectedState(nomination)
																? styles.knobOn
																: styles.knobOff,
														)}
													>
														{isProcessingNomination(nomination.id) && (
															<span {...stylex.props(styles.busyOverlay)}>
																<span {...stylex.props(styles.busyDot)} />
															</span>
														)}
													</span>
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			)}

			<PitchesModal
				isOpen={selectedNomination !== null}
				onClose={closePitchesModal}
				nomination={selectedNomination}
			/>
		</div>
	);
}
