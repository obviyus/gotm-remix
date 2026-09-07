import type { Nomination } from "~/types";

export type RankingRow = {
	nomination_id: number;
	rank: number;
};

export function buildOrderFromRankings(
	nominations: Nomination[] | undefined,
	rankings: RankingRow[] | undefined,
	previousOrder: string[] = [],
): string[] {
	const games = nominations ?? [];
	const eligibleIds = new Set(games.map((nomination) => nomination.id));
	const rankedIds = (rankings ?? [])
		.filter((ranking) => eligibleIds.has(ranking.nomination_id))
		.sort((a, b) => a.rank - b.rank)
		.map((ranking) => String(ranking.nomination_id));
	const rankedSet = new Set(rankedIds);
	const unrankedIds = new Set(
		games
			.filter((nomination) => !rankedSet.has(String(nomination.id)))
			.map((nomination) => String(nomination.id)),
	);
	// Saving a vote reloads the shuffled candidates; keep the visible remainder
	// in place until the voter opens a new page or refreshes.
	const preservedIds: string[] = [];
	for (const id of previousOrder) {
		if (unrankedIds.has(id)) {
			preservedIds.push(id);
			unrankedIds.delete(id);
		}
	}

	return [...rankedIds, "divider", ...preservedIds, ...unrankedIds];
}

export function resolveVotedStatus(
	loaderVoted: boolean,
	short: boolean,
	submission: {
		state: "idle" | "submitting" | "loading";
		formMethod?: string;
		json?: unknown;
	},
): boolean {
	if (submission.state === "idle") {
		return loaderVoted;
	}

	const body = submission.json;
	if (
		typeof body !== "object" ||
		body === null ||
		Array.isArray(body) ||
		!("short" in body) ||
		typeof body.short !== "boolean" ||
		body.short !== short
	) {
		return loaderVoted;
	}

	if (submission.formMethod === "DELETE") {
		return false;
	}

	return true;
}
