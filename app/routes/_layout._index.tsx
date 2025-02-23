import { useLoaderData } from "@remix-run/react";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo, useState } from "react";
import { calculateVotingResults, getGameUrls, type Result, } from "~/server/voting.server";
import type { Month, Nomination } from "~/types";
import SplitLayout, { Column } from "~/components/SplitLayout";
import GameCard from "~/components/GameCard";
import PitchesModal from "~/components/PitchesModal";
import ThemeCard from "~/components/ThemeCard";
import { getCurrentMonth } from "~/server/month.server";
import { getNominationsForMonth } from "~/server/nomination.server";

type LoaderData = {
    month: Month;
    results?: {
        long: Result[];
        short: Result[];
    };
    nominations?: {
        long: Nomination[];
        short: Nomination[];
    };
    gameUrls: Record<string, string>;
};

export const loader = async () => {
    const month = await getCurrentMonth();
    const gameUrls = getGameUrls(month.id);

    if (month.status === "nominating") {
        const nominations = await getNominationsForMonth(month.id);

        // Group nominations by type
        const nominationsByType = nominations.reduce(
            (acc, nom) => {
                const nomination = nom as unknown as Nomination;
                if (nomination.short) {
                    acc.short.push(nomination);
                } else {
                    acc.long.push(nomination);
                }
                return acc;
            },
            { short: [] as Nomination[], long: [] as Nomination[] },
        );

        return {
            month,
            nominations: nominationsByType,
            gameUrls,
        };
    }

    if (
        month.status === "voting" ||
        month.status === "over" ||
        month.status === "playing"
    ) {
        // Calculate results and get URLs in parallel
        const results = await Promise.all([
            calculateVotingResults(month.id, false),
            calculateVotingResults(month.id, true),
        ]).then(([long, short]) => ({ long, short }));

        return {
            month,
            results,
            gameUrls,
        };
    }

    // Default case: just return the month info
    return { month, results: undefined, gameUrls };
};

export default function Index() {
    const { month, results, nominations, gameUrls } =
        useLoaderData<LoaderData>();
    const [selectedNomination, setSelectedNomination] =
        useState<Nomination | null>(null);
    const [isViewingPitches, setIsViewingPitches] = useState(false);

    const longGamesCanvasId = useMemo(
        () => `longGamesChart-${month.month}-${month.year}`,
        [month],
    );
    const shortGamesCanvasId = useMemo(
        () => `shortGamesChart-${month.month}-${month.year}`,
        [month],
    );

    const renderNominationsList = (games: Nomination[]) => (
        <div className="space-y-4">
            {games.map((game) => (
                <GameCard
                    key={game.id}
                    game={game}
                    onViewPitches={() => {
                        setSelectedNomination(game);
                        setIsViewingPitches(true);
                    }}
                    pitchCount={game.pitches.length}
                    showPitchesButton={true}
                />
            ))}
        </div>
    );

    return (
        <>
            <div className="mx-auto">
                <div className="text-center space-y-2 mb-8">
                    {month.theme &&
                        <ThemeCard {...month} />
                    }
                </div>

                {month.status === "nominating" && nominations ? (
                    <SplitLayout
                        title="Current Nominations"
                        description="These games have been nominated for this month's Game of the Month."
                    >
                        <Column
                            title="Long Games"
                            statusBadge={{
                                text: `${nominations.long.length} nominations`,
                                isSuccess: nominations.long.length > 0,
                            }}
                        >
                            {renderNominationsList(nominations.long)}
                        </Column>

                        <Column
                            title="Short Games"
                            statusBadge={{
                                text: `${nominations.short.length} nominations`,
                                isSuccess: nominations.short.length > 0,
                            }}
                        >
                            {renderNominationsList(nominations.short)}
                        </Column>
                    </SplitLayout>
                ) : (
                    <div className="space-y-6">
                        <VotingResultsChart
                            canvasId={longGamesCanvasId}
                            results={results?.long || []}
                            gameUrls={gameUrls}
                        />
                        <VotingResultsChart
                            canvasId={shortGamesCanvasId}
                            results={results?.short || []}
                            gameUrls={gameUrls}
                        />
                    </div>
                )}
            </div>

            <PitchesModal
                isOpen={isViewingPitches}
                onClose={() => {
                    setSelectedNomination(null);
                    setIsViewingPitches(false);
                }}
                nomination={selectedNomination}
            />
        </>
    );
}
