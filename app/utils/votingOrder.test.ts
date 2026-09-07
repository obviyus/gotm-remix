import { describe, expect, test } from "bun:test";
import type { Nomination } from "~/types";
import { buildOrderFromRankings, resolveVotedStatus } from "~/utils/votingOrder";

function nomination(id: number): Nomination {
	return {
		id,
		gameId: String(id),
		short: false,
		jurySelected: true,
		monthId: 1,
		gameName: `Game ${id}`,
		gameYear: "2024",
		gameUrl: "",
		discordId: "1",
		pitches: [],
	};
}

describe("buildOrderFromRankings", () => {
	test("uses shuffled candidate order only for unranked games", () => {
		const rankings = [
			{ nomination_id: 3, rank: 1 },
			{ nomination_id: 1, rank: 2 },
		];
		expect(
			buildOrderFromRankings(
				[nomination(2), nomination(1), nomination(4), nomination(3)],
				rankings,
			),
		).toEqual(["3", "1", "divider", "2", "4"]);
		expect(
			buildOrderFromRankings(
				[nomination(4), nomination(3), nomination(1), nomination(2)],
				rankings,
			),
		).toEqual(["3", "1", "divider", "4", "2"]);
	});

	test("a vote save preserves remaining candidates despite a new loader shuffle", () => {
		expect(
			buildOrderFromRankings(
				[nomination(4), nomination(3), nomination(2), nomination(1)],
				[{ nomination_id: 2, rank: 1 }],
				["2", "divider", "1", "3", "4"],
			),
		).toEqual(["2", "divider", "1", "3", "4"]);
	});

	test("clearing a vote retains the displayed candidate order", () => {
		expect(
			buildOrderFromRankings(
				[nomination(3), nomination(2), nomination(1)],
				[],
				["divider", "1", "2", "3"],
			),
		).toEqual(["divider", "1", "2", "3"]);
	});

	test("revalidation removes unavailable candidates and appends new ones", () => {
		expect(
			buildOrderFromRankings(
				[nomination(4), nomination(2), nomination(3)],
				[],
				["divider", "1", "3", "2"],
			),
		).toEqual(["divider", "3", "2", "4"]);
	});

	test("omits rankings for games moved out of the ballot", () => {
		expect(
			buildOrderFromRankings(
				[nomination(2), nomination(3)],
				[
					{ nomination_id: 1, rank: 1 },
					{ nomination_id: 2, rank: 2 },
				],
			),
		).toEqual(["2", "divider", "3"]);
	});

	test("all unranked without rankings", () => {
		expect(buildOrderFromRankings([nomination(1), nomination(2)], [])).toEqual([
			"divider",
			"1",
			"2",
		]);
	});

	test("ranked then divider then unranked", () => {
		expect(
			buildOrderFromRankings(
				[nomination(1), nomination(2), nomination(3)],
				[
					{ nomination_id: 3, rank: 2 },
					{ nomination_id: 1, rank: 1 },
				],
			),
		).toEqual(["1", "3", "divider", "2"]);
	});
});

describe("resolveVotedStatus", () => {
	test("idle uses loader value", () => {
		expect(resolveVotedStatus(true, true, { state: "idle" })).toBe(true);
		expect(resolveVotedStatus(false, true, { state: "idle" })).toBe(false);
	});

	test("pending delete clears vote for matching column", () => {
		expect(
			resolveVotedStatus(true, true, {
				state: "submitting",
				formMethod: "DELETE",
				json: { short: true },
			}),
		).toBe(false);
	});

	test("pending post sets voted for matching column only", () => {
		expect(
			resolveVotedStatus(false, false, {
				state: "submitting",
				formMethod: "POST",
				json: { short: false, order: [1] },
			}),
		).toBe(true);
		expect(
			resolveVotedStatus(false, true, {
				state: "submitting",
				formMethod: "POST",
				json: { short: false, order: [1] },
			}),
		).toBe(false);
	});
});
