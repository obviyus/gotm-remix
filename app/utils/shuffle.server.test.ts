import { expect, spyOn, test } from "bun:test";
import { shuffle } from "./shuffle.server";

test("all six three-item orders are possible without changing the input", () => {
	const input = Object.freeze(["A", "B", "C"]);
	const orders = new Set<string>();
	const random = spyOn(Math, "random");
	try {
		for (const first of [0, 0.4, 0.9]) {
			for (const second of [0, 0.9]) {
				random.mockReturnValueOnce(first).mockReturnValueOnce(second);
				const result = shuffle(input);
				expect([...result].sort()).toEqual([...input]);
				orders.add(result.join(""));
			}
		}
		expect(orders.size).toBe(6);
		expect(input).toEqual(["A", "B", "C"]);
	} finally {
		random.mockRestore();
	}
});

test("empty and single-item lists retain their contents", () => {
	expect(shuffle([])).toEqual([]);
	expect(shuffle(["A"])).toEqual(["A"]);
});
