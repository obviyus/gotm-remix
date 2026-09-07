export function shuffle<T>(items: readonly T[]): T[] {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index--) {
		const target = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
	}
	return shuffled;
}
