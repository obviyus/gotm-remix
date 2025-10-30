import { SankeyChart, type SankeySeriesOption } from "echarts/charts";
import {
	TooltipComponent,
	type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption, ECharts } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useEffect, useRef, useState } from "react";
import { getBaseGameName, getWinnerName } from "~/utils/votingResults";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);
type ECOption = ComposeOption<SankeySeriesOption | TooltipComponentOption>;

type SankeyDataType = "edge" | "node";

interface SankeyEdgeParams extends Omit<CallbackDataParams, "data"> {
	dataType: SankeyDataType;
	data: {
		source: string;
		target: string;
	};
}

interface SankeyDataPoint {
	source: string;
	target: string;
	weight: string | number;
}

interface SankeyProcessedData {
	nodes: Array<{
		name: string;
		itemStyle: { color: string; borderWidth: number };
		label: { position: "inside" | "left" | "right" | "top" | "bottom" };
	}>;
	links: Array<{ source: string; target: string; value: number }>;
	initialNodes: Set<string>;
	finalNodes: Set<string>;
}

interface VotingResultsChartProps {
	canvasId: string;
	results: SankeyDataPoint[];
	gameUrls?: Record<string, string>;
	showWinner?: boolean;
}

const COLOR_PALETTE = [
	"#60a5fa", // blue-400
	"#4ade80", // green-400
	"#c084fc", // purple-400
	"#fb923c", // orange-400
	"#22d3ee", // cyan-400
	"#f472b6", // pink-400
	"#818cf8", // indigo-400
	"#facc15", // yellow-400
	"#2dd4bf", // teal-400
];

const FULL_SIZE_STYLE = { width: "100%", height: "100%" } as const;

function buildSankeyData(results: SankeyDataPoint[]): SankeyProcessedData | null {
	if (!results || results.length === 0) {
		return null;
	}

	const filteredResults = results.filter(({ weight }) => Number(weight) > 0.01);
	if (filteredResults.length === 0) {
		return null;
	}

	const uniqueNodeNames = new Set<string>();
	for (const { source, target } of filteredResults) {
		uniqueNodeNames.add(source);
		uniqueNodeNames.add(target);
	}

	const uniqueBaseGames = new Set<string>(
		Array.from(uniqueNodeNames).map(getBaseGameName),
	);
	const gameColors = new Map<string, string>();
	Array.from(uniqueBaseGames).forEach((game, index) => {
		gameColors.set(game, COLOR_PALETTE[index % COLOR_PALETTE.length]);
	});

	const allSources = new Set(filteredResults.map((r) => r.source));
	const allTargets = new Set(filteredResults.map((r) => r.target));
	const initialNodes = new Set(
		[...allSources].filter((node) => !allTargets.has(node)),
	);
	const finalNodes = new Set(
		[...allTargets].filter((node) => !allSources.has(node)),
	);

	const nodes = Array.from(uniqueNodeNames).map((nodeName) => {
		const baseGame = getBaseGameName(nodeName);
		const color = gameColors.get(baseGame) || "#94a3b8";
		const isInitialNode = initialNodes.has(nodeName);
		const isFinalNode = finalNodes.has(nodeName);

		let labelPosition: "inside" | "left" | "right" | "top" | "bottom" =
			"inside";
		if (isInitialNode) {
			labelPosition = "right";
		} else if (isFinalNode) {
			labelPosition = "left";
		}

		return {
			name: nodeName,
			itemStyle: { color, borderWidth: 0 },
			label: { position: labelPosition },
		};
	});

	const links = filteredResults.map(({ source, target, weight }) => ({
		source,
		target,
		value: Number(weight),
	}));

	return { nodes, links, initialNodes, finalNodes };
}

export function VotingResultsChart({
	canvasId,
	results,
	gameUrls = {},
	showWinner = false,
}: VotingResultsChartProps) {
	const chartRef = useRef<HTMLDivElement | null>(null);
	const chartInstanceRef = useRef<ECharts | null>(null);
	const [processedData, setProcessedData] =
		useState<SankeyProcessedData | null>(null);

	useEffect(() => {
		if (!chartRef.current) {
			return;
		}

		if (!chartInstanceRef.current) {
			chartInstanceRef.current = echarts.init(chartRef.current);
		}

		const sankeyData = buildSankeyData(results);
		setProcessedData(sankeyData);

		if (!sankeyData) {
			chartInstanceRef.current?.clear();
			return;
		}

		const { nodes, links, initialNodes, finalNodes } = sankeyData;
		const options: ECOption = {
			tooltip: {
				// Tooltip config remains the same
				trigger: "item",
				triggerOn: "mousemove",
				formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
					const param = Array.isArray(params) ? params[0] : params;
					const sankeyParams = param as SankeyEdgeParams;

					if (sankeyParams.dataType === "edge") {
						const sourceBase = getBaseGameName(sankeyParams.data.source);
						const targetBase = getBaseGameName(sankeyParams.data.target);
						const value = Math.round(sankeyParams.value as number);
						return `${targetBase} got ${value} votes from ${sourceBase}`;
					}
					if (sankeyParams.dataType === "node") {
						const baseName = getBaseGameName(sankeyParams.name);
						const nodeValue = Math.round(sankeyParams.value as number);
						return `${sankeyParams.name} - ${baseName}<br/>Total Votes: ${nodeValue}`;
					}
					return "";
				},
			},
			series: [
				{
					type: "sankey",
					data: nodes,
					links: links,
					emphasis: { focus: "adjacency" },
					nodeWidth: 30,
					nodeGap: 30,
					nodeAlign: "justify",
					draggable: false,
					left: 20,
					right: 60,
					top: 20,
					bottom: 20,

					label: {
						show: true,
						color: "white",
						fontSize: 12,
						fontWeight: "bold",
						formatter: (params: CallbackDataParams) => {
							const nodeName = params.name;
							const nodeValue = Math.round(params.value as number);

							// Display full name ONLY for initial and final nodes
							if (initialNodes.has(nodeName) || finalNodes.has(nodeName)) {
								return nodeName;
							}
							return `${nodeValue}`;
						},
					},
					lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.7 },
				},
			],
		};

		chartInstanceRef.current.setOption(options, true);
	}, [results]);

	useEffect(() => {
		const chartInstance = chartInstanceRef.current;
		if (!chartInstance) return;
		const handleResize = () => {
			chartInstance.resize();
		};
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	useEffect(() => {
		return () => {
			if (chartInstanceRef.current) {
				chartInstanceRef.current.dispose();
				chartInstanceRef.current = null;
			}
		};
	}, []);

	const chartTitle = canvasId.startsWith("long") ? "Long" : "Short";
	const winner = getWinnerName(results);
	const winnerUrl = winner ? gameUrls[winner] : null;

	return (
		<div className="rounded-xl bg-zinc-800 p-4 shadow-lg transition-shadow hover:shadow-xl sm:p-6 ring-1 ring-zinc-700">
			<div className="flex items-center justify-between mb-4 sm:mb-6">
				<h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
					{chartTitle}
					{showWinner && winner ? (
						<>
							{" 🏆 "}
							{winnerUrl ? (
								<a
									href={winnerUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-400 hover:text-purple-300 transition-colors"
								>
									{winner}
								</a>
							) : (
								winner
							)}
						</>
					) : null}
				</h2>
			</div>
			<div className="relative h-[24rem] w-full sm:h-[28rem] overflow-x-auto">
				<div className="min-w-[600px] h-full">
					<div ref={chartRef} style={FULL_SIZE_STYLE} />
					{!processedData && (
						<div className="absolute inset-0 flex h-full items-center justify-center pointer-events-none">
							<p className="text-base font-medium text-zinc-400 sm:text-lg">
								{results.length === 0
									? "No voting results available yet"
									: "Processing results..."}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
