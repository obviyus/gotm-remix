import type { Month } from "~/types";

export const DEFAULT_CATEGORY_LABELS = {
	long: "Long",
	short: "Short",
} as const;

export interface CategoryLabels {
	long: string;
	short: string;
}

export function categoryLabelsFromMonth(
	month: Pick<Month, "longLabel" | "shortLabel">,
): CategoryLabels {
	return {
		long: month.longLabel,
		short: month.shortLabel,
	};
}

export function categoryGameTitle(label: string): string {
	return `${label} Games`;
}

export function categoryGameLabel(label: string): string {
	return `${label} Game`;
}

export function categoryWinnerLabel(label: string): string {
	return `${label} Winner`;
}

export function isDefaultCategoryLabels(labels: CategoryLabels): boolean {
	return (
		labels.long === DEFAULT_CATEGORY_LABELS.long && labels.short === DEFAULT_CATEGORY_LABELS.short
	);
}
