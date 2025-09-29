import React from "react";
import type { Row } from "@libsql/client";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
	DatasetComponent,
	GridComponent,
	LegendComponent,
	TitleComponent,
	TooltipComponent,
	TransformComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { Card } from "~/components/ui/card";
import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";
import type { Route } from "./+types/stats";

const FULL_SIZE_STYLE = { width: "100%", height: "100%" } as const;

// Register ECharts components once globally for better performance
echarts.use([
	BarChart,
	PieChart,
	LineChart,
	TitleComponent,
	TooltipComponent,
	GridComponent,
	DatasetComponent,
	TransformComponent,
	LegendComponent,
	CanvasRenderer,
]);

// Custom hook for optimized ECharts instance management
function useOptimizedChart() {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	const initChart = useCallback(() => {
		if (!chartRef.current || chartInstanceRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
	}, []);

	const setOption = useCallback(
		(option: echarts.EChartsCoreOption) => {
			if (!chartInstanceRef.current) {
				initChart();
			}
			chartInstanceRef.current?.setOption(option, true); // notMerge=true for better performance
		},
		[initChart],
	);

	const dispose = useCallback(() => {
		if (chartInstanceRef.current) {
			chartInstanceRef.current.dispose();
			chartInstanceRef.current = null;
		}
	}, []);

	useEffect(() => {
		initChart();
		return dispose;
	}, [initChart, dispose]);

	return { chartRef, setOption, dispose };
}

// Type definitions
interface TopGamesFinalistStats {
	id: string;
	name: string;
	finalistNominations: number;
	nonFinalistNominations: number;
	totalNominations: number;
}

interface YearStats {
	year: string;
	count: number;
}

interface MonthlyParticipationStats {
	monthYear: string;
	nominators: number;
	voters: number;
	themeShort?: string | null;
}

interface JurySelectionStatsType {
	monthYear: string;
	selected: number;
	total: number;
	selectPercentage: number;
	themeShort?: string | null;
}

interface ShortVsLongStatsType {
	type: string;
	count: number;
	uniqueNominators: number;
}

interface WinnerByYearStats {
	year: string;
	count: number;
}

interface TopScoringNominationStats {
	game_name: string;
	count: number;
}

interface PowerNominatorStats {
	discord_id: string;
	winner_count: number;
	display_name: string;
}

interface PitchSuccessRateStats {
	category: string;
	win_rate: number;
	total_games: number;
}

interface VotingMarginStats {
	margin_category: string;
	count: number;
}

interface SpeedRunStats {
	game_name: string;
	game_year: string;
	win_date: string;
	days_to_win: number;
}

interface DiscordDynastyStats {
	discord_id: string;
	consecutive_months: number;
	streak_type: string;
	display_name: string;
}

interface MonthlyNominationCountStats {
	monthYear: string;
	count: number;
	themeShort?: string | null;
}

// Performance-critical data structures - keep flat and minimal for memory efficiency
// Type for stats loader data
type StatsLoaderData = {
	totalStats: {
		total_nominations: number;
		unique_games: number;
		total_votes: number;
		total_jury_members: number;
		total_nominators: number;
		total_voters: number;
		total_pitches: number;
		total_winners: number;
	};
	topGamesFinalist: TopGamesFinalistStats[];
	yearStats: YearStats[];
	monthlyStats: MonthlyParticipationStats[];
	jurySelectionStats: JurySelectionStatsType[];
	shortVsLong: ShortVsLongStatsType[];
	winnersByYear: WinnerByYearStats[];
	topScoringNominations: TopScoringNominationStats[];
	powerNominators: PowerNominatorStats[];
	pitchSuccessRate: PitchSuccessRateStats[];
	votingMargins: VotingMarginStats[];
	speedRuns: SpeedRunStats[];
	discordDynasties: DiscordDynastyStats[];
	monthlyNominationCounts: MonthlyNominationCountStats[];
};

// Critical performance bottleneck - 13 parallel DB queries optimized to 3 strategic ones
export async function loader(): Promise<StatsLoaderData> {
	// Reduced from 13 parallel queries to 3 optimized mega-queries for better performance
	const [coreStatsResult, gameStatsResult, userStatsResult] = await Promise.all(
		[
			// Mega-query 1: Core stats with all totals and basic aggregations in single query
			db.execute({
				sql: `WITH
				total_stats AS (
					SELECT
						COUNT(*) AS total_nominations,
						COUNT(DISTINCT game_id) AS unique_games,
						COUNT(DISTINCT discord_id) AS total_nominators,
						SUM(CASE WHEN short = 1 THEN 1 ELSE 0 END) AS short_count,
						SUM(CASE WHEN short = 0 THEN 1 ELSE 0 END) AS long_count,
						COUNT(DISTINCT CASE WHEN short = 1 THEN discord_id END) AS short_nominators,
						COUNT(DISTINCT CASE WHEN short = 0 THEN discord_id END) AS long_nominators
					FROM nominations
				),
				vote_stats AS (
					SELECT
						COUNT(*) AS total_votes,
						COUNT(DISTINCT discord_id) AS total_voters
					FROM votes
				),
				other_stats AS (
					SELECT
						(SELECT COUNT(DISTINCT discord_id) FROM jury_members WHERE active = 1) AS total_jury_members,
						(SELECT COUNT(*) FROM pitches) AS total_pitches,
						(SELECT COUNT(*) FROM winners) AS total_winners
				),
				year_stats AS (
					SELECT 
						game_year,
						COUNT(*) as nomination_count
					FROM nominations
					WHERE game_year IS NOT NULL AND game_year != '' AND game_year != 'null'
					GROUP BY game_year
					ORDER BY game_year ASC
				),
				monthly_stats AS (
					SELECT 
						m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
						COALESCE(t.name, NULL) AS theme_name,
						-- Use DISTINCT to avoid fan-out from joining votes inflating counts
						COUNT(DISTINCT CASE WHEN n.discord_id IS NOT NULL THEN n.discord_id END) AS nominators,
						COUNT(DISTINCT CASE WHEN v.discord_id IS NOT NULL THEN v.discord_id END) AS voters,
						COUNT(DISTINCT n.id) AS nomination_count,
						COUNT(DISTINCT CASE WHEN n.jury_selected = 1 THEN n.id END) AS selected,
						COUNT(DISTINCT n.id) AS total
					FROM months m
					LEFT JOIN themes t ON m.theme_id = t.id
					LEFT JOIN nominations n ON m.id = n.month_id
					LEFT JOIN votes v ON m.id = v.month_id
					GROUP BY m.id, m.year, m.month
					ORDER BY m.year, m.month
				)
			SELECT 'totals' as query_type, total_nominations, unique_games, total_nominators, short_count, long_count, short_nominators, long_nominators, NULL as theme_name FROM total_stats
			UNION ALL
			SELECT 'votes' as query_type, total_votes as total_nominations, NULL as unique_games, total_voters as total_nominators, NULL as short_count, NULL as long_count, NULL as short_nominators, NULL as long_nominators, NULL as theme_name FROM vote_stats
			UNION ALL
			SELECT 'other' as query_type, total_jury_members as total_nominations, total_pitches as unique_games, total_winners as total_nominators, NULL as short_count, NULL as long_count, NULL as short_nominators, NULL as long_nominators, NULL as theme_name FROM other_stats
			UNION ALL
			SELECT 'year_' || game_year as query_type, nomination_count as total_nominations, NULL as unique_games, NULL as total_nominators, NULL as short_count, NULL as long_count, NULL as short_nominators, NULL as long_nominators, NULL as theme_name FROM year_stats
			UNION ALL
			SELECT 'monthly_' || monthYear as query_type, nomination_count as total_nominations, voters as unique_games, nominators as total_nominators, selected as short_count, total as long_count, NULL as short_nominators, NULL as long_nominators, theme_name FROM monthly_stats`,
			}),

			// Mega-query 2: Game-related stats with optimized joins and CTEs
			db.execute({
				sql: `WITH
				top_scoring AS (
					SELECT 
						n.game_name, 
						COUNT(r.vote_id) AS count
					FROM nominations n
					JOIN rankings r ON r.nomination_id = n.id
					WHERE r.rank = 1
					GROUP BY n.game_name
					HAVING count >= 2
					ORDER BY count DESC
					LIMIT 10
				),
				top_games AS (
					SELECT
						game_id,
						game_name,
						SUM(CASE WHEN jury_selected = 1 THEN 1 ELSE 0 END) as finalist_nominations,
						SUM(CASE WHEN jury_selected = 0 THEN 1 ELSE 0 END) as non_finalist_nominations,
						COUNT(*) as total_nominations
					FROM nominations
					GROUP BY game_id, game_name
					ORDER BY total_nominations DESC
					LIMIT 10
				),
				winners_by_year AS (
					SELECT 
						game_year, 
						COUNT(*) AS count 
					FROM winners
					WHERE game_year IS NOT NULL AND game_year != '' AND game_year != 'null'
					GROUP BY game_year
					ORDER BY game_year ASC
				),
				pitch_success AS (
					SELECT 
						n.game_id,
						n.game_name,
						CASE WHEN COUNT(p.id) > 0 THEN 1 ELSE 0 END as has_pitch,
						MAX(CASE WHEN w.game_id IS NOT NULL THEN 1 ELSE 0 END) as is_winner
					FROM nominations n
					LEFT JOIN pitches p ON n.id = p.nomination_id
					LEFT JOIN winners w ON n.game_id = w.game_id
					WHERE n.jury_selected = 1
					GROUP BY n.game_id, n.game_name
				),
				pitch_rates AS (
					SELECT 
						CASE WHEN has_pitch = 1 THEN 'With Pitches' ELSE 'Without Pitches' END as category,
						ROUND(AVG(is_winner) * 100, 1) as win_rate,
						COUNT(*) as total_games
					FROM pitch_success
					GROUP BY has_pitch
				),
				vote_scores AS (
					SELECT 
						n.month_id,
						n.game_id,
						n.game_name,
						n.short,
						COUNT(CASE WHEN r.rank = 1 THEN 1 END) * 3 +
						COUNT(CASE WHEN r.rank = 2 THEN 1 END) * 2 +
						COUNT(CASE WHEN r.rank = 3 THEN 1 END) * 1 as score
					FROM nominations n
					JOIN rankings r ON n.id = r.nomination_id
					WHERE n.jury_selected = 1
					GROUP BY n.month_id, n.game_id, n.game_name, n.short
				),
				monthly_winners AS (
					SELECT 
						month_id,
						short,
						game_id,
						game_name,
						score,
						ROW_NUMBER() OVER (PARTITION BY month_id, short ORDER BY score DESC) as position
					FROM vote_scores
				),
				margins AS (
					SELECT 
						w1.month_id,
						w1.short,
						w1.score - COALESCE(w2.score, 0) as margin,
						(w1.score - COALESCE(w2.score, 0)) * 100.0 / w1.score as margin_percentage
					FROM monthly_winners w1
					LEFT JOIN monthly_winners w2 ON w1.month_id = w2.month_id 
						AND w1.short = w2.short 
						AND w2.position = 2
					WHERE w1.position = 1 AND w1.score > 0
				),
				voting_margins AS (
					SELECT 
						CASE 
							WHEN margin_percentage >= 50 THEN 'Landslide (50%+)'
							WHEN margin_percentage >= 30 THEN 'Clear Victory (30-50%)'
							WHEN margin_percentage >= 15 THEN 'Competitive (15-30%)'
							ELSE 'Nail-biter (<15%)'
						END as margin_category,
						COUNT(*) as count
					FROM margins
					GROUP BY margin_category
				),
				speed_runs AS (
					SELECT 
						w.game_name,
						w.game_year,
						m.year || '-' || PRINTF('%02d', m.month) as win_date,
						CAST(julianday(m.year || '-' || PRINTF('%02d', m.month) || '-01') - 
							 julianday(w.game_year || '-01-01') AS INTEGER) as days_to_win
					FROM winners w
					JOIN months m ON w.month_id = m.id
					WHERE w.game_year IS NOT NULL 
						AND w.game_year != ''
						AND w.game_year != 'null'
						AND CAST(w.game_year AS INTEGER) < m.year
					ORDER BY days_to_win ASC
					LIMIT 10
				)
			SELECT 'top_scoring' as query_type, game_name, count as value1, NULL as value2, NULL as value3, NULL as value4 FROM top_scoring
			UNION ALL
			SELECT 'top_games' as query_type, game_id || '|' || game_name, finalist_nominations as value1, non_finalist_nominations as value2, total_nominations as value3, NULL as value4 FROM top_games
			UNION ALL
			SELECT 'winners_year' as query_type, game_year, count as value1, NULL as value2, NULL as value3, NULL as value4 FROM winners_by_year
			UNION ALL
			SELECT 'pitch_rates' as query_type, category, win_rate as value1, total_games as value2, NULL as value3, NULL as value4 FROM pitch_rates
			UNION ALL
			SELECT 'voting_margins' as query_type, margin_category, count as value1, NULL as value2, NULL as value3, NULL as value4 FROM voting_margins
			UNION ALL
			SELECT 'speed_runs' as query_type, game_name, days_to_win as value1, NULL as value2, game_year as value3, win_date as value4 FROM speed_runs`,
			}),
			// Mega-query 3: User-related stats with optimized aggregations
			db.execute({
				sql: `WITH
				power_nominators AS (
					SELECT 
						n.discord_id,
						COUNT(DISTINCT w.game_id) as winner_count
					FROM nominations n
					JOIN winners w ON n.game_id = w.game_id
					GROUP BY n.discord_id
					ORDER BY winner_count DESC
					LIMIT 10
				),
				monthly_participation AS (
					SELECT DISTINCT
						discord_id,
						month_id
					FROM votes
					UNION
					SELECT DISTINCT
						discord_id,
						month_id
					FROM nominations
				),
				user_months AS (
					SELECT 
						mp.discord_id,
						mp.month_id,
						m.year,
						m.month,
						ROW_NUMBER() OVER (PARTITION BY mp.discord_id ORDER BY m.year, m.month) as rn
					FROM monthly_participation mp
					JOIN months m ON mp.month_id = m.id
				),
				streaks AS (
					SELECT 
						discord_id,
						year,
						month,
						rn,
						year * 12 + month - rn as streak_group
					FROM user_months
				),
				consecutive_streaks AS (
					SELECT 
						discord_id,
						streak_group,
						COUNT(*) as consecutive_months,
						MIN(year || '-' || PRINTF('%02d', month)) as start_month,
						MAX(year || '-' || PRINTF('%02d', month)) as end_month
					FROM streaks
					GROUP BY discord_id, streak_group
				),
				discord_dynasties AS (
					SELECT 
						discord_id,
						consecutive_months,
						'Participation' as streak_type
					FROM consecutive_streaks
					ORDER BY consecutive_months DESC
					LIMIT 10
				)
			SELECT 'power_nominators' as query_type, discord_id, winner_count as value1, NULL as value2 FROM power_nominators
			UNION ALL
			SELECT 'discord_dynasties' as query_type, discord_id, consecutive_months as value1, streak_type as value2 FROM discord_dynasties`,
			}),
		],
	);

	// Optimized data transformation with pre-allocated structures and minimized iterations
	// Process core stats mega-query result
	const coreData = new Map<string, Row>();
	for (const row of coreStatsResult.rows) {
		coreData.set(row.query_type as string, row);
	}

	const totalsRow = coreData.get("totals");
	const votesRow = coreData.get("votes");
	const otherRow = coreData.get("other");

	if (!totalsRow || !votesRow || !otherRow) {
		throw new Error("Missing core data");
	}

	const totalStats = {
		total_nominations: Number(totalsRow.total_nominations),
		unique_games: Number(totalsRow.unique_games),
		total_votes: Number(votesRow.total_nominations), // mapped from vote stats
		total_jury_members: Number(otherRow.total_nominations), // mapped from other stats
		total_nominators: Number(totalsRow.total_nominators),
		total_voters: Number(votesRow.total_nominators), // mapped from vote stats
		total_pitches: Number(otherRow.unique_games), // mapped from other stats
		total_winners: Number(otherRow.total_nominators), // mapped from other stats
	};

	// Extract year stats from core data
	const yearStats: YearStats[] = [];
	const monthlyStats: MonthlyParticipationStats[] = [];
	const jurySelectionStats: JurySelectionStatsType[] = [];
	const monthlyNominationCounts: MonthlyNominationCountStats[] = [];
	const shortVsLong: ShortVsLongStatsType[] = [
		{
			type: "Short Games",
			count: Number(totalsRow.short_count),
			uniqueNominators: Number(totalsRow.short_nominators),
		},
		{
			type: "Long Games",
			count: Number(totalsRow.long_count),
			uniqueNominators: Number(totalsRow.long_nominators),
		},
	];

	for (const [key, row] of coreData) {
		if (key.startsWith("year_")) {
			yearStats.push({
				year: key.substring(5),
				count: Number(row.total_nominations),
			});
		} else if (key.startsWith("monthly_")) {
			const monthYear = key.substring(8);
			monthlyStats.push({
				monthYear,
				nominators: Number(row.total_nominators),
				voters: Number(row.unique_games),
				themeShort: (row as any).theme_name ?? null,
			});
			jurySelectionStats.push({
				monthYear,
				selected: Number(row.short_count),
				total: Number(row.long_count),
				selectPercentage:
					Number(row.long_count) > 0
						? Math.round(
							(Number(row.short_count) / Number(row.long_count)) * 100,
						)
						: 0,
				themeShort: (row as any).theme_name ?? null,
			});
			monthlyNominationCounts.push({
				monthYear,
				count: Number(row.total_nominations),
				themeShort: (row as any).theme_name ?? null,
			});
		}
	}

	// Process game stats mega-query result
	const gameData = new Map<string, Row[]>();
	for (const row of gameStatsResult.rows) {
		const type = row.query_type as string;
		if (!gameData.has(type)) {
			gameData.set(type, []);
		}
		const typeArray = gameData.get(type);
		if (typeArray) {
			typeArray.push(row);
		}
	}

	const topScoringNominations: TopScoringNominationStats[] = [];
	const topGamesFinalist: TopGamesFinalistStats[] = [];
	const winnersByYear: WinnerByYearStats[] = [];
	const pitchSuccessRate: PitchSuccessRateStats[] = [];
	const votingMargins: VotingMarginStats[] = [];
	const speedRuns: SpeedRunStats[] = [];

	for (const [type, rows] of gameData) {
		switch (type) {
			case "top_scoring":
				for (const row of rows) {
					topScoringNominations.push({
						game_name: String(row.game_name),
						count: Number(row.value1),
					});
				}
				break;
			case "top_games":
				for (const row of rows) {
					const [id, name] = (row.game_name as string).split("|");
					topGamesFinalist.push({
						id,
						name,
						finalistNominations: Number(row.value1),
						nonFinalistNominations: Number(row.value2),
						totalNominations: Number(row.value3),
					});
				}
				break;
			case "winners_year":
				for (const row of rows) {
					winnersByYear.push({
						year: String(row.game_name),
						count: Number(row.value1),
					});
				}
				break;
			case "pitch_rates":
				for (const row of rows) {
					pitchSuccessRate.push({
						category: String(row.game_name),
						win_rate: Number(row.value1),
						total_games: Number(row.value2),
					});
				}
				break;
			case "voting_margins":
				for (const row of rows) {
					votingMargins.push({
						margin_category: String(row.game_name),
						count: Number(row.value1),
					});
				}
				break;
			case "speed_runs":
				for (const row of rows) {
					speedRuns.push({
						game_name: String(row.game_name),
						game_year: String(row.value3),
						win_date: String(row.value4),
						days_to_win: Number(row.value1),
					});
				}
				break;
		}
	}

	// Process user stats mega-query result
	const userData = new Map<string, Row[]>();
	for (const row of userStatsResult.rows) {
		const type = row.query_type as string;
		if (!userData.has(type)) {
			userData.set(type, []);
		}

		const typeArray = userData.get(type);
		if (typeArray) {
			typeArray.push(row);
		}
	}

	const powerNominators: PowerNominatorStats[] = [];
	const discordDynasties: DiscordDynastyStats[] = [];

	for (const [type, rows] of userData) {
		switch (type) {
			case "power_nominators":
				for (const row of rows) {
					powerNominators.push({
						discord_id: String(row.discord_id),
						winner_count: Number(row.value1),
						display_name: uniqueNameGenerator(String(row.discord_id)),
					});
				}
				break;
			case "discord_dynasties":
				for (const row of rows) {
					discordDynasties.push({
						discord_id: String(row.discord_id),
						consecutive_months: Number(row.value1),
						streak_type: String(row.value2),
						display_name: uniqueNameGenerator(String(row.discord_id)),
					});
				}
				break;
		}
	}

	const result: StatsLoaderData = {
		totalStats,
		topGamesFinalist,
		yearStats,
		monthlyStats,
		jurySelectionStats,
		shortVsLong,
		winnersByYear,
		topScoringNominations,
		powerNominators,
		pitchSuccessRate,
		votingMargins,
		speedRuns,
		discordDynasties,
		monthlyNominationCounts,
	};

	return result;
}

// Main component optimized for minimal re-renders - data is pre-processed in loader
export default function StatsPage({ loaderData }: Route.ComponentProps) {
	// Generate unique IDs for accessibility
	const overviewId = useId();
	const gamesId = useId();
	const participationId = useId();
	const juryId = useId();
	const winnersId = useId();
	const funStatsId = useId();

	// Destructure once to avoid object property access in render
	const {
		totalStats,
		topGamesFinalist,
		yearStats,
		monthlyStats,
		jurySelectionStats,
		shortVsLong,
		winnersByYear,
		topScoringNominations,
		powerNominators,
		pitchSuccessRate,
		votingMargins,
		speedRuns,
		discordDynasties,
		monthlyNominationCounts,
	} = loaderData;

	return (
		<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12 text-white">
			{/* Overview Section */}
			<section aria-labelledby={overviewId}>
				<h2 id={overviewId} className="text-2xl font-semibold text-white mb-6">
					Overall Stats
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Total Nominations
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_nominations}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Unique Nominations
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.unique_games}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Total Votes Cast
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_votes}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Total Pitches Submitted
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_pitches}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Total Winners Selected
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_winners}
						</p>
					</Card>
				</div>
			</section>

			{/* Games Section */}
			<section aria-labelledby={gamesId}>
				<h2 id={gamesId} className="text-2xl font-semibold text-white mb-6">
					Game Insights
				</h2>
				<div className="mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-8 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Top Nominated Games (Jury Selected vs Not Selected)
						</h3>
						<div className="h-full">
							<TopGamesFinalistChart data={topGamesFinalist} />
						</div>
					</Card>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Nominations by Game Release Year
						</h3>
						<div className="h-full">
							<YearlyNominationsChart data={yearStats} />
						</div>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Short vs. Long Game Nominations
						</h3>
						<div className="h-full">
							<ShortVsLongChart data={shortVsLong} />
						</div>
					</Card>
				</div>
			</section>

			{/* Participation Section */}
			<section aria-labelledby={participationId}>
				<h2
					id={participationId}
					className="text-2xl font-semibold text-white mb-6"
				>
					Community Participation
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Unique Nominators
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_nominators}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Unique Voters
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_voters}
						</p>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
						<h3 className="text-zinc-400 text-sm font-medium mb-1.5">
							Active Jury Members
						</h3>
						<p className="text-3xl font-bold text-white">
							{totalStats.total_jury_members}
						</p>
					</Card>
				</div>
				<div className="w-full">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Monthly Participation (Nominators vs Voters)
						</h3>
						<div className="h-full">
							<ParticipationChart data={monthlyStats} />
						</div>
					</Card>
				</div>
			</section>

			{/* Jury Section */}
			<section aria-labelledby={juryId}>
				<h2 id={juryId} className="text-2xl font-semibold text-white mb-6">
					Jury Insights
				</h2>
				<div className="grid grid-cols-1 gap-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Monthly Jury Selection Counts
						</h3>
						<div className="h-full">
							<JurySelectionChart data={jurySelectionStats} />
						</div>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Monthly Jury Selection Percentage
						</h3>
						<div className="h-full">
							<JurySelectionPercentageChart data={jurySelectionStats} />
						</div>
					</Card>
				</div>
			</section>

			{/* Winners Section */}
			<section aria-labelledby={winnersId}>
				<h2 id={winnersId} className="text-2xl font-semibold text-white mb-6">
					Winners Insights
				</h2>
				<div className="grid grid-cols-1 gap-8 mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Games with Most First Place Votes
						</h3>
						<div className="h-full">
							<TopScoringNominationsChart data={topScoringNominations} />
						</div>
					</Card>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Winners by Release Year
						</h3>
						<div className="h-full">
							<WinnersByYearChart data={winnersByYear} />
						</div>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Victory Margins
						</h3>
						<div className="h-full">
							<VotingMarginsChart data={votingMargins} />
						</div>
					</Card>
				</div>
			</section>

			{/* Fun Stats Section */}
			<section aria-labelledby={funStatsId}>
				<h2 id={funStatsId} className="text-2xl font-semibold text-white mb-6">
					Fun Stats
				</h2>

				{/* Speed Runs */}
				{speedRuns.length > 0 && (
					<div className="mb-8">
						<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700">
							<h3 className="text-zinc-200 text-lg font-semibold mb-4">
								Fastest time from Release to Win
							</h3>
							<div className="space-y-3">
								<p className="text-zinc-400 text-sm mb-4">
									Games that won GOTM shortly after release
								</p>
								{speedRuns.slice(0, 5).map((game) => (
									<div
										key={game.game_name}
										className="flex items-center justify-between p-3 bg-zinc-700/50 rounded-lg"
									>
										<div className="flex-1">
											<p className="text-white font-medium">{game.game_name}</p>
											<p className="text-zinc-400 text-sm">
												Released: {game.game_year}
											</p>
										</div>
										<div className="text-right">
											<p className="text-sky-400 font-medium">
												{Math.round(game.days_to_win / 365)} years
											</p>
											<p className="text-zinc-400 text-sm">
												({game.days_to_win} days)
											</p>
										</div>
									</div>
								))}
							</div>
						</Card>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Nominators with Most Wins
						</h3>
						<div className="h-full">
							<PowerNominatorsChart data={powerNominators} />
						</div>
					</Card>
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Pitch Success Rate
						</h3>
						<div className="h-full">
							<PitchSuccessRateChart data={pitchSuccessRate} />
						</div>
					</Card>
				</div>

				{/* Discord Dynasties */}
				<div className="mb-8">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Longest Participation Streaks
						</h3>
						<div className="space-y-3">
							<p className="text-zinc-400 text-sm mb-4">
								Users with the longest consecutive months of participation
							</p>
							{discordDynasties.slice(0, 5).map((user) => (
								<div
									key={user.discord_id}
									className="flex items-center justify-between p-3 bg-zinc-700/50 rounded-lg"
								>
									<p className="text-white font-medium">{user.display_name}</p>
									<p className="text-sky-400 font-medium">
										{user.consecutive_months} months
									</p>
								</div>
							))}
						</div>
					</Card>
				</div>

				<div className="w-full">
					<Card className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 h-96">
						<h3 className="text-zinc-200 text-lg font-semibold mb-4">
							Monthly Nominations Trend
						</h3>
						<div className="h-full">
							<MonthlyNominationCountsChart data={monthlyNominationCounts} />
						</div>
					</Card>
				</div>
			</section>
		</div>
	);
}

// Memoized month-year formatter to avoid repeated Date object creation
const formatMonthYearCache = new Map<string, string>();
function formatMonthYear(monthYear: string): string {
	const cached = formatMonthYearCache.get(monthYear);
	if (cached) {
		return cached;
	}

	const [year, month] = monthYear.split("-");
	const date = new Date(
		Number.parseInt(year, 10),
		Number.parseInt(month, 10) - 1,
	);
	const formatted = date.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
	formatMonthYearCache.set(monthYear, formatted);
	return formatted;
}

// Optimized chart components with memoization and reduced re-renders
// Chart Components
function YearlyNominationsChart({ data }: { data: YearStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Memoize filtered data to avoid recomputation on every render
	const validData = useMemo(() => {
		return data.filter(
			(item) =>
				item.year &&
				item.year !== "null" &&
				item.year !== "undefined" &&
				!Number.isNaN(Number(item.year)),
		);
	}, [data]);

	// Memoize chart configuration to prevent unnecessary object creation
	const chartConfig = useMemo(
		() => ({
			tooltip: {
				trigger: "axis" as const,
				axisPointer: { type: "shadow" as const },
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "12%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category" as const,
				data: validData.map((item) => item.year),
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value" as const,
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Nominations",
					type: "bar" as const,
					barWidth: "60%",
					data: validData.map((item) => item.count),
					itemStyle: {
						color: "#4ade80",
					},
				},
			],
		}),
		[validData],
	);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		chartInstanceRef.current.setOption(chartConfig);

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [chartConfig]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function ParticipationChart({ data }: { data: MonthlyParticipationStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Memoize filtered data to avoid O(n²) filtering on every render
	const filteredData = useMemo(() => {
		let foundParticipation = false;
		return data.filter((item) => {
			const hasParticipation = item.nominators > 0 || item.voters > 0;
			if (hasParticipation) foundParticipation = true;
			return foundParticipation;
		});
	}, [data]);

	// Pre-compute formatted labels to avoid repeated formatting
	const formattedLabels = useMemo(
		() => filteredData.map((item) => formatMonthYear(item.monthYear)),
		[filteredData],
	);

	// Pre-extract data arrays
	const nominatorData = useMemo(
		() => filteredData.map((item) => item.nominators),
		[filteredData],
	);
	const voterData = useMemo(
		() => filteredData.map((item) => item.voters),
		[filteredData],
	);
	const themeLabels = useMemo(
		() => filteredData.map((item) => item.themeShort ?? ""),
		[filteredData],
	);

	const chartConfig = useMemo(
		() => ({
			tooltip: {
				trigger: "axis" as const,
				axisPointer: { type: "shadow" as const },
				formatter: (params: unknown) => {
					const items = params as Array<{
						axisValue: string;
						seriesName: string;
						value: number;
						marker: string;
						dataIndex: number;
					}>;
					if (!Array.isArray(items) || items.length === 0) return "";
					const idx = items[0].dataIndex;
					const month = items[0].axisValue;
					const theme = themeLabels[idx];
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					return `${header}<br/>${lines}`;
				},
			},
			legend: {
				data: ["Nominators", "Voters"],
				textStyle: { color: "#94a3b8" },
				top: 10,
				padding: [5, 10],
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "16%",
				top: "12%",
				containLabel: true,
			},
			xAxis: {
				type: "category" as const,
				data: formattedLabels,
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value" as const,
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Nominators",
					type: "line" as const,
					data: nominatorData,
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#34d399" },
					symbolSize: 8,
				},
				{
					name: "Voters",
					type: "line" as const,
					data: voterData,
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#fbbf24" },
					symbolSize: 8,
				},
			],
		}),
		[formattedLabels, nominatorData, voterData, themeLabels],
	);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		chartInstanceRef.current.setOption(chartConfig);

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [chartConfig]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function JurySelectionChart({ data }: { data: JurySelectionStatsType[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out leading months with zero nominations
		const filteredData = data.filter((item, index) => {
			if (index === 0) return item.total > 0;
			const anyPreviousNominations = data
				.slice(0, index)
				.some((prev) => prev.total > 0);
			return anyPreviousNominations || item.total > 0;
		});

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown) => {
					const items = params as Array<{
						axisValue: string;
						seriesName: string;
						value: number;
						marker: string;
						dataIndex: number;
					}>;
					if (!Array.isArray(items) || items.length === 0) return "";
					const idx = items[0].dataIndex;
					const month = items[0].axisValue;
					const theme = filteredData[idx]?.themeShort ?? "";
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					return `${header}<br/>${lines}`;
				},
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "12%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: filteredData.map((item) => formatMonthYear(item.monthYear)),
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value",
				name: "Games",
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Total Nominations",
					type: "bar",
					stack: "games",
					itemStyle: { color: "#94a3b8" },
					data: filteredData.map((item) => item.total),
				},
				{
					name: "Selected by Jury",
					type: "bar",
					stack: "games",
					itemStyle: { color: "#34d399" },
					data: filteredData.map((item) => item.selected),
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function JurySelectionPercentageChart({
	data,
}: {
	data: JurySelectionStatsType[];
}) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out leading months with zero nominations
		const filteredData = data.filter((item, index) => {
			if (index === 0) return item.total > 0;
			const anyPreviousNominations = data
				.slice(0, index)
				.some((prev) => prev.total > 0);
			return anyPreviousNominations || item.total > 0;
		});

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown) => {
					const items = params as Array<{
						axisValue: string;
						seriesName: string;
						value: number;
						marker: string;
						dataIndex: number;
					}>;
					if (!Array.isArray(items) || items.length === 0) return "";
					const idx = items[0].dataIndex;
					const month = items[0].axisValue;
					const theme = filteredData[idx]?.themeShort ?? "";
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					return `${header}<br/>${lines}`;
				},
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "12%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: filteredData.map((item) => formatMonthYear(item.monthYear)),
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value",
				name: "Selection %",
				min: 0,
				max: 100,
				axisLabel: {
					color: "#94a3b8",
					formatter: "{value}%",
				},
			},
			series: [
				{
					name: "Selection Percentage",
					type: "line",
					data: filteredData.map((item) => item.selectPercentage),
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#fbbf24" },
					markLine: {
						data: [
							{
								type: "average",
								name: "Average",
								lineStyle: { color: "#34d399" },
							},
						],
					},
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function ShortVsLongChart({ data }: { data: ShortVsLongStatsType[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "item",
				formatter: "{a} <br/>{b}: {c} ({d}%)",
			},
			legend: {
				orient: "horizontal",
				top: "0",
				data: data.map((item) => item.type),
				textStyle: { color: "#fff", fontSize: 14 },
			},
			series: [
				{
					name: "Nominations",
					type: "pie",
					radius: ["50%", "70%"],
					avoidLabelOverlap: false,
					label: {
						show: false,
					},
					labelLine: {
						show: false,
					},
					data: data.map((item) => ({
						value: item.count,
						name: item.type,
						itemStyle: {
							color: item.type === "Short Games" ? "#34d399" : "#fbbf24",
						},
					})),
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function WinnersByYearChart({ data }: { data: WinnerByYearStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out invalid year values
		const validData = data.filter(
			(item) =>
				item.year &&
				item.year !== "null" &&
				item.year !== "undefined" &&
				!Number.isNaN(Number(item.year)),
		);

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "12%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: validData.map((item) => item.year),
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value",
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Winners",
					type: "bar",
					barWidth: "60%",
					data: validData.map((item) => item.count),
					itemStyle: {
						color: "#34d399", // Green to match other charts
					},
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function TopScoringNominationsChart({
	data,
}: {
	data: TopScoringNominationStats[];
}) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Find max score for better scaling
		const maxCount = Math.max(...data.map((item) => item.count));

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown[]) => {
					// Type assertion for the ECharts tooltip parameters
					const item = params[0] as {
						name: string;
						value: number;
					};
					return `${item.name}<br/>First Place Votes: ${item.value}`;
				},
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "16%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "value",
				axisLabel: { color: "#94a3b8" },
				name: "First Place Votes",
				nameLocation: "middle",
				nameGap: 30,
				nameTextStyle: { color: "#94a3b8" },
				max: maxCount * 1.1, // Add some padding
			},
			yAxis: {
				type: "category",
				data: data.map((item) => item.game_name),
				axisTick: { alignWithLabel: true },
				axisLabel: {
					color: "#94a3b8",
					formatter: (value: string) => {
						return value.length > 25 ? `${value.substring(0, 22)}...` : value;
					},
				},
			},
			series: [
				{
					name: "First Place Votes",
					type: "bar",
					barWidth: "60%",
					data: data.map((item) => item.count),
					itemStyle: {
						color: "#fbbf24", // Yellow to be consistent
					},
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function TopGamesFinalistChart({ data }: { data: TopGamesFinalistStats[] }) {
	const { chartRef, setOption } = useOptimizedChart();

	// Pre-compute data arrays to avoid repeated mapping
	const gameNames = useMemo(() => data.map((item) => item.name), [data]);
	const finalistData = useMemo(
		() => data.map((item) => item.finalistNominations),
		[data],
	);
	const nonFinalistData = useMemo(
		() => data.map((item) => item.nonFinalistNominations),
		[data],
	);

	const chartConfig = useMemo(
		() => ({
			tooltip: {
				trigger: "axis" as const,
				axisPointer: {
					type: "shadow" as const,
				},
				backgroundColor: "rgba(31, 41, 55, 0.8)",
				borderColor: "rgba(55, 65, 81, 1)",
				textStyle: {
					color: "#e5e7eb",
				},
			},
			legend: {
				data: ["Jury Selected", "Not Selected"],
				textStyle: {
					color: "#d1d5db",
				},
				top: "2%",
				left: "center",
				orient: "horizontal" as const,
			},
			grid: {
				left: "5%",
				right: "5%",
				bottom: "15%",
				top: "15%",
				containLabel: true,
			},
			xAxis: [
				{
					type: "category" as const,
					data: gameNames,
					axisLabel: {
						color: "#9ca3af",
						interval: 0,
						rotate: 30,
						fontSize: 11,
						overflow: "truncate" as const,
						width: 120,
					},
					axisLine: {
						lineStyle: {
							color: "#4b5563",
						},
					},
				},
			],
			yAxis: [
				{
					type: "value" as const,
					name: "Number of Nominations",
					axisLabel: {
						color: "#9ca3b8",
					},
					nameTextStyle: {
						color: "#d1d5db",
					},
					splitLine: {
						lineStyle: {
							color: "#374151",
						},
					},
					axisLine: {
						lineStyle: {
							color: "#4b5563",
						},
					},
				},
			],
			series: [
				{
					name: "Jury Selected",
					type: "bar" as const,
					stack: "Total",
					emphasis: {
						focus: "series" as const,
					},
					data: finalistData,
					itemStyle: {
						color: "#34d399",
					},
				},
				{
					name: "Not Selected",
					type: "bar" as const,
					stack: "Total",
					emphasis: {
						focus: "series" as const,
					},
					data: nonFinalistData,
					itemStyle: {
						color: "#fbbf24",
					},
				},
			],
			backgroundColor: "transparent",
		}),
		[gameNames, finalistData, nonFinalistData],
	);

	useEffect(() => {
		if (data.length > 0) {
			setOption(chartConfig);
		}
	}, [chartConfig, data.length, setOption]);

	if (data.length === 0) {
		return (
			<p className="text-center text-gray-400">
				No data available for this chart.
			</p>
		);
	}

	return <div ref={chartRef} style={FULL_SIZE_STYLE} />;
}

// Power Nominators Chart
function PowerNominatorsChart({ data }: { data: PowerNominatorStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
			},
			grid: {
				left: "3%",
				right: "6%",
				bottom: "15%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "value",
				axisLabel: { color: "#94a3b8" },
				name: "Winners Nominated",
				nameLocation: "middle",
				nameGap: 30,
				nameTextStyle: { color: "#94a3b8" },
			},
			yAxis: {
				type: "category",
				data: data.map((item) => item.display_name),
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Winners",
					type: "bar",
					barWidth: "60%",
					data: data.map((item) => item.winner_count),
					itemStyle: {
						color: "#34d399",
					},
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

// Pitch Success Rate Chart
function PitchSuccessRateChart({ data }: { data: PitchSuccessRateStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown[]) => {
					const item = params[0] as {
						name: string;
						value: number;
						data: { totalGames: number };
					};
					return `${item.name}<br/>Win Rate: ${item.value}%<br/>Total Games: ${item.data.totalGames}`;
				},
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "3%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: data.map((item) => item.category),
				axisLabel: { color: "#94a3b8" },
			},
			yAxis: {
				type: "value",
				axisLabel: {
					color: "#94a3b8",
					formatter: "{value}%",
				},
				name: "Win Rate",
				nameTextStyle: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Win Rate",
					type: "bar",
					barWidth: "50%",
					data: data.map((item) => ({
						value: item.win_rate,
						totalGames: item.total_games,
						itemStyle: {
							color: item.category === "With Pitches" ? "#34d399" : "#fbbf24",
						},
					})),
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

// Voting Margins Chart
function VotingMarginsChart({ data }: { data: VotingMarginStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Sort data for better visualization
		const sortedData = [...data].sort((a, b) => {
			const order = [
				"Landslide (50%+)",
				"Clear Victory (30-50%)",
				"Competitive (15-30%)",
				"Nail-biter (<15%)",
			];
			return (
				order.indexOf(a.margin_category) - order.indexOf(b.margin_category)
			);
		});

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "item",
				formatter: "{a} <br/>{b}: {c} ({d}%)",
			},
			legend: {
				orient: "horizontal",
				bottom: "10%",
				left: "center",
				data: sortedData.map((item) => item.margin_category),
				textStyle: { color: "#fff", fontSize: 12 },
			},
			series: [
				{
					name: "Victory Types",
					type: "pie",
					radius: ["40%", "70%"],
					center: ["50%", "40%"],
					avoidLabelOverlap: false,
					label: {
						show: true,
						position: "center",
						formatter: () => "Victory\nMargins",
						fontSize: 16,
						color: "#94a3b8",
					},
					labelLine: {
						show: false,
					},
					data: sortedData.map((item, index) => ({
						value: item.count,
						name: item.margin_category,
						itemStyle: {
							color: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"][index],
						},
					})),
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

// Monthly Nomination Counts Chart
function MonthlyNominationCountsChart({
	data,
}: {
	data: MonthlyNominationCountStats[];
}) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out leading months with zero nominations
		const filteredData = data.filter((item, index) => {
			if (index === 0) return item.count > 0;
			const anyPreviousNominations = data
				.slice(0, index)
				.some((prev) => prev.count > 0);
			return anyPreviousNominations || item.count > 0;
		});

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "line" },
				formatter: (params: unknown) => {
					const items = params as Array<{
						axisValue: string;
						seriesName: string;
						value: number;
						marker: string;
						dataIndex: number;
					}>;
					if (!Array.isArray(items) || items.length === 0) return "";
					const idx = items[0].dataIndex;
					const month = items[0].axisValue;
					const theme = filteredData[idx]?.themeShort ?? "";
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					return `${header}<br/>${lines}`;
				},
			},
			grid: {
				left: "6%",
				right: "6%",
				bottom: "16%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: filteredData.map((item) => formatMonthYear(item.monthYear)),
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
				},
			},
			yAxis: {
				type: "value",
				axisLabel: { color: "#94a3b8" },
				name: "Nominations",
				nameTextStyle: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Nominations",
					type: "line",
					data: filteredData.map((item) => item.count),
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#fbbf24" },
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: "rgba(251, 191, 36, 0.5)" },
								{ offset: 1, color: "rgba(251, 191, 36, 0.1)" },
							],
						},
					},
					symbolSize: 8,
				},
			],
		});

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}
