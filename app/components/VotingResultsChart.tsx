import * as stylex from "@stylexjs/stylex";
import type { SankeySeriesOption } from "echarts/charts";
import type { TooltipComponentOption } from "echarts/components";
import type { ComposeOption, ECharts } from "echarts/core";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import type { VotingTimelapseFrame } from "~/server/voting.server";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import { getBaseGameName, getNodeVoteCount, getWinnerName } from "~/utils/votingResults";

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
	title: string;
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

const FRAME_DURATION_MS = 700;
const EMPTY_GAME_URLS: Record<string, string> = {};
const EMPTY_TIMELAPSE_FRAMES: VotingTimelapseFrame[] = [];

const styles = stylex.create({
	panel: {
		backgroundColor: color.surface,
		borderRadius: radius.xl,
		boxShadow: {
			default:
				"0 0 0 1px oklch(37% 0.013 285.805), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
			":hover":
				"0 0 0 1px oklch(37% 0.013 285.805), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
		},
		padding: { default: 16, [media.sm]: 24 },
		transitionDuration: motion.duration,
		transitionProperty: "box-shadow",
		transitionTimingFunction: motion.easing,
	},
	header: {
		alignItems: { default: null, [media.sm]: "center" },
		display: "flex",
		flexDirection: { default: "column", [media.sm]: "row" },
		gap: 12,
		justifyContent: { default: null, [media.sm]: "space-between" },
		marginBottom: { default: 16, [media.sm]: 24 },
	},
	title: {
		color: color.heading,
		fontSize: { default: "1.25rem", [media.sm]: "1.5rem" },
		fontWeight: 700,
		letterSpacing: "-0.025em",
		lineHeight: { default: 1.4, [media.sm]: 1.3333 },
	},
	winnerLink: {
		color: { default: color.link, ":hover": "oklch(82.7% 0.119 306.383)" },
		transitionDuration: motion.duration,
		transitionProperty: "color, background-color, border-color",
		transitionTimingFunction: motion.easing,
	},
	progress: {
		color: color.muted,
		fontSize: "0.75rem",
		lineHeight: 1.3333,
		marginTop: 4,
	},
	// ECharts measures its host after layout, so the scroll container fixes the
	// height and the inner track fixes a minimum width before the canvas mounts.
	scroller: {
		height: { default: "24rem", [media.sm]: "28rem" },
		overflowX: "auto",
		position: "relative",
		width: "100%",
	},
	track: {
		height: "100%",
		minWidth: "37.5rem",
	},
	chartFill: {
		height: "100%",
		width: "100%",
	},
	placeholder: {
		alignItems: "center",
		display: "flex",
		height: "100%",
		inset: 0,
		justifyContent: "center",
		pointerEvents: "none",
		position: "absolute",
	},
	placeholderText: {
		color: color.muted,
		fontSize: { default: "1rem", [media.sm]: "1.125rem" },
		fontWeight: 500,
		lineHeight: { default: 1.5, [media.sm]: 1.5556 },
	},
});

// AIDEV-NOTE: Lazy-load ECharts to keep base bundle smaller; cache promise to avoid re-import churn.
let echartsPromise: Promise<typeof import("echarts/core")> | null = null;
const loadEcharts = () => {
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

function buildSankeyData(
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
	title,
	results,
	gameUrls = EMPTY_GAME_URLS,
	showWinner = false,
	timelapse,
}: VotingResultsChartProps) {
	const chartRef = useRef<HTMLDivElement | null>(null);
	const chartInstanceRef = useRef<ECharts | null>(null);
	const [processedData, setProcessedData] = useState<SankeyProcessedData | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playIndex, setPlayIndex] = useState(0);

	const timelapseFrames = timelapse?.frames ?? EMPTY_TIMELAPSE_FRAMES;
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
							const nodeValue = getNodeVoteCount(sankeyParams.name);
							return `${sankeyParams.name} - ${baseName}<br/>Total Votes: ${nodeValue}`;
						}
						return "";
					},
				},
				series: [
					{
						type: "sankey",
						animationDuration: isPlaying ? 300 : 0,
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
								const nodeValue = getNodeVoteCount(trimmedNodeName);
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
	}, [activeResults, isPlaying, stableGameColors]);

	useEffect(() => {
		if (!isPlaying) return;
		if (timelapseFrames.length <= 1) return;
		if (playIndex >= timelapseFrames.length - 1) return;

		const lastFrameIndex = timelapseFrames.length - 1;
		const timer = window.setTimeout(() => {
			const nextIndex = Math.min(playIndex + 1, lastFrameIndex);
			setPlayIndex(nextIndex);
			if (nextIndex === lastFrameIndex) {
				setIsPlaying(false);
			}
		}, FRAME_DURATION_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [isPlaying, playIndex, timelapseFrames.length]);

	useEffect(() => {
		const handleResize = () => {
			chartInstanceRef.current?.resize();
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
		setPlayIndex(0);
	};

	return (
		<div {...stylex.props(styles.panel)}>
			<div {...stylex.props(styles.header)}>
				<div>
					<h2 {...stylex.props(styles.title)}>
						{title}
						{showWinner && winner ? (
							<>
								{" 🏆 "}
								{winnerUrl ? (
									<a
										href={winnerUrl}
										target="_blank"
										rel="noopener noreferrer"
										{...stylex.props(styles.winnerLink)}
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
						<p {...stylex.props(styles.progress)}>Timelapse {timelapseProgress}</p>
					) : null}
				</div>
				{hasTimelapse ? (
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={isPlaying ? handleStop : handlePlay}
					>
						{isPlaying ? "Stop playback" : "Play timelapse"}
					</Button>
				) : null}
			</div>
			<div {...stylex.props(styles.scroller)}>
				<div {...stylex.props(styles.track)}>
					<div ref={chartRef} {...stylex.props(styles.chartFill)} />
					{!processedData && (
						<div {...stylex.props(styles.placeholder)}>
							<p {...stylex.props(styles.placeholderText)}>
								{results.length === 0 ? "No voting results available yet" : "Processing results…"}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
