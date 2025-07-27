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
import { useEffect, useRef } from "react";
import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";
import cache from "~/utils/cache.server";
import type { Route } from "./+types/stats";

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
}

interface JurySelectionStatsType {
	monthYear: string;
	selected: number;
	total: number;
	selectPercentage: number;
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
}

interface MonthlyNominationCountStats {
	monthYear: string;
	count: number;
}

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

export async function loader(): Promise<StatsLoaderData> {
	const CACHE_KEY = "stats_page_data";
	// TTL set to 1 day (24 hours in milliseconds)
	const TTL = 24 * 60 * 60 * 1000;

	// Try to get data from cache
	const cachedData = cache.get<StatsLoaderData>(CACHE_KEY);
	if (cachedData) {
		return cachedData;
	}

	const [
		totalStatsResult,
		yearStatsResult,
		monthlyStatsResult,
		jurySelectionStatsResult,
		shortVsLongResult,
		winnersByYearResult,
		topScoringNominationsResult,
		topGamesFinalistResult,
		powerNominatorsResult,
		pitchSuccessRateResult,
		votingMarginsResult,
		speedRunsResult,
		discordDynastiesResult,
		monthlyNominationCountsResult,
	] = await Promise.all([
		// Get total stats
		db.execute({
			sql: `SELECT
				(SELECT COUNT(*) FROM nominations) AS total_nominations,
				(SELECT COUNT(DISTINCT game_id) FROM nominations) AS unique_games,
				(SELECT COUNT(*) FROM votes) AS total_votes,
				(SELECT COUNT(DISTINCT discord_id) FROM jury_members WHERE active = 1) AS total_jury_members,
				(SELECT COUNT(DISTINCT discord_id) FROM nominations) AS total_nominators,
				(SELECT COUNT(DISTINCT discord_id) FROM votes) AS total_voters,
				(SELECT COUNT(*) FROM pitches) AS total_pitches,
				(SELECT COUNT(*) FROM winners) AS total_winners
			`,
		}),

		// Get nominations by year
		db.execute({
			sql: `SELECT game_year AS year, COUNT(*) AS count
				FROM nominations
				WHERE game_year IS NOT NULL AND game_year != ''
				GROUP BY game_year
				ORDER BY game_year ASC`,
		}),

		// Get monthly participation stats
		db.execute({
			sql: `SELECT 
				m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
				(SELECT COUNT(DISTINCT discord_id) FROM nominations WHERE month_id = m.id) AS nominators,
				(SELECT COUNT(DISTINCT discord_id) FROM votes WHERE month_id = m.id) AS voters
				FROM months m
				ORDER BY m.year, m.month`,
		}),

		// Get nomination vs jury selection stats
		db.execute({
			sql: `SELECT 
				m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
				COUNT(CASE WHEN jury_selected = 1 THEN 1 END) AS selected,
				COUNT(*) AS total
				FROM nominations n
				JOIN months m ON n.month_id = m.id
				GROUP BY n.month_id
				ORDER BY m.year, m.month`,
		}),

		// Short vs Long game stats
		db.execute({
			sql: `SELECT 
				short, 
				COUNT(*) AS count, 
				COUNT(DISTINCT discord_id) AS unique_nominators
				FROM nominations
				GROUP BY short`,
		}),

		// Winners by release year stats
		db.execute({
			sql: `SELECT 
				game_year AS year, 
				COUNT(*) AS count 
				FROM winners
				WHERE game_year IS NOT NULL AND game_year != ''
				GROUP BY game_year
				ORDER BY game_year ASC`,
		}),

		// Top scoring nominations
		db.execute({
			sql: `SELECT 
				n.game_name, 
				COUNT(r.vote_id) AS count
			FROM nominations n
			JOIN rankings r ON r.nomination_id = n.id
			WHERE r.rank = 1 -- Only count rank 1 (first place) votes
			GROUP BY n.game_name
			HAVING count >= 2 -- At least 2 first-place votes
			ORDER BY count DESC
			LIMIT 10`,
		}),

		// Get top 10 most nominated games with jury selection distinction
		db.execute({
			sql: `WITH GameNominationCounts AS (
					SELECT
							game_id,
							game_name,
							SUM(CASE WHEN jury_selected = 1 THEN 1 ELSE 0 END) as finalist_nominations,
							SUM(CASE WHEN jury_selected = 0 THEN 1 ELSE 0 END) as non_finalist_nominations,
							COUNT(*) as total_nominations
					FROM nominations
					GROUP BY game_id, game_name
			)
			SELECT
					game_id AS id,
					game_name AS name,
					finalist_nominations,
					non_finalist_nominations,
					total_nominations
			FROM GameNominationCounts
			ORDER BY total_nominations DESC
			LIMIT 10;`,
		}),

		// Power Nominators - Users who nominated the most winners
		db.execute({
			sql: `SELECT 
				n.discord_id,
				COUNT(DISTINCT w.game_id) as winner_count
			FROM nominations n
			JOIN winners w ON n.game_id = w.game_id
			GROUP BY n.discord_id
			ORDER BY winner_count DESC
			LIMIT 10`,
		}),

		// Pitch Success Rate
		db.execute({
			sql: `WITH GamePitchStatus AS (
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
			)
			SELECT 
				CASE WHEN has_pitch = 1 THEN 'With Pitches' ELSE 'Without Pitches' END as category,
				ROUND(AVG(is_winner) * 100, 1) as win_rate,
				COUNT(*) as total_games
			FROM GamePitchStatus
			GROUP BY has_pitch`,
		}),

		// Voting Margins - Distribution of landslide vs close victories
		db.execute({
			sql: `WITH VoteScores AS (
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
			MonthlyWinners AS (
				SELECT 
					month_id,
					short,
					game_id,
					game_name,
					score,
					ROW_NUMBER() OVER (PARTITION BY month_id, short ORDER BY score DESC) as position
				FROM VoteScores
			),
			Margins AS (
				SELECT 
					w1.month_id,
					w1.short,
					w1.score - COALESCE(w2.score, 0) as margin,
					(w1.score - COALESCE(w2.score, 0)) * 100.0 / w1.score as margin_percentage
				FROM MonthlyWinners w1
				LEFT JOIN MonthlyWinners w2 ON w1.month_id = w2.month_id 
					AND w1.short = w2.short 
					AND w2.position = 2
				WHERE w1.position = 1 AND w1.score > 0
			)
			SELECT 
				CASE 
					WHEN margin_percentage >= 50 THEN 'Landslide (50%+)'
					WHEN margin_percentage >= 30 THEN 'Clear Victory (30-50%)'
					WHEN margin_percentage >= 15 THEN 'Competitive (15-30%)'
					ELSE 'Nail-biter (<15%)'
				END as margin_category,
				COUNT(*) as count
			FROM Margins
			GROUP BY margin_category
			ORDER BY 
				CASE margin_category
					WHEN 'Landslide (50%+)' THEN 1
					WHEN 'Clear Victory (30-50%)' THEN 2
					WHEN 'Competitive (15-30%)' THEN 3
					WHEN 'Nail-biter (<15%)' THEN 4
				END`,
		}),

		// Speed Run - Fastest from release to win
		db.execute({
			sql: `SELECT 
				w.game_name,
				w.game_year,
				m.year || '-' || PRINTF('%02d', m.month) as win_date,
				CAST(julianday(m.year || '-' || PRINTF('%02d', m.month) || '-01') - 
					 julianday(w.game_year || '-01-01') AS INTEGER) as days_to_win
			FROM winners w
			JOIN months m ON w.month_id = m.id
			WHERE w.game_year IS NOT NULL 
				AND w.game_year != ''
				AND CAST(w.game_year AS INTEGER) < m.year
			ORDER BY days_to_win ASC
			LIMIT 10`,
		}),

		// Discord Dynasties - Longest consecutive participation streaks
		db.execute({
			sql: `WITH MonthlyParticipation AS (
				SELECT DISTINCT
					discord_id,
					month_id,
					'voter' as activity_type
				FROM votes
				UNION
				SELECT DISTINCT
					discord_id,
					month_id,
					'nominator' as activity_type
				FROM nominations
			),
			UserMonths AS (
				SELECT 
					mp.discord_id,
					mp.month_id,
					m.year,
					m.month,
					ROW_NUMBER() OVER (PARTITION BY mp.discord_id ORDER BY m.year, m.month) as rn
				FROM MonthlyParticipation mp
				JOIN months m ON mp.month_id = m.id
			),
			Streaks AS (
				SELECT 
					discord_id,
					year,
					month,
					rn,
					year * 12 + month - rn as streak_group
				FROM UserMonths
			),
			ConsecutiveStreaks AS (
				SELECT 
					discord_id,
					streak_group,
					COUNT(*) as consecutive_months,
					MIN(year || '-' || PRINTF('%02d', month)) as start_month,
					MAX(year || '-' || PRINTF('%02d', month)) as end_month
				FROM Streaks
				GROUP BY discord_id, streak_group
			)
			SELECT 
				discord_id,
				consecutive_months,
				'Participation' as streak_type
			FROM ConsecutiveStreaks
			ORDER BY consecutive_months DESC
			LIMIT 10`,
		}),

		// Monthly Nomination Counts
		db.execute({
			sql: `SELECT 
				m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
				COUNT(n.id) AS count
			FROM months m
			LEFT JOIN nominations n ON m.id = n.month_id
			GROUP BY m.id, m.year, m.month
			ORDER BY m.year, m.month`,
		}),
	]);

	// Format results as needed for frontend charts
	const totalStats = {
		total_nominations: Number(totalStatsResult.rows[0].total_nominations),
		unique_games: Number(totalStatsResult.rows[0].unique_games),
		total_votes: Number(totalStatsResult.rows[0].total_votes),
		total_jury_members: Number(totalStatsResult.rows[0].total_jury_members),
		total_nominators: Number(totalStatsResult.rows[0].total_nominators),
		total_voters: Number(totalStatsResult.rows[0].total_voters),
		total_pitches: Number(totalStatsResult.rows[0].total_pitches),
		total_winners: Number(totalStatsResult.rows[0].total_winners),
	};

	const topGamesFinalist = topGamesFinalistResult.rows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		finalistNominations: Number(row.finalist_nominations),
		nonFinalistNominations: Number(row.non_finalist_nominations),
		totalNominations: Number(row.total_nominations),
	}));

	const yearStats = yearStatsResult.rows.map((row) => ({
		year: String(row.year),
		count: Number(row.count),
	}));

	const monthlyStats = monthlyStatsResult.rows.map((row) => ({
		monthYear: String(row.monthYear),
		nominators: Number(row.nominators),
		voters: Number(row.voters),
	}));

	const jurySelectionStats = jurySelectionStatsResult.rows.map((row) => ({
		monthYear: String(row.monthYear),
		selected: Number(row.selected),
		total: Number(row.total),
		selectPercentage: Math.round(
			(Number(row.selected) / Number(row.total)) * 100,
		),
	}));

	const shortVsLong = shortVsLongResult.rows.map((row) => ({
		type: row.short ? "Short Games" : "Long Games",
		count: Number(row.count),
		uniqueNominators: Number(row.unique_nominators),
	}));

	const winnersByYear = winnersByYearResult.rows.map((row) => ({
		year: String(row.year),
		count: Number(row.count),
	}));

	const topScoringNominations = topScoringNominationsResult.rows.map((row) => ({
		game_name: String(row.game_name),
		count: Number(row.count),
	}));

	const powerNominators = powerNominatorsResult.rows.map((row) => ({
		discord_id: String(row.discord_id),
		winner_count: Number(row.winner_count),
	}));

	const pitchSuccessRate = pitchSuccessRateResult.rows.map((row) => ({
		category: String(row.category),
		win_rate: Number(row.win_rate),
		total_games: Number(row.total_games),
	}));

	const votingMargins = votingMarginsResult.rows.map((row) => ({
		margin_category: String(row.margin_category),
		count: Number(row.count),
	}));

	const speedRuns = speedRunsResult.rows.map((row) => ({
		game_name: String(row.game_name),
		game_year: String(row.game_year),
		win_date: String(row.win_date),
		days_to_win: Number(row.days_to_win),
	}));

	const discordDynasties = discordDynastiesResult.rows.map((row) => ({
		discord_id: String(row.discord_id),
		consecutive_months: Number(row.consecutive_months),
		streak_type: String(row.streak_type),
	}));

	const monthlyNominationCounts = monthlyNominationCountsResult.rows.map(
		(row) => ({
			monthYear: String(row.monthYear),
			count: Number(row.count),
		}),
	);

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

	// Store results in cache with 1 day TTL
	cache.set(CACHE_KEY, result, TTL);

	return result;
}

export default function StatsPage({ loaderData }: Route.ComponentProps) {
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
			<section aria-labelledby="overview-title">
				<h2
					id="overview-title"
					className="text-2xl font-semibold text-white mb-6"
				>
					Overall Stats
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
					<StatCard
						title="Total Nominations"
						value={totalStats.total_nominations}
					/>
					<StatCard
						title="Unique Nominations"
						value={totalStats.unique_games}
					/>
					<StatCard title="Total Votes Cast" value={totalStats.total_votes} />
					<StatCard
						title="Total Pitches Submitted"
						value={totalStats.total_pitches}
					/>
					<StatCard
						title="Total Winners Selected"
						value={totalStats.total_winners}
					/>
				</div>
			</section>

			{/* Games Section */}
			<section aria-labelledby="games-title">
				<h2 id="games-title" className="text-2xl font-semibold text-white mb-6">
					Game Insights
				</h2>
				<div className="mb-8">
					<ChartCard
						title="Top Nominated Games (Jury Selected vs Not Selected)"
						className="h-96 p-8"
					>
						<TopGamesFinalistChart data={topGamesFinalist} />
					</ChartCard>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<ChartCard title="Nominations by Game Release Year" className="h-96">
						<YearlyNominationsChart data={yearStats} />
					</ChartCard>
					<ChartCard title="Short vs. Long Game Nominations" className="h-96">
						<ShortVsLongChart data={shortVsLong} />
					</ChartCard>
				</div>
			</section>

			{/* Participation Section */}
			<section aria-labelledby="participation-title">
				<h2
					id="participation-title"
					className="text-2xl font-semibold text-white mb-6"
				>
					Community Participation
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					<StatCard
						title="Unique Nominators"
						value={totalStats.total_nominators}
					/>
					<StatCard title="Unique Voters" value={totalStats.total_voters} />
					<StatCard
						title="Active Jury Members"
						value={totalStats.total_jury_members}
					/>
				</div>
				<div className="w-full">
					<ChartCard
						title="Monthly Participation (Nominators vs Voters)"
						className="h-96"
					>
						<ParticipationChart data={monthlyStats} />
					</ChartCard>
				</div>
			</section>

			{/* Jury Section */}
			<section aria-labelledby="jury-title">
				<h2 id="jury-title" className="text-2xl font-semibold text-white mb-6">
					Jury Insights
				</h2>
				<div className="grid grid-cols-1 gap-8">
					<ChartCard title="Monthly Jury Selection Counts" className="h-96">
						<JurySelectionChart data={jurySelectionStats} />
					</ChartCard>
					<ChartCard title="Monthly Jury Selection Percentage" className="h-96">
						<JurySelectionPercentageChart data={jurySelectionStats} />
					</ChartCard>
				</div>
			</section>

			{/* Winners Section */}
			<section aria-labelledby="winners-title">
				<h2
					id="winners-title"
					className="text-2xl font-semibold text-white mb-6"
				>
					Winners Insights
				</h2>
				<div className="grid grid-cols-1 gap-8 mb-8">
					<ChartCard title="Games with Most First Place Votes" className="h-96">
						<TopScoringNominationsChart data={topScoringNominations} />
					</ChartCard>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<ChartCard title="Winners by Release Year" className="h-96">
						<WinnersByYearChart data={winnersByYear} />
					</ChartCard>
					<ChartCard title="Victory Margins" className="h-96">
						<VotingMarginsChart data={votingMargins} />
					</ChartCard>
				</div>
			</section>

			{/* Fun Stats Section */}
			<section aria-labelledby="fun-stats-title">
				<h2
					id="fun-stats-title"
					className="text-2xl font-semibold text-white mb-6"
				>
					Fun Stats
				</h2>

				{/* Speed Runs */}
				{speedRuns.length > 0 && (
					<div className="mb-8">
						<ChartCard title="Fastest time from Release to Win" className="p-6">
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
						</ChartCard>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
					<ChartCard title="Nominators with Most Wins" className="h-96">
						<PowerNominatorsChart data={powerNominators} />
					</ChartCard>
					<ChartCard title="Pitch Success Rate" className="h-96">
						<PitchSuccessRateChart data={pitchSuccessRate} />
					</ChartCard>
				</div>

				{/* Discord Dynasties */}
				<div className="mb-8">
					<ChartCard title="Longest Participation Streaks" className="p-6">
						<div className="space-y-3">
							<p className="text-zinc-400 text-sm mb-4">
								Users with the longest consecutive months of participation
							</p>
							{discordDynasties.slice(0, 5).map((user) => (
								<div
									key={user.discord_id}
									className="flex items-center justify-between p-3 bg-zinc-700/50 rounded-lg"
								>
									<p className="text-white font-medium">
										{uniqueNameGenerator(user.discord_id)}
									</p>
									<p className="text-sky-400 font-medium">
										{user.consecutive_months} months
									</p>
								</div>
							))}
						</div>
					</ChartCard>
				</div>

				<div className="w-full">
					<ChartCard title="Monthly Nominations Trend" className="h-96">
						<MonthlyNominationCountsChart data={monthlyNominationCounts} />
					</ChartCard>
				</div>
			</section>
		</div>
	);
}

// Helper function to format month-year
function formatMonthYear(monthYear: string): string {
	const [year, month] = monthYear.split("-");
	const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
	return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Component for stat cards
function StatCard({ title, value }: { title: string; value: number | string }) {
	return (
		<div className="bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 hover:border-sky-500 transition-all duration-300">
			<h3 className="text-zinc-400 text-sm font-medium mb-1.5">{title}</h3>
			<p className="text-3xl font-bold text-white">{value}</p>
		</div>
	);
}

// Component for chart cards
function ChartCard({
	title,
	children,
	className = "",
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`bg-zinc-800/70 rounded-xl p-6 shadow-lg border border-zinc-700 ${className}`}
		>
			<h3 className="text-zinc-200 text-lg font-semibold mb-4">{title}</h3>
			<div className="h-full">{children}</div>
		</div>
	);
}

// Chart Components
function YearlyNominationsChart({ data }: { data: YearStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out invalid year values that might cause NaN
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

		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, [data]);

	return <div ref={chartRef} className="w-full h-full" />;
}

function ParticipationChart({ data }: { data: MonthlyParticipationStats[] }) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!chartRef.current) return;

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		// Filter out leading months with zero participants
		const filteredData = data.filter((item, index) => {
			// If it's the first month with any participation, include it and all subsequent months
			if (index === 0) return item.nominators > 0 || item.voters > 0;

			// Check if any previous month had participation
			const anyPreviousParticipation = data
				.slice(0, index)
				.some((prev) => prev.nominators > 0 || prev.voters > 0);

			return anyPreviousParticipation || item.nominators > 0 || item.voters > 0;
		});

		chartInstanceRef.current.setOption({
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
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
				data: filteredData.map((item) => formatMonthYear(item.monthYear)),
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
					name: "Nominators",
					type: "line",
					data: filteredData.map((item) => item.nominators),
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#34d399" },
					symbolSize: 8,
				},
				{
					name: "Voters",
					type: "line",
					data: filteredData.map((item) => item.voters),
					smooth: true,
					lineStyle: { width: 3 },
					itemStyle: { color: "#fbbf24" },
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

function JurySelectionChart({ data }: { data: JurySelectionStatsType[] }) {
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
				left: "6%",
				right: "6%",
				bottom: "12%",
				top: "3%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: data.map((item) => formatMonthYear(item.monthYear)),
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
					data: data.map((item) => item.total),
				},
				{
					name: "Selected by Jury",
					type: "bar",
					stack: "games",
					itemStyle: { color: "#34d399" },
					data: data.map((item) => item.selected),
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
				data: data.map((item) => formatMonthYear(item.monthYear)),
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
					data: data.map((item) => item.selectPercentage),
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
	const chartRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (chartRef.current && data.length > 0) {
			const chart = echarts.init(chartRef.current, "dark");
			const option = {
				tooltip: {
					trigger: "axis",
					axisPointer: {
						type: "shadow",
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
						data: data.map((item) => item.name),
						axisLabel: {
							color: "#9ca3af",
							interval: 0,
							rotate: 30,
							fontSize: 11,
							overflow: "truncate",
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
						type: "value",
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
						type: "bar",
						stack: "Total",
						emphasis: {
							focus: "series",
						},
						data: data.map((item) => item.finalistNominations),
						itemStyle: {
							color: "#34d399",
						},
					},
					{
						name: "Not Selected",
						type: "bar",
						stack: "Total",
						emphasis: {
							focus: "series",
						},
						data: data.map((item) => item.nonFinalistNominations),
						itemStyle: {
							color: "#fbbf24",
						},
					},
				],
				backgroundColor: "transparent",
			};
			chart.setOption(option);
			return () => chart.dispose();
		}
	}, [data]);

	if (data.length === 0) {
		return (
			<p className="text-center text-gray-400">
				No data available for this chart.
			</p>
		);
	}

	return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
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
				data: data.map((item) => uniqueNameGenerator(item.discord_id)),
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
