import { useRef, useEffect } from "react";
import { db } from "~/server/database.server";
import { uniqueNameGenerator } from "~/server/nameGenerator";
import * as echarts from "echarts/core";
import { BarChart, PieChart, LineChart } from "echarts/charts";
import {
	TitleComponent,
	TooltipComponent,
	GridComponent,
	DatasetComponent,
	TransformComponent,
	LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
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
interface GameStats {
	id: string;
	name: string;
	count: number;
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

interface TopNominatorStats {
	generatedName: string;
	count: number;
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

export async function loader() {
	// Get total stats
	const totalStatsResult = await db.execute({
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
	});

	// Get top 10 most nominated games
	const topGamesResult = await db.execute({
		sql: `SELECT game_id AS id, game_name AS name, COUNT(*) AS count
      FROM nominations
      GROUP BY game_id, game_name
      ORDER BY count DESC
      LIMIT 10`,
	});

	// Get nominations by year
	const yearStatsResult = await db.execute({
		sql: `SELECT game_year AS year, COUNT(*) AS count
      FROM nominations
      WHERE game_year IS NOT NULL AND game_year != ''
      GROUP BY game_year
      ORDER BY game_year ASC`,
	});

	// Get monthly participation stats
	const monthlyStatsResult = await db.execute({
		sql: `SELECT 
      m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
      (SELECT COUNT(DISTINCT discord_id) FROM nominations WHERE month_id = m.id) AS nominators,
      (SELECT COUNT(DISTINCT discord_id) FROM votes WHERE month_id = m.id) AS voters
      FROM months m
      ORDER BY m.year, m.month`,
	});

	// Get top nominators
	const topNominatorsResult = await db.execute({
		sql: `WITH nominator_counts AS (
      SELECT discord_id, COUNT(*) AS count
      FROM nominations
      GROUP BY discord_id
      ORDER BY count DESC
      LIMIT 10
    )
    SELECT 
      nc.discord_id,
      nc.count
    FROM nominator_counts nc`,
	});

	// Get nomination vs jury selection stats
	const jurySelectionStatsResult = await db.execute({
		sql: `SELECT 
      m.year || '-' || PRINTF('%02d', m.month) AS monthYear,
      COUNT(CASE WHEN jury_selected = 1 THEN 1 END) AS selected,
      COUNT(*) AS total
      FROM nominations n
      JOIN months m ON n.month_id = m.id
      GROUP BY n.month_id
      ORDER BY m.year, m.month`,
	});

	// Short vs Long game stats
	const shortVsLongResult = await db.execute({
		sql: `SELECT 
      short, 
      COUNT(*) AS count, 
      COUNT(DISTINCT discord_id) AS unique_nominators
      FROM nominations
      GROUP BY short`,
	});

	// Winners by release year stats
	const winnersByYearResult = await db.execute({
		sql: `SELECT 
      game_year AS year, 
      COUNT(*) AS count 
      FROM winners
      WHERE game_year IS NOT NULL AND game_year != ''
      GROUP BY game_year
      ORDER BY game_year ASC`,
	});

	// Top scoring nominations
	const topScoringNominationsResult = await db.execute({
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
	});

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

	const topGames = topGamesResult.rows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		count: Number(row.count),
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

	const topNominators = topNominatorsResult.rows.map((row) => ({
		generatedName: uniqueNameGenerator(String(row.discord_id)),
		count: Number(row.count),
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

	return {
		totalStats,
		topGames,
		yearStats,
		monthlyStats,
		topNominators,
		jurySelectionStats,
		shortVsLong,
		winnersByYear,
		topScoringNominations,
	};
}

export default function StatsPage({ loaderData }: Route.ComponentProps) {
	const {
		totalStats,
		topGames,
		yearStats,
		monthlyStats,
		topNominators,
		jurySelectionStats,
		shortVsLong,
		winnersByYear,
		topScoringNominations,
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
					<ChartCard title="Top 10 Most Nominated Games" className="h-96">
						<TopGamesChart data={topGames} />
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
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<ChartCard
						title="Monthly Participation (Nominators vs Voters)"
						className="h-96"
					>
						<ParticipationChart data={monthlyStats} />
					</ChartCard>
					<ChartCard title="Top 10 Nominators" className="h-96">
						<TopNominatorsChart data={topNominators} />
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
				<div className="grid grid-cols-1 gap-8">
					<ChartCard title="Winners by Release Year" className="h-96">
						<WinnersByYearChart data={winnersByYear} />
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
function TopGamesChart({ data }: { data: GameStats[] }) {
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
				type: "value",
				axisLabel: { color: "#94a3b8" },
			},
			yAxis: {
				type: "category",
				data: data.map((item) => item.name),
				axisTick: { alignWithLabel: true },
				axisLabel: {
					color: "#94a3b8",
					formatter: (value: string) => {
						return value.length > 30 ? `${value.substring(0, 27)}...` : value;
					},
				},
			},
			series: [
				{
					name: "Nominations",
					type: "bar",
					barWidth: "60%",
					data: data.map((item) => item.count),
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

function TopNominatorsChart({ data }: { data: TopNominatorStats[] }) {
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
				type: "value",
				axisLabel: { color: "#94a3b8" },
			},
			yAxis: {
				type: "category",
				data: data.map((item) => item.generatedName),
				axisTick: { alignWithLabel: true },
				axisLabel: { color: "#94a3b8" },
			},
			series: [
				{
					name: "Nominations",
					type: "bar",
					barWidth: "60%",
					data: data.map((item) => item.count),
					itemStyle: {
						color: "#fbbf24",
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
}: { data: JurySelectionStatsType[] }) {
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
}: { data: TopScoringNominationStats[] }) {
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
