import type { Nomination, Ranking } from "~/types";

export type VotingResult = {
	source: string;
	target: string;
	weight: string;
};

export type VoteWithRankings = {
	id: number;
	rankings: Ranking[];
};

/**
 * Calculates the Instant Runoff Voting results.
 * This is a pure function that does not depend on the database.
 */
export function calculateIRV(
	nominations: Nomination[],
	votes: VoteWithRankings[],
): VotingResult[] {
	const results: VotingResult[] = [];
	const graph = new Map<
		string,
		{ votes: number; edges: Map<string, number> }
	>();

	// Active candidates
	let activeNominations = [...nominations];
	
    // Map of voteId -> current preferred nomination ID
    // We track the index in the rankings array for each vote
    const voteState = new Map<number, { rankIndex: number }>();
    
    // Initialize vote state
    for (const vote of votes) {
        voteState.set(vote.id, { rankIndex: 0 });
    }

    // Set of eliminated nomination IDs for fast lookup
    const eliminatedIds = new Set<number>();

	let round = 1;

	while (activeNominations.length > 1) {
		// 1. Count votes for current round
		const currentVoteCounts = new Map<number, number>();

        // Initialize counts
        for (const nom of activeNominations) {
            currentVoteCounts.set(nom.id, 0);
        }

        // Tally votes
        for (const vote of votes) {
            const state = voteState.get(vote.id);
            if (!state) continue;

            // Find the first non-eliminated preference
            let currentNomId: number | null = null;
            
            while (state.rankIndex < vote.rankings.length) {
                const rank = vote.rankings[state.rankIndex];
                if (!eliminatedIds.has(rank.nominationId)) {
                    currentNomId = rank.nominationId;
                    break;
                }
                state.rankIndex++;
            }

            if (currentNomId !== null) {
                currentVoteCounts.set(currentNomId, (currentVoteCounts.get(currentNomId) || 0) + 1);
            }
        }

        // 2. Record graph state for this round
        for (const nom of activeNominations) {
            const count = currentVoteCounts.get(nom.id) || 0;
            const vertexId = `${nom.gameName}_${round}`;
            graph.set(vertexId, {
                votes: count,
                edges: new Map(),
            });
        }

		// 3. Find loser (lowest votes)
		// Calculate weighted scores for tie-breaking (Borda Count)
		// Score = Sum of (MaxRank - Rank) for all votes
		const weightedScores = new Map<number, number>();
		const maxRank = nominations.length; // Max possible rank is total number of candidates

		// Initialize scores
		for (const nom of activeNominations) {
			weightedScores.set(nom.id, 0);
		}

		// Calculate scores based on ALL votes (not just active ones, usually Borda is global)
		// However, for IRV tie-breaking, it's often better to use the current state or global state.
		// The original implementation used global state (all votes).
		for (const vote of votes) {
			for (const rank of vote.rankings) {
				// Only count if the candidate is still active?
				// Original implementation: "Calculate weighted scores using the inverse index... for const nom of nominations"
				// It calculated for ALL nominations, but we only care about active ones for sorting.
				if (weightedScores.has(rank.nominationId)) {
					// Rank is 1-based. Weight = MaxRank - (Rank - 1) = MaxRank - Rank + 1 ?
					// Original: rankWeights[i] = maxRank - i; (where i is 0-based index)
					// vote.rank is 1-based.
					// If rank=1, index=0, weight = maxRank.
					// If rank=maxRank, index=maxRank-1, weight = 1.
					// So Weight = maxRank - (rank - 1) = maxRank - rank + 1.
					// Wait, original code:
					// rankWeights[i] = maxRank - i;
					// if (vote.rank <= maxRank) sum += rankWeights[vote.rank - 1];
					// So if rank=1, weight = rankWeights[0] = maxRank. Correct.
					const weight = maxRank - rank.rank + 1;
					if (weight > 0) {
						weightedScores.set(
							rank.nominationId,
							(weightedScores.get(rank.nominationId) || 0) + weight,
						);
					}
				}
			}
		}

		activeNominations.sort((a, b) => {
			const countA = currentVoteCounts.get(a.id) || 0;
			const countB = currentVoteCounts.get(b.id) || 0;
			if (countA !== countB) {
				return countA - countB; // Ascending (loser first)
			}
			// Tie-breaker: Weighted Score (Ascending - lowest score loses)
			const scoreA = weightedScores.get(a.id) || 0;
			const scoreB = weightedScores.get(b.id) || 0;
			if (scoreA !== scoreB) {
				return scoreA - scoreB;
			}

			// Final Tie-breaker: ID
			return a.id - b.id;
		});

        const loser = activeNominations[0];
        const _loserCount = currentVoteCounts.get(loser.id) || 0;
        
        // 4. Eliminate loser
        eliminatedIds.add(loser.id);
        activeNominations = activeNominations.slice(1);

        // 5. Calculate transfers for graph edges
        // We need to see where the loser's votes go
        const transfers = new Map<number, number>();
        
        for (const vote of votes) {
            const state = voteState.get(vote.id);
            if (!state) continue;

            // If this vote was for the loser
            if (state.rankIndex < vote.rankings.length && 
                vote.rankings[state.rankIndex].nominationId === loser.id) {
                
                // Find next preference
                let nextNomId: number | null = null;
                let nextIndex = state.rankIndex + 1;
                
                while (nextIndex < vote.rankings.length) {
                    const rank = vote.rankings[nextIndex];
                    if (!eliminatedIds.has(rank.nominationId)) {
                        nextNomId = rank.nominationId;
                        break;
                    }
                    nextIndex++;
                }

                if (nextNomId !== null) {
                    transfers.set(nextNomId, (transfers.get(nextNomId) || 0) + 1);
                }
            }
        }

        // 6. Update graph edges
        const loserVertexId = `${loser.gameName}_${round}`;
        const loserVertex = graph.get(loserVertexId);

        if (loserVertex) {
             for (const winner of activeNominations) {
                const transferCount = transfers.get(winner.id) || 0;
                const winnerPrevCount = currentVoteCounts.get(winner.id) || 0;
                
                const nextRoundVertexId = `${winner.gameName}_${round + 1}`;
                
                // Ensure next round vertex exists (will be updated with full count next iteration, 
                // but we need it now for edges)
                // Actually, the next iteration will create the vertex. 
                // But we need to point to it.
                // The standard way to represent this graph is:
                // Node(Round N) -> Node(Round N+1)
                
                // Edge from Loser -> Winner (transferred votes)
                if (transferCount > 0) {
                     loserVertex.edges.set(nextRoundVertexId, transferCount);
                }

                // Edge from Winner -> Winner (kept votes)
                const winnerVertexId = `${winner.gameName}_${round}`;
                const winnerVertex = graph.get(winnerVertexId);
                if (winnerVertex) {
                    winnerVertex.edges.set(nextRoundVertexId, winnerPrevCount);
                }
             }
        }

		round++;
	}

    // Final winner
    if (activeNominations.length === 1) {
        const winner = activeNominations[0];
        // Calculate final count
        let finalCount = 0;
         for (const vote of votes) {
            const state = voteState.get(vote.id);
            if (!state) continue;
            
            // Check if current preference is the winner
             let currentNomId: number | null = null;
             let idx = state.rankIndex;
            while (idx < vote.rankings.length) {
                const rank = vote.rankings[idx];
                if (!eliminatedIds.has(rank.nominationId)) {
                    currentNomId = rank.nominationId;
                    break;
                }
                idx++;
            }
            
            if (currentNomId === winner.id) {
                finalCount++;
            }
        }

        const finalVertexId = `${winner.gameName}_${round}`;
        graph.set(finalVertexId, { votes: finalCount, edges: new Map() });
        
        // Link from previous round
        const prevVertexId = `${winner.gameName}_${round - 1}`;
        const prevVertex = graph.get(prevVertexId);
        if (prevVertex) {
             // The edge weight is the votes carried over
             // In the loop we set edges to "NextRound", so we might have already set this?
             // In the loop: "Edge from Winner -> Winner (kept votes)"
             // But the loop condition is activeNominations.length > 1.
             // So the last transition (2 -> 1) happened in the last loop execution.
             // The "nextRoundVertexId" was constructed with `round + 1`.
             // So the node `${winner.gameName}_${round}` should already be referenced by edges.
             // We just need to ensure it exists in the graph map with the correct vote count.
             // The loop creates nodes for the *current* round at the start.
             // So for the final round, we need to create the node manually here.
        }
    }

	// Convert graph to results format
	for (const [source, data] of graph) {
		const [sourceName, sourceRound] = source.split("_");
        const sourceRoundNum = parseInt(sourceRound);

		for (const [target, weight] of data.edges) {
			const [targetName, targetRound] = target.split("_");
            const targetRoundNum = parseInt(targetRound);
            
            // Add spaces for alignment (visual trick used in original code)
            const sourceSpaces = " ".repeat(Math.max(0, sourceRoundNum));
            const targetSpaces = " ".repeat(Math.max(0, targetRoundNum));

			results.push({
				source: `${sourceName} (${data.votes})${sourceSpaces}`,
				target: `${targetName} (${graph.get(target)?.votes || 0})${targetSpaces}`,
				weight: String(weight),
			});
		}
	}

	return results;
}
