import * as stylex from "@stylexjs/stylex";

// At-rule strings usable as condition keys inside `stylex.create`. The pixel
// boundaries match the breakpoints the site shipped with, so a layout that
// changed at 768px still changes at 768px.
export const media = stylex.defineConsts({
	sm: "@media (min-width: 640px)",
	md: "@media (min-width: 768px)",
	lg: "@media (min-width: 1024px)",
	xl: "@media (min-width: 1280px)",
	reducedMotion: "@media (prefers-reduced-motion: reduce)",
	backdropFilter: "@supports (backdrop-filter: blur(0))",
});

// Only values with more than one owning module live here. One-off colours stay
// beside the component that uses them.
export const color = stylex.defineVars({
	canvas: "oklch(21% 0.006 285.885)",
	surface: "oklch(27.4% 0.006 286.033)",
	surfaceRaised: "oklch(37% 0.013 285.805)",
	heading: "oklch(96.7% 0.001 286.375)",
	body: "oklch(92% 0.004 286.32)",
	muted: "oklch(70.5% 0.015 286.067)",
	dim: "oklch(55.2% 0.016 285.938)",
	link: "oklch(70.7% 0.165 254.624)",
	linkHover: "oklch(80.9% 0.105 251.813)",
	action: "oklch(54.6% 0.245 262.881)",
	actionHover: "oklch(48.8% 0.243 264.376)",
	focus: "oklch(62.3% 0.214 259.815)",
	affirm: "oklch(69.6% 0.17 162.48)",
	deny: "oklch(63.7% 0.237 25.331)",
	award: "oklch(76.9% 0.188 70.08)",
	white: "#fff",
});

// `--radius` was 0.625rem; these are the sizes the old utilities resolved to.
export const radius = stylex.defineConsts({
	xs: "0.125rem",
	sm: "calc(0.625rem - 4px)",
	base: "0.25rem",
	md: "calc(0.625rem - 2px)",
	lg: "0.625rem",
	xl: "calc(0.625rem + 4px)",
	pill: "9999px",
});

export const motion = stylex.defineConsts({
	duration: "0.15s",
	easing: "cubic-bezier(0.4, 0, 0.2, 1)",
});
