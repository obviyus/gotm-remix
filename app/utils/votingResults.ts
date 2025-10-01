const VOTE_COUNT_SUFFIX = /\s*\(\d+\)\s*$/;

export interface VotingResultEdge {
	source: string;
	target: string;
}

export const getBaseGameName = (nodeName: string): string =>
	nodeName.replace(VOTE_COUNT_SUFFIX, "").trim();

export const getWinnerNode = <T extends VotingResultEdge>(
	results: T[],
): string | null => {
	if (results.length === 0) {
		return null;
	}

	const sourceNodes = new Set<string>();
	const targetNodes = new Set<string>();

	for (const { source, target } of results) {
		sourceNodes.add(source);
		targetNodes.add(target);
	}

	for (const candidate of targetNodes) {
		if (!sourceNodes.has(candidate)) {
			return candidate;
		}
	}

	return results[results.length - 1]?.target ?? null;
};

export const getWinnerName = <T extends VotingResultEdge>(
	results: T[],
): string | null => {
	const winnerNode = getWinnerNode(results);
	return winnerNode ? getBaseGameName(winnerNode) : null;
};

