import { useEffect, useRef } from "react";
import {
	Chart as ChartJS,
	type ChartOptions,
	type ChartType,
} from "chart.js/auto";
import { SankeyController, Flow } from "chartjs-chart-sankey";

ChartJS.register(SankeyController, Flow);

interface SankeyDataPoint {
	source: string;
	target: string;
	weight: string | number;
}

interface VotingResultsChartProps {
	canvasId: string;
	results: SankeyDataPoint[];
}

const COLOR_PALETTE = [
	"#2563eb", // blue-600
	"#16a34a", // green-600
	"#9333ea", // purple-600
	"#ea580c", // orange-600
	"#0891b2", // cyan-600
	"#db2777", // pink-600
	"#4f46e5", // indigo-600
	"#ca8a04", // yellow-600
	"#0d9488", // teal-600
];

const CHART_CONFIG = {
	nodeWidth: 30,
	nodePadding: 24,
	size: "max" as const,
	font: { size: 16 },
} as const;

const CHART_OPTIONS = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		tooltip: {
			callbacks: {
				label: (context: {
					raw: { from: string; to: string; flow: number };
				}) => {
					const data = context.raw;
					const fromGame = getBaseGameName(data.from);
					const toGame = getBaseGameName(data.to);
					return `${toGame} got ${Math.round(data.flow)} votes from ${fromGame}`;
				},
			},
		},
	},
	layout: {
		padding: {
			right: 20, // Padding on the right for better scrolling experience
		},
	},
} as const as ChartOptions<ChartType>;

function getBaseGameName(nodeName: string): string {
	// Remove trailing spaces and numbers in parentheses
	return nodeName.replace(/\s*\(\d+\)\s*$/, "").trim();
}

const getWinner = (results: SankeyDataPoint[]): string | null => {
	if (results.length === 0) return null;
	const lastResult = results[results.length - 1];
	return lastResult.target.split(" (")[0];
};

export function VotingResultsChart({
	canvasId,
	results,
}: VotingResultsChartProps) {
	const chartRef = useRef<ChartJS | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		if (!canvasRef.current || results.length === 0) return;

		// Cleanup existing chart
		const existingChart = ChartJS.getChart(canvasRef.current);
		existingChart?.destroy();

		const uniqueGames = new Set<string>();
		for (const { source, target } of results) {
			uniqueGames.add(getBaseGameName(source));
			uniqueGames.add(getBaseGameName(target));
		}

		const gameColors = new Map<string, string>();
		Array.from(uniqueGames).forEach((game, index) => {
			gameColors.set(game, COLOR_PALETTE[index % COLOR_PALETTE.length]);
		});

		const sankeyData = results
			.filter(({ weight }) => Number(weight) > 0.01) // Filter out connections with negligible weight
			.map(({ source, target, weight }) => ({
				from: source, // Keep original source with numbers
				to: target, // Keep original target with numbers
				flow: Number(weight),
			}));

		const nodeColumns = new Map<string, number>();
		const processedNodes = new Set<string>();

		for (const { from } of sankeyData) {
			if (!processedNodes.has(from)) {
				nodeColumns.set(from, 0);
				processedNodes.add(from);
			}
		}

		let changed = true;
		while (changed) {
			changed = false;
			for (const { from, to } of sankeyData) {
				const fromColumn = nodeColumns.get(from) ?? 0;
				const existingColumn = nodeColumns.get(to);
				const newColumn = fromColumn + 1;

				if (!existingColumn || existingColumn < newColumn) {
					nodeColumns.set(to, newColumn);
					changed = true;
				}
				processedNodes.add(to);
			}
		}

		// Find initial nodes (those only appearing as source)
		const initialNodes = new Set<string>();
		const sourceNodes = new Set(sankeyData.map((d) => d.from));
		const targetNodes = new Set(sankeyData.map((d) => d.to));
		for (const node of sourceNodes) {
			if (!targetNodes.has(node)) {
				initialNodes.add(node);
			}
		}

		// Find final node for each game
		const gameLastNodes = new Map<string, string>();
		// Group nodes by game
		const gameNodes = new Map<string, Set<string>>();

		for (const node of processedNodes) {
			const gameName = getBaseGameName(node);
			if (!gameNodes.has(gameName)) {
				gameNodes.set(gameName, new Set());
			}
			gameNodes.get(gameName)?.add(node);
		}

		// For each game, find its last node(s)
		for (const [gameName, nodes] of gameNodes) {
			let maxColumn = -1;
			let lastNode = "";

			for (const node of nodes) {
				const column = nodeColumns.get(node) || 0;
				if (column > maxColumn) {
					maxColumn = column;
					lastNode = node;
				}
			}

			if (lastNode) {
				gameLastNodes.set(gameName, lastNode);
			}
		}

		// Create labels object - only show for source nodes and final sink nodes
		const sinkNodes = new Set<string>();
		for (const node of targetNodes) {
			if (!sourceNodes.has(node)) {
				sinkNodes.add(node);
			}
		}

		const sankeyLabels = Object.fromEntries(
			Array.from(processedNodes).map((node) => [
				node,
				initialNodes.has(node) || sinkNodes.has(node) ? node : "",
			]),
		);

		chartRef.current = new ChartJS(canvasRef.current, {
			type: "sankey",
			data: {
				datasets: [
					{
						data: sankeyData,
						labels: sankeyLabels,
						...CHART_CONFIG,
						colorFrom: (c) => {
							const fromNode = c.dataset.data[c.dataIndex].from;
							const baseGameName = getBaseGameName(fromNode);
							return gameColors.get(baseGameName) || "#94a3b8";
						},
						colorTo: (c) => {
							const toNode = c.dataset.data[c.dataIndex].to;
							const baseGameName = getBaseGameName(toNode);
							return gameColors.get(baseGameName) || "#94a3b8";
						},
						colorMode: "gradient",
					},
				],
			},
			options: CHART_OPTIONS,
		});

		return () => chartRef.current?.destroy();
	}, [results]);

	const chartTitle = canvasId.startsWith("long") ? "Long" : "Short";

	return (
		<div className="rounded-xl bg-white p-4 shadow-lg transition-shadow hover:shadow-xl sm:p-6">
			<div className="flex items-center justify-between mb-4 sm:mb-6">
				<h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
					{chartTitle} Winner
					{getWinner(results) ? ` 🏆 ${getWinner(results)}` : ""}
				</h2>
			</div>
			<div className="relative h-[24rem] w-full sm:h-[28rem] overflow-x-auto">
				<div className="min-w-[600px] h-full">
					{results.length > 0 ? (
						<canvas ref={canvasRef} />
					) : (
						<div className="flex h-full items-center justify-center">
							<p className="text-base font-medium text-gray-500 sm:text-lg">
								No votes available yet
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
