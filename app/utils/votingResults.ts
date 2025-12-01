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

	// AIDEV-NOTE: Find all terminal nodes (targets that are never sources).
	// In IRV, both eliminated games AND the final winner are terminal nodes.
	// The winner is the terminal node from the FINAL round, identified by
	// having the most trailing spaces (round indicator in the node name).
	const terminalNodes: string[] = [];
	for (const candidate of targetNodes) {
		if (!sourceNodes.has(candidate)) {
			terminalNodes.push(candidate);
		}
	}

	if (terminalNodes.length === 0) {
		return results[results.length - 1]?.target ?? null;
	}

	if (terminalNodes.length === 1) {
		return terminalNodes[0];
	}

	// Multiple terminal nodes: pick the one from the latest round.
	// Round is indicated by trailing spaces count after the vote count.
	const getTrailingSpaces = (s: string): number => {
		const match = s.match(/\s*$/);
		return match ? match[0].length : 0;
	};

	return terminalNodes.reduce((best, current) =>
		getTrailingSpaces(current) > getTrailingSpaces(best) ? current : best,
	);
};

export const getWinnerName = <T extends VotingResultEdge>(
	results: T[],
): string | null => {
	const winnerNode = getWinnerNode(results);
	return winnerNode ? getBaseGameName(winnerNode) : null;
};

