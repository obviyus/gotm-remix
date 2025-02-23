import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { VotingResultsChart } from "~/components/VotingResultsChart";
import { useMemo } from "react";
import type { Result } from "~/server/voting.server";
import { calculateVotingResults, getGameUrls, } from "~/server/voting.server";
import ThemeCard from "~/components/ThemeCard";
import type { Month } from "~/types";
import { getMonth } from "~/server/month.server";

type LoaderData = {
    month: Month;
    results: {
        long: Result[];
        short: Result[];
    };
    gameUrls: Record<string, string>;
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const monthId = Number(params.monthId);
    if (Number.isNaN(monthId)) {
        throw new Response("Invalid month ID", { status: 400 });
    }

    // Get theme information along with other data
    const [month, results, gameUrls] = await Promise.all([
        getMonth(monthId),
        Promise.all([
            calculateVotingResults(monthId, false),
            calculateVotingResults(monthId, true),
        ]).then(([long, short]) => ({ long, short })),
        getGameUrls(monthId),
    ]);

    return { month, results, gameUrls };
};

export default function HistoryMonth() {
    const { month, results, gameUrls } = useLoaderData<LoaderData>();

    const longGamesCanvasId = useMemo(
        () => `longGamesChart-${month.month}-${month.year}`,
        [month],
    );
    const shortGamesCanvasId = useMemo(
        () => `shortGamesChart-${month.month}-${month.year}`,
        [month],
    );

    return (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="text-center space-y-2 mb-8">
                {month.theme && <ThemeCard {...month} />}
            </div>

            <div className="space-y-6">
                <VotingResultsChart
                    canvasId={longGamesCanvasId}
                    results={results.long}
                    gameUrls={gameUrls}
                />
                <VotingResultsChart
                    canvasId={shortGamesCanvasId}
                    results={results.short}
                    gameUrls={gameUrls}
                />
            </div>
        </div>
    );
}
