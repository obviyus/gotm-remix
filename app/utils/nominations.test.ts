import { describe, expect, test } from "bun:test";
import type { Nomination } from "~/types";
import { findNominationById } from "~/utils/nominations";

function nomination(id: number, gameName: string): Nomination {
	return {
		id,
		gameId: String(id),
		short: false,
		jurySelected: false,
		monthId: 1,
		gameName,
		gameYear: "2024",
		gameUrl: "",
		discordId: "1",
		pitches: [],
	};
}

describe("findNominationById", () => {
	test("returns null for null id", () => {
		expect(findNominationById(null, [nomination(1, "A")])).toBeNull();
	});

	test("finds across lists", () => {
		const long = [nomination(1, "Long")];
		const short = [nomination(2, "Short")];
		expect(findNominationById(2, long, short)?.gameName).toBe("Short");
	});

	test("returns null when missing", () => {
		expect(findNominationById(9, [nomination(1, "A")], undefined)).toBeNull();
	});
});
