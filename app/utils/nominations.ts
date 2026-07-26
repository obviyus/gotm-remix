import type { Nomination } from "~/types";

export function findNominationById(
	id: number | null | undefined,
	...lists: readonly (readonly Nomination[] | null | undefined)[]
): Nomination | null {
	if (id == null) {
		return null;
	}

	for (const list of lists) {
		const match = list?.find((nomination) => nomination.id === id);
		if (match) {
			return match;
		}
	}

	return null;
}
