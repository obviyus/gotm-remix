import { describe, expect, test } from "bun:test";
import { calculateIRV, type VoteWithRankings } from "~/server/voting-logic";
import { getWinnerNode, getWinnerName } from "~/utils/votingResults";
import type { Nomination } from "~/types";

// Mock Data
const nominations: Nomination[] = [
	{
		id: 1,
		gameName: "Game A",
		monthId: 1,
		gameId: "1",
		discordId: "1",
		short: false,
		jurySelected: true,
		pitches: [],
		gameYear: "2023",
		gameUrl: "",
		gameCover: "",
	},
	{
		id: 2,
		gameName: "Game B",
		monthId: 1,
		gameId: "2",
		discordId: "2",
		short: false,
		jurySelected: true,
		pitches: [],
		gameYear: "2023",
		gameUrl: "",
		gameCover: "",
	},
	{
		id: 3,
		gameName: "Game C",
		monthId: 1,
		gameId: "3",
		discordId: "3",
		short: false,
		jurySelected: true,
		pitches: [],
		gameYear: "2023",
		gameUrl: "",
		gameCover: "",
	},
];

describe("Voting Logic (IRV)", () => {
	test("Scenario 1: Simple Majority", () => {
		// 3 votes for A, 1 for B, 1 for C
		const votes: VoteWithRankings[] = [
			{ id: 1, rankings: [{ voteId: 1, nominationId: 1, rank: 1 }] },
			{ id: 2, rankings: [{ voteId: 2, nominationId: 1, rank: 1 }] },
			{ id: 3, rankings: [{ voteId: 3, nominationId: 1, rank: 1 }] },
			{ id: 4, rankings: [{ voteId: 4, nominationId: 2, rank: 1 }] },
			{ id: 5, rankings: [{ voteId: 5, nominationId: 3, rank: 1 }] },
		];

		const results = calculateIRV(nominations, votes);

		// Game A should win
		const finalRound = results[results.length - 1];
		expect(finalRound.target).toContain("Game A");
		expect(finalRound.target).toContain("(3)");
	});

	test("Scenario 2: Vote Transfer", () => {
		// Round 1: A: 2, B: 2, C: 1 (C eliminated)
		// C's voter prefers B.
		// Round 2: A: 2, B: 3 (B wins)
		const votes: VoteWithRankings[] = [
			{ id: 1, rankings: [{ voteId: 1, nominationId: 1, rank: 1 }] },
			{ id: 2, rankings: [{ voteId: 2, nominationId: 1, rank: 1 }] },
			{ id: 3, rankings: [{ voteId: 3, nominationId: 2, rank: 1 }] },
			{ id: 4, rankings: [{ voteId: 4, nominationId: 2, rank: 1 }] },
			{
				id: 5,
				rankings: [
					{ voteId: 5, nominationId: 3, rank: 1 },
					{ voteId: 5, nominationId: 2, rank: 2 },
				],
			},
		];

		const results = calculateIRV(nominations, votes);

		// Check for transfer from C to B
		const transfer = results.find(
			(r) => r.source.includes("Game C") && r.target.includes("Game B"),
		);
		expect(transfer).toBeDefined();
		expect(transfer?.weight).toBe("1");

		// B should win
		const finalRound = results[results.length - 1];
		expect(finalRound.target).toContain("Game B");
		expect(finalRound.target).toContain("(3)");
	});

	test("Scenario 3: Tie-breaker (Borda Count)", () => {
		// A: 1 vote, B: 1 vote.
		// A has rank 1 in one vote.
		// B has rank 1 in one vote.
		// But B has a rank 2 in another vote (from C), while A does not.
		// So B has higher weighted score. A should be eliminated first.
		const votes: VoteWithRankings[] = [
			{ id: 1, rankings: [{ voteId: 1, nominationId: 1, rank: 1 }] }, // A: 1st (Weight 3)
			{ id: 2, rankings: [{ voteId: 2, nominationId: 2, rank: 1 }] }, // B: 1st (Weight 3)
			{
				id: 3,
				rankings: [
					{ voteId: 3, nominationId: 3, rank: 1 },
					{ voteId: 3, nominationId: 2, rank: 2 },
				],
			}, // C: 1st, B: 2nd (Weight 2)
		];

		const results = calculateIRV(nominations, votes);

		// A should be eliminated first (lowest weighted score among tied lowest votes)
		// C is also at 1 vote, but C has weight 3 (rank 1). A has weight 3 (rank 1).
		// Wait, let's re-calculate weights manually:
		// MaxRank = 3.
		// A: Rank 1 (Vote 1). Weight = 3 - 1 + 1 = 3. Total = 3.
		// B: Rank 1 (Vote 2). Weight = 3. Rank 2 (Vote 3). Weight = 3 - 2 + 1 = 2. Total = 3 + 2 = 5.
		// C: Rank 1 (Vote 3). Weight = 3. Total = 3.

		// Votes: A=1, B=1, C=1.
		// Scores: A=3, B=5, C=3.
		// A and C are tied for lowest score (3).
		// ID Tie-breaker: A(1) < C(3).
		// Sort is Ascending (loser first).
		// A vs C: Votes equal. Scores equal. ID 1 < 3. A comes first.
		// So A is eliminated first.

		// Round 1 Loser: A.
		// A's votes transfer? A has no second choice. Exhausted.
		// Remaining: B(1), C(1).
		// Round 2:
		// B: 1 vote. Score 5.
		// C: 1 vote. Score 3.
		// C eliminated.
		// C's vote transfers to B (Rank 2).
		// B gets +1 vote. Total 2.
		// B wins.

		const winner = results[results.length - 1];
		expect(winner.target).toContain("Game B");
	});
});

describe("getWinnerNode", () => {
	test("should return the final round winner, not an early-eliminated game", () => {
		// This is the bug scenario: multiple terminal nodes (eliminated games + actual winner)
		// The winner should be from the FINAL round (most trailing spaces), not the first terminal node found
		const results = [
			{
				source: "Hotline Miami 2: Wrong Number (6) ",
				target: "Hotline Miami 2: Wrong Number (7)  ",
				weight: "6",
			},
			{ source: "Lisa: The Painful (13) ", target: "Lisa: The Painful (13)  ", weight: "13" },
			{ source: "Shovel Knight (15) ", target: "Shovel Knight (16)  ", weight: "15" },
			{ source: "The Beginner's Guide (8) ", target: "The Beginner's Guide (9)  ", weight: "8" },
			{
				source: "Tormentum: Dark Sorrow (5) ",
				target: "Hotline Miami 2: Wrong Number (7)  ",
				weight: "1",
			},
			{ source: "Tormentum: Dark Sorrow (5) ", target: "The Beginner's Guide (9)  ", weight: "1" },
			{ source: "Tormentum: Dark Sorrow (5) ", target: "Shovel Knight (16)  ", weight: "1" },
			{ source: "The Beginner's Guide (9)  ", target: "The Beginner's Guide (9)   ", weight: "9" },
			{ source: "Lisa: The Painful (13)  ", target: "Lisa: The Painful (13)   ", weight: "13" },
			{ source: "Shovel Knight (16)  ", target: "Shovel Knight (16)   ", weight: "16" },
			{ source: "The Beginner's Guide (9)   ", target: "Lisa: The Painful (17)    ", weight: "4" },
			{ source: "The Beginner's Guide (9)   ", target: "Shovel Knight (17)    ", weight: "1" },
			{ source: "Lisa: The Painful (13)   ", target: "Lisa: The Painful (17)    ", weight: "13" },
			{ source: "Shovel Knight (16)   ", target: "Shovel Knight (17)    ", weight: "16" },
			{ source: "Lisa: The Painful (17)    ", target: "Shovel Knight (24)     ", weight: "7" },
			{ source: "Shovel Knight (17)    ", target: "Shovel Knight (24)     ", weight: "17" },
		];

		// The actual winner is "Shovel Knight" with 24 votes in the final round
		// NOT "Hotline Miami 2" which was eliminated early
		const winnerNode = getWinnerNode(results);
		expect(winnerNode).toContain("Shovel Knight");
		expect(winnerNode).toContain("(24)");

		const winnerName = getWinnerName(results);
		expect(winnerName).toBe("Shovel Knight");
	});

	test("should handle single terminal node correctly", () => {
		const results = [
			{ source: "Game A (5) ", target: "Game A (8)  ", weight: "5" },
			{ source: "Game B (3) ", target: "Game A (8)  ", weight: "3" },
		];

		const winnerNode = getWinnerNode(results);
		expect(winnerNode).toContain("Game A");
	});
});
