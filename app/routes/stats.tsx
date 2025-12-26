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
import { useEffect, useId, useRef } from "react";
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
	total?: number;
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

// AIDEV-NOTE: Clean parallel queries - each query is typed and independent
export async function loader(): Promise<StatsLoaderData> {
	const [
		totalsResult,
		votesResult,
		juryResult,
		pitchesResult,
		winnersCountResult,
		shortLongResult,
		yearStatsResult,
		monthlyStatsResult,
		topGamesResult,
		topScoringResult,
		winnersByYearResult,
		pitchSuccessResult,
		votingMarginsResult,
		speedRunsResult,
		powerNominatorsResult,
		discordDynastiesResult,
	] = await Promise.all([
		// 1. Total nominations and unique games
		db.execute(`
			SELECT COUNT(*) AS total_nominations,
			       COUNT(DISTINCT game_id) AS unique_games,
			       COUNT(DISTINCT discord_id) AS total_nominators
			FROM nominations
		`),

		// 2. Vote stats
		db.execute(`
			SELECT COUNT(*) AS total_votes,
			       COUNT(DISTINCT discord_id) AS total_voters
			FROM votes
		`),

		// 3. Jury members
		db.execute(`
			SELECT COUNT(DISTINCT discord_id) AS total_jury_members
			FROM jury_members WHERE active = 1
		`),

		// 4. Pitches count
		db.execute(`SELECT COUNT(*) AS total_pitches FROM pitches`),

		// 5. Winners count
		db.execute(`SELECT COUNT(*) AS total_winners FROM winners`),

		// 6. Short vs Long breakdown
		db.execute(`
			SELECT
				SUM(CASE WHEN short = 1 THEN 1 ELSE 0 END) AS short_count,
				SUM(CASE WHEN short = 0 THEN 1 ELSE 0 END) AS long_count,
				COUNT(DISTINCT CASE WHEN short = 1 THEN discord_id END) AS short_nominators,
				COUNT(DISTINCT CASE WHEN short = 0 THEN discord_id END) AS long_nominators
			FROM nominations
		`),

		// 7. Nominations by game release year
		db.execute(`
			SELECT game_year AS year, COUNT(*) AS count
			FROM nominations
			WHERE game_year IS NOT NULL AND game_year != '' AND game_year != 'null'
			GROUP BY game_year
			ORDER BY game_year ASC
		`),

		// 8. Monthly participation stats
		db.execute(`
			SELECT
				m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
				COALESCE(t.name, NULL) AS themeShort,
				COUNT(DISTINCT CASE WHEN n.discord_id IS NOT NULL THEN n.discord_id END) AS nominators,
				COUNT(DISTINCT CASE WHEN v.discord_id IS NOT NULL THEN v.discord_id END) AS voters,
				COUNT(DISTINCT n.id) AS total,
				COUNT(DISTINCT CASE WHEN n.jury_selected = 1 THEN n.id END) AS selected
			FROM months m
			LEFT JOIN themes t ON m.theme_id = t.id
			LEFT JOIN nominations n ON m.id = n.month_id
			LEFT JOIN votes v ON m.id = v.month_id
			GROUP BY m.id, m.year, m.month
			ORDER BY m.year, m.month
		`),

		// 9. Top nominated games
		db.execute(`
			SELECT
				game_id AS id, game_name AS name,
				SUM(CASE WHEN jury_selected = 1 THEN 1 ELSE 0 END) AS finalistNominations,
				SUM(CASE WHEN jury_selected = 0 THEN 1 ELSE 0 END) AS nonFinalistNominations,
				COUNT(*) AS totalNominations
			FROM nominations
			GROUP BY game_id, game_name
			ORDER BY totalNominations DESC
			LIMIT 10
		`),

		// 10. Games with most first-place votes
		db.execute(`
			SELECT n.game_name, COUNT(r.vote_id) AS count
			FROM nominations n
			JOIN rankings r ON r.nomination_id = n.id
			WHERE r.rank = 1
			GROUP BY n.game_name
			HAVING count >= 2
			ORDER BY count DESC
			LIMIT 10
		`),

		// 11. Winners by release year
		db.execute(`
			SELECT game_year AS year, COUNT(*) AS count
			FROM winners
			WHERE game_year IS NOT NULL AND game_year != '' AND game_year != 'null'
			GROUP BY game_year
			ORDER BY game_year ASC
		`),

		// 12. Pitch success rate
		db.execute(`
			WITH pitch_success AS (
				SELECT
					n.game_id,
					CASE WHEN COUNT(p.id) > 0 THEN 1 ELSE 0 END AS has_pitch,
					MAX(CASE WHEN w.game_id IS NOT NULL THEN 1 ELSE 0 END) AS is_winner
				FROM nominations n
				LEFT JOIN pitches p ON n.id = p.nomination_id
				LEFT JOIN winners w ON n.game_id = w.game_id
				WHERE n.jury_selected = 1
				GROUP BY n.game_id
			)
			SELECT
				CASE WHEN has_pitch = 1 THEN 'With Pitches' ELSE 'Without Pitches' END AS category,
				ROUND(AVG(is_winner) * 100, 1) AS win_rate,
				COUNT(*) AS total_games
			FROM pitch_success
			GROUP BY has_pitch
		`),

		// 13. Voting margins
		db.execute(`
			WITH vote_scores AS (
				SELECT
					n.month_id, n.short,
					COUNT(CASE WHEN r.rank = 1 THEN 1 END) * 3 +
					COUNT(CASE WHEN r.rank = 2 THEN 1 END) * 2 +
					COUNT(CASE WHEN r.rank = 3 THEN 1 END) * 1 AS score
				FROM nominations n
				JOIN rankings r ON n.id = r.nomination_id
				WHERE n.jury_selected = 1
				GROUP BY n.month_id, n.game_id, n.short
			),
			ranked AS (
				SELECT *, ROW_NUMBER() OVER (PARTITION BY month_id, short ORDER BY score DESC) AS pos
				FROM vote_scores
			),
			margins AS (
				SELECT
					(r1.score - COALESCE(r2.score, 0)) * 100.0 / r1.score AS margin_pct
				FROM ranked r1
				LEFT JOIN ranked r2 ON r1.month_id = r2.month_id AND r1.short = r2.short AND r2.pos = 2
				WHERE r1.pos = 1 AND r1.score > 0
			)
			SELECT
				CASE
					WHEN margin_pct >= 50 THEN 'Landslide (50%+)'
					WHEN margin_pct >= 30 THEN 'Clear Victory (30-50%)'
					WHEN margin_pct >= 15 THEN 'Competitive (15-30%)'
					ELSE 'Nail-biter (<15%)'
				END AS margin_category,
				COUNT(*) AS count
			FROM margins
			GROUP BY margin_category
		`),

		// 14. Speed runs (fastest time from release to win)
		db.execute(`
			SELECT
				w.game_name, w.game_year,
				m.year || '-' || PRINTF('%02d', m.month) AS win_date,
				CAST(julianday(m.year || '-' || PRINTF('%02d', m.month) || '-01') -
				     julianday(w.game_year || '-01-01') AS INTEGER) AS days_to_win
			FROM winners w
			JOIN months m ON w.month_id = m.id
			WHERE w.game_year IS NOT NULL AND w.game_year != '' AND w.game_year != 'null'
			  AND CAST(w.game_year AS INTEGER) < m.year
			ORDER BY days_to_win ASC
			LIMIT 10
		`),

		// 15. Power nominators
		db.execute(`
			SELECT n.discord_id, COUNT(DISTINCT w.game_id) AS winner_count
			FROM nominations n
			JOIN winners w ON n.game_id = w.game_id
			GROUP BY n.discord_id
			ORDER BY winner_count DESC
			LIMIT 10
		`),

		// 16. Discord dynasties (longest participation streaks)
		db.execute(`
			WITH monthly_participation AS (
				SELECT DISTINCT discord_id, month_id FROM votes
				UNION
				SELECT DISTINCT discord_id, month_id FROM nominations
			),
			user_months AS (
				SELECT mp.discord_id, m.year, m.month,
				       ROW_NUMBER() OVER (PARTITION BY mp.discord_id ORDER BY m.year, m.month) AS rn
				FROM monthly_participation mp
				JOIN months m ON mp.month_id = m.id
			),
			streaks AS (
				SELECT discord_id, year * 12 + month - rn AS streak_group
				FROM user_months
			)
			SELECT discord_id, COUNT(*) AS consecutive_months, 'Participation' AS streak_type
			FROM streaks
			GROUP BY discord_id, streak_group
			ORDER BY consecutive_months DESC
			LIMIT 10
		`),
	]);

	// Direct mapping - no parsing needed
	const totals = totalsResult.rows[0];
	const votes = votesResult.rows[0];
	const jury = juryResult.rows[0];
	const pitches = pitchesResult.rows[0];
	const winnersCount = winnersCountResult.rows[0];
	const shortLong = shortLongResult.rows[0];

	const totalStats = {
		total_nominations: Number(totals.total_nominations),
		unique_games: Number(totals.unique_games),
		total_nominators: Number(totals.total_nominators),
		total_votes: Number(votes.total_votes),
		total_voters: Number(votes.total_voters),
		total_jury_members: Number(jury.total_jury_members),
		total_pitches: Number(pitches.total_pitches),
		total_winners: Number(winnersCount.total_winners),
	};

	const shortVsLong: ShortVsLongStatsType[] = [
		{
			type: "Short Games",
			count: Number(shortLong.short_count),
			uniqueNominators: Number(shortLong.short_nominators),
		},
		{
			type: "Long Games",
			count: Number(shortLong.long_count),
			uniqueNominators: Number(shortLong.long_nominators),
		},
	];

	const yearStats: YearStats[] = yearStatsResult.rows.map((r) => ({
		year: String(r.year),
		count: Number(r.count),
	}));

	const monthlyStats: MonthlyParticipationStats[] = monthlyStatsResult.rows.map(
		(r) => ({
			monthYear: String(r.monthYear),
			themeShort: r.themeShort != null ? String(r.themeShort) : null,
			nominators: Number(r.nominators),
			voters: Number(r.voters),
			total: Number(r.total),
		}),
	);

	const jurySelectionStats: JurySelectionStatsType[] =
		monthlyStatsResult.rows.map((r) => ({
			monthYear: String(r.monthYear),
			themeShort: r.themeShort != null ? String(r.themeShort) : null,
			selected: Number(r.selected),
			total: Number(r.total),
			selectPercentage:
				Number(r.total) > 0
					? Math.round((Number(r.selected) / Number(r.total)) * 100)
					: 0,
		}));

	const monthlyNominationCounts: MonthlyNominationCountStats[] =
		monthlyStatsResult.rows.map((r) => ({
			monthYear: String(r.monthYear),
			themeShort: r.themeShort != null ? String(r.themeShort) : null,
			count: Number(r.total),
		}));

	const topGamesFinalist: TopGamesFinalistStats[] = topGamesResult.rows.map(
		(r) => ({
			id: String(r.id),
			name: String(r.name),
			finalistNominations: Number(r.finalistNominations),
			nonFinalistNominations: Number(r.nonFinalistNominations),
			totalNominations: Number(r.totalNominations),
		}),
	);

	const topScoringNominations: TopScoringNominationStats[] =
		topScoringResult.rows.map((r) => ({
			game_name: String(r.game_name),
			count: Number(r.count),
		}));

	const winnersByYear: WinnerByYearStats[] = winnersByYearResult.rows.map(
		(r) => ({
			year: String(r.year),
			count: Number(r.count),
		}),
	);

	const pitchSuccessRate: PitchSuccessRateStats[] = pitchSuccessResult.rows.map(
		(r) => ({
			category: String(r.category),
			win_rate: Number(r.win_rate),
			total_games: Number(r.total_games),
		}),
	);

	const votingMargins: VotingMarginStats[] = votingMarginsResult.rows.map(
		(r) => ({
			margin_category: String(r.margin_category),
			count: Number(r.count),
		}),
	);

	const speedRuns: SpeedRunStats[] = speedRunsResult.rows.map((r) => ({
		game_name: String(r.game_name),
		game_year: String(r.game_year),
		win_date: String(r.win_date),
		days_to_win: Number(r.days_to_win),
	}));

	const powerNominators: PowerNominatorStats[] = powerNominatorsResult.rows.map(
		(r) => ({
			discord_id: String(r.discord_id),
			winner_count: Number(r.winner_count),
			display_name: uniqueNameGenerator(String(r.discord_id)),
		}),
	);

	const discordDynasties: DiscordDynastyStats[] =
		discordDynastiesResult.rows.map((r) => ({
			discord_id: String(r.discord_id),
			consecutive_months: Number(r.consecutive_months),
			streak_type: String(r.streak_type),
			display_name: uniqueNameGenerator(String(r.discord_id)),
		}));

	// AIDEV-NOTE: Pre-filter monthly data to remove leading zero-activity months
	const firstActiveMonthlyIdx = monthlyStats.findIndex(
		(m) => m.nominators > 0 || m.voters > 0,
	);
	const activeMonthlyStats =
		firstActiveMonthlyIdx >= 0
			? monthlyStats.slice(firstActiveMonthlyIdx)
			: monthlyStats;

	const firstActiveJuryIdx = jurySelectionStats.findIndex((j) => j.total > 0);
	const activeJurySelectionStats =
		firstActiveJuryIdx >= 0
			? jurySelectionStats.slice(firstActiveJuryIdx)
			: jurySelectionStats;

	const firstActiveNomIdx = monthlyNominationCounts.findIndex(
		(m) => m.count > 0,
	);
	const activeMonthlyNominationCounts =
		firstActiveNomIdx >= 0
			? monthlyNominationCounts.slice(firstActiveNomIdx)
			: monthlyNominationCounts;

	return {
		totalStats,
		topGamesFinalist,
		yearStats,
		monthlyStats: activeMonthlyStats,
		jurySelectionStats: activeJurySelectionStats,
		shortVsLong,
		winnersByYear,
		topScoringNominations,
		powerNominators,
		pitchSuccessRate,
		votingMargins,
		speedRuns,
		discordDynasties,
		monthlyNominationCounts: activeMonthlyNominationCounts,
	};
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

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) {
				return;
			}
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

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
					name: "Nominations",
					type: "bar",
					barWidth: "60%",
					data: validData.map((item) => item.count),
					itemStyle: {
						color: "#4ade80",
					},
				},
			],
		});

	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function ParticipationChart({ data }: { data: MonthlyParticipationStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) {
			return;
		}

		chartInstanceRef.current = echarts.init(chartRef.current);

		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) {
				return;
			}
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Single-pass extraction for better cache locality
		const len = data.length;
		const formattedLabels = Array.from<string>({ length: len });
		const nominatorData = Array.from<number>({ length: len });
		const voterData = Array.from<number>({ length: len });
		const themeLabels = Array.from<string>({ length: len });

		for (let i = 0; i < len; i++) {
			const item = data[i];
			formattedLabels[i] = formatMonthYear(item.monthYear);
			nominatorData[i] = item.nominators;
			voterData[i] = item.voters;
			themeLabels[i] = item.themeShort ?? "";
		}

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
					if (!Array.isArray(items) || items.length === 0) {
						return "";
					}
					const idx = items[0].dataIndex;
					const month = items[0].axisValue;
					const theme = themeLabels[idx];
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					const totalForMonth = data[idx]?.total ?? 0;
					return `${header}<br/>${lines}<br/>Total Nominations: ${totalForMonth}`;
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
				type: "category",
				data: formattedLabels,
				axisLabel: {
					color: "#94a3b8",
					rotate: 45,
					margin: 15,
				},
			},
			yAxis: {
				type: "value",
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Nominators",
					type: "line",
					data: nominatorData,
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#34d399" },
					symbolSize: 8,
				},
				{
					name: "Voters",
					type: "line",
					data: voterData,
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#fbbf24" },
					symbolSize: 8,
				},
			],
		});
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function JurySelectionChart({ data }: { data: JurySelectionStatsType[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect - data is pre-filtered in loader
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Single-pass extraction
		const len = data.length;
		const labels = Array.from<string>({ length: len });
		const notSelectedData = Array.from<number>({ length: len });
		const selectedData = Array.from<number>({ length: len });

		for (let i = 0; i < len; i++) {
			const item = data[i];
			labels[i] = formatMonthYear(item.monthYear);
			notSelectedData[i] = Math.max(item.total - item.selected, 0);
			selectedData[i] = item.selected;
		}

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
					const theme = data[idx]?.themeShort ?? "";
					const header = theme ? `${month}<br/>Theme: ${theme}` : month;
					const lines = items
						.map((it) => `${it.marker} ${it.seriesName}: ${it.value}`)
						.join("<br/>");
					const totalForMonth = data[idx]?.total ?? 0;
					return `${header}<br/>${lines}<br/>Total Nominations: ${totalForMonth}`;
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
				data: labels,
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
					name: "Not Selected",
					type: "bar",
					stack: "games",
					itemStyle: { color: "#94a3b8" },
					data: notSelectedData,
				},
				{
					name: "Selected by Jury",
					type: "bar",
					stack: "games",
					itemStyle: { color: "#34d399" },
					data: selectedData,
				},
			],
		});
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

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect - data is pre-filtered in loader
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Single-pass extraction
		const len = data.length;
		const labels = Array.from<string>({ length: len });
		const percentageData = Array.from<number>({ length: len });

		for (let i = 0; i < len; i++) {
			const item = data[i];
			labels[i] = formatMonthYear(item.monthYear);
			percentageData[i] = item.selectPercentage;
		}

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
					const theme = data[idx]?.themeShort ?? "";
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
				data: labels,
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
					data: percentageData,
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
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function ShortVsLongChart({ data }: { data: ShortVsLongStatsType[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
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
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function WinnersByYearChart({ data }: { data: WinnerByYearStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
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
						color: "#34d399",
					},
				},
			],
		});
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

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Find max score for better scaling
		const maxCount = Math.max(...data.map((item) => item.count));

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown[]) => {
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
				max: maxCount * 1.1,
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
						color: "#fbbf24",
					},
				},
			],
		});
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function TopGamesFinalistChart({ data }: { data: TopGamesFinalistStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) {
			return;
		}

		chartInstanceRef.current = echarts.init(chartRef.current);

		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) {
				return;
			}
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		if (data.length === 0) {
			chartInstanceRef.current.clear();
			return;
		}

		// Single-pass extraction
		const len = data.length;
		const gameNames = Array.from<string>({ length: len });
		const finalistData = Array.from<number>({ length: len });
		const nonFinalistData = Array.from<number>({ length: len });

		for (let i = 0; i < len; i++) {
			const item = data[i];
			gameNames[i] = item.name;
			finalistData[i] = item.finalistNominations;
			nonFinalistData[i] = item.nonFinalistNominations;
		}

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				backgroundColor: "rgba(31, 41, 55, 0.8)",
				borderColor: "rgba(55, 65, 81, 1)",
				textStyle: { color: "#e5e7eb" },
			},
			legend: {
				data: ["Jury Selected", "Not Selected"],
				textStyle: { color: "#d1d5db" },
				top: "2%",
				left: "center",
				orient: "horizontal",
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
					type: "category",
					data: gameNames,
					axisLabel: {
						color: "#9ca3af",
						interval: 0,
						rotate: 30,
						fontSize: 11,
						overflow: "truncate",
						width: 120,
					},
					axisLine: {
						lineStyle: { color: "#4b5563" },
					},
				},
			],
			yAxis: [
				{
					type: "value",
					name: "Number of Nominations",
					axisLabel: { color: "#9ca3b8" },
					nameTextStyle: { color: "#d1d5db" },
					splitLine: { lineStyle: { color: "#374151" } },
					axisLine: { lineStyle: { color: "#4b5563" } },
				},
			],
			series: [
				{
					name: "Jury Selected",
					type: "bar",
					stack: "Total",
					emphasis: { focus: "series" },
					data: finalistData,
					itemStyle: { color: "#34d399" },
				},
				{
					name: "Not Selected",
					type: "bar",
					stack: "Total",
					emphasis: { focus: "series" },
					data: nonFinalistData,
					itemStyle: { color: "#fbbf24" },
				},
			],
			backgroundColor: "transparent",
		});
	}, [data]);

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

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
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
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

// Pitch Success Rate Chart
function PitchSuccessRateChart({ data }: { data: PitchSuccessRateStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
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
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

// Voting Margins Chart
// AIDEV-NOTE: Margin category order is fixed - use Map for O(1) lookup instead of indexOf
const MARGIN_ORDER = new Map([
	["Landslide (50%+)", 0],
	["Clear Victory (30-50%)", 1],
	["Competitive (15-30%)", 2],
	["Nail-biter (<15%)", 3],
]);
const MARGIN_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

function VotingMarginsChart({ data }: { data: VotingMarginStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Sort data using Map lookup - O(n) instead of O(n*m)
		const sortedData = [...data].sort((a, b) => {
			return (
				(MARGIN_ORDER.get(a.margin_category) ?? 99) -
				(MARGIN_ORDER.get(b.margin_category) ?? 99)
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
							color: MARGIN_COLORS[index],
						},
					})),
				},
			],
		});
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

	// Mount/unmount effect - runs once
	useEffect(() => {
		if (!chartRef.current) return;
		chartInstanceRef.current = echarts.init(chartRef.current);
		return () => {
			chartInstanceRef.current?.dispose();
			chartInstanceRef.current = null;
		};
	}, []);

	// Data update effect - data is pre-filtered in loader
	useEffect(() => {
		if (!chartInstanceRef.current) {
			if (!chartRef.current) return;
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Single-pass extraction
		const len = data.length;
		const labels = Array.from<string>({ length: len });
		const countData = Array.from<number>({ length: len });

		for (let i = 0; i < len; i++) {
			const item = data[i];
			labels[i] = formatMonthYear(item.monthYear);
			countData[i] = item.count;
		}

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
					const theme = data[idx]?.themeShort ?? "";
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
				data: labels,
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
					data: countData,
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
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}
