import type { SankeySeriesOption } from "echarts/charts";
import type { TooltipComponentOption } from "echarts/components";
import type { ComposeOption, ECharts } from "echarts/core";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import type { VotingTimelapseFrame } from "~/server/voting.server";
import { getBaseGameName, getWinnerName } from "~/utils/votingResults";

type ECOption = ComposeOption<SankeySeriesOption | TooltipComponentOption>;

type SankeyDataType = "edge" | "node";

interface SankeyEdgeParams extends Omit<CallbackDataParams, "data"> {
	dataType: SankeyDataType;
	data: {
		source: string;
		target: string;
	};
}

export interface SankeyDataPoint {
	source: string;
	target: string;
	weight: string | number;
}

export interface SankeyProcessedData {
	nodes: Array<{
		name: string;
		itemStyle: { color: string; borderWidth: number };
		label: { position: "inside" | "left" | "right" | "top" | "bottom" };
		depth: number;
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
	timelapse?: {
		frames: VotingTimelapseFrame[];
		totalVotes: number;
	};
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
const FRAME_DURATION_MS = 700;

// AIDEV-NOTE: Lazy-load ECharts to keep base bundle smaller; cache promise to avoid re-import churn.
let echartsPromise: Promise<typeof import("echarts/core")> | null = null;
export const loadEcharts = () => {
	if (!echartsPromise) {
		echartsPromise = Promise.all([
			import("echarts/core"),
			import("echarts/charts"),
			import("echarts/components"),
			import("echarts/renderers"),
		]).then(([echartsCore, charts, components, renderers]) => {
			echartsCore.use([charts.SankeyChart, components.TooltipComponent, renderers.CanvasRenderer]);
			return echartsCore;
		});
	}
	return echartsPromise;
};

export const prefetchEcharts = () => {
	if (typeof window === "undefined") return;
	void loadEcharts();
};

export function buildSankeyData(
	results: SankeyDataPoint[],
	gameColorsOverride?: Map<string, string>,
): SankeyProcessedData | null {
	if (!results || results.length === 0) {
		return null;
	}

	const getNodeDepth = (nodeName: string): number => {
		const trimmed = nodeName.trimEnd();
		const trailingSpaces = nodeName.length - trimmed.length;
		if (trailingSpaces <= 1) {
			return 0;
		}
		return trailingSpaces - 1;
	};

	const filteredResults = results.filter(({ weight }) => Number(weight) > 0.01);
	if (filteredResults.length === 0) {
		return null;
	}

	// Single-pass: collect nodes, sources, targets, and base games simultaneously
	const uniqueNodeNames = new Set<string>();
	const uniqueBaseGames = new Set<string>();
	const allSources = new Set<string>();
	const allTargets = new Set<string>();

	for (const { source, target } of filteredResults) {
		uniqueNodeNames.add(source);
		uniqueNodeNames.add(target);
		uniqueBaseGames.add(getBaseGameName(source));
		uniqueBaseGames.add(getBaseGameName(target));
		allSources.add(source);
		allTargets.add(target);
	}

	// Assign colors without intermediate array allocation
	const gameColors = gameColorsOverride ?? new Map<string, string>();
	if (!gameColorsOverride) {
		let colorIndex = 0;
		for (const game of uniqueBaseGames) {
			gameColors.set(game, COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length]);
		}
	}

	// Compute initial/final nodes without spread operator allocation
	const initialNodes = new Set<string>();
	const finalNodes = new Set<string>();
	for (const node of allSources) {
		if (!allTargets.has(node)) initialNodes.add(node);
	}
	for (const node of allTargets) {
		if (!allSources.has(node)) finalNodes.add(node);
	}

	const nodes = Array.from(uniqueNodeNames).map((nodeName) => {
		const baseGame = getBaseGameName(nodeName);
		const color = gameColors.get(baseGame) || "#94a3b8";
		const isInitialNode = initialNodes.has(nodeName);
		const isFinalNode = finalNodes.has(nodeName);
		const depth = getNodeDepth(nodeName);

		let labelPosition: "inside" | "left" | "right" | "top" | "bottom" = "inside";
		if (isInitialNode) {
			labelPosition = "right";
		} else if (isFinalNode) {
			labelPosition = "left";
		}

		return {
			name: nodeName,
			itemStyle: { color, borderWidth: 0 },
			label: { position: labelPosition },
			depth,
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
	timelapse,
}: VotingResultsChartProps) {
	const chartRef = useRef<HTMLDivElement | null>(null);
	const chartInstanceRef = useRef<ECharts | null>(null);
	const [processedData, setProcessedData] = useState<SankeyProcessedData | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playIndex, setPlayIndex] = useState(0);

	const timelapseFrames = timelapse?.frames ?? [];
	const hasTimelapse = timelapseFrames.length > 1;
	const activeFrame = isPlaying ? timelapseFrames[playIndex] : null;
	const activeResults = activeFrame?.results ?? results;
	const stableGameColors = useMemo(() => {
		const baseGames = new Set<string>();
		const collectBaseGames = (items: SankeyDataPoint[]) => {
			for (const item of items) {
				baseGames.add(getBaseGameName(item.source));
				baseGames.add(getBaseGameName(item.target));
			}
		};
		collectBaseGames(results);
		for (const frame of timelapseFrames) {
			collectBaseGames(frame.results);
		}
		const orderedGames = Array.from(baseGames).sort((a, b) => a.localeCompare(b));
		const colorMap = new Map<string, string>();
		orderedGames.forEach((game, index) => {
			colorMap.set(game, COLOR_PALETTE[index % COLOR_PALETTE.length]);
		});
		return colorMap;
	}, [results, timelapseFrames]);

	useEffect(() => {
		let isActive = true;

		const setupChart = async () => {
			if (!chartRef.current) return;

			const echartsCore = await loadEcharts();
			if (!isActive || !chartRef.current) return;

			if (!chartInstanceRef.current) {
				chartInstanceRef.current = echartsCore.init(chartRef.current);
			}

			const sankeyData = buildSankeyData(activeResults, stableGameColors);
			if (!isActive) return;
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
							lineHeight: 16,
							overflow: "break",
							distance: 8,
							formatter: (params: CallbackDataParams) => {
								const rawName = params.name;
								if (typeof rawName !== "string") {
									return "";
								}
								const trimmedNodeName = rawName.trimEnd();
								const baseName = getBaseGameName(trimmedNodeName);
								const nodeValue = Math.round(Number(params.value ?? 0));
								const hasNameLabel = initialNodes.has(rawName) || finalNodes.has(rawName);

								if (hasNameLabel) {
									return nodeValue > 0 ? `${baseName}\n${nodeValue}` : baseName;
								}

								return nodeValue > 0 ? `${nodeValue}` : "";
							},
						},
						labelLayout: (layoutParams) => {
							if (layoutParams.dataType === "node") {
								return {
									hideOverlap: true,
									moveOverlap: "shiftX",
								};
							}
							return {};
						},
						lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.7 },
					},
				],
			};

			chartInstanceRef.current.setOption(options, true);
		};

		void setupChart();

		return () => {
			isActive = false;
		};
	}, [activeResults]);

	useEffect(() => {
		if (!isPlaying) return;
		if (timelapseFrames.length <= 1) return;
		if (playIndex >= timelapseFrames.length - 1) {
			setIsPlaying(false);
			return;
		}
		const timer = window.setTimeout(() => {
			setPlayIndex((prev) => Math.min(prev + 1, timelapseFrames.length - 1));
		}, FRAME_DURATION_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [isPlaying, playIndex, timelapseFrames.length]);

	useEffect(() => {
		if (!isPlaying) {
			setPlayIndex(0);
		}
	}, [isPlaying, results]);

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
	const timelapseProgress =
		activeFrame && timelapse
			? `${activeFrame.voteCount.toLocaleString()} / ${timelapse.totalVotes.toLocaleString()} votes`
			: null;

	const handlePlay = () => {
		if (!hasTimelapse) return;
		setPlayIndex(0);
		setIsPlaying(true);
	};

	const handleStop = () => {
		setIsPlaying(false);
	};

	return (
		<div className="rounded-xl bg-zinc-800 p-4 shadow-lg transition-shadow hover:shadow-xl sm:p-6 ring-1 ring-zinc-700">
			<div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
				<div>
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
					{timelapseProgress ? (
						<p className="text-xs text-zinc-400 mt-1">Timelapse {timelapseProgress}</p>
					) : null}
				</div>
				{hasTimelapse ? (
					<Button variant="secondary" size="sm" onClick={isPlaying ? handleStop : handlePlay}>
						{isPlaying ? "Stop playback" : "Play timelapse"}
					</Button>
				) : null}
			</div>
			<div className="relative h-96 w-full sm:h-112 overflow-x-auto">
				<div className="min-w-150 h-full">
					<div ref={chartRef} style={FULL_SIZE_STYLE} />
					{!processedData && (
						<div className="absolute inset-0 flex h-full items-center justify-center pointer-events-none">
							<p className="text-base font-medium text-zinc-400 sm:text-lg">
								{results.length === 0 ? "No voting results available yet" : "Processing results…"}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
