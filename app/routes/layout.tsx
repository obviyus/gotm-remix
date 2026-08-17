import { Collapsible } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { requestUserContext } from "~/route-context.server";
import { getCurrentMonth } from "~/server/month.server";
import { control } from "~/styles/markers.stylex";
import { color, media, motion, radius } from "~/styles/tokens.stylex";
import { DISCORD_INVITE_URL } from "~/utils/seo";
import type { Route } from "./+types/layout";

export async function loader({ context }: Route.LoaderArgs) {
	const currentMonth = await getCurrentMonth();
	const user = context.get(requestUserContext);

	return Response.json({
		monthStatus: currentMonth?.status || "ready",
		isAdmin: user?.isAdmin ?? false,
		discordId: user?.discordId ?? null,
		discordAvatarUrl: user?.discordAvatarUrl ?? null,
		pseudoHandle: user?.pseudoHandle ?? null,
	});
}

const menuOpen = stylex.keyframes({
	from: { opacity: 0, transform: "translateY(-0.5rem)" },
});
const menuClosed = stylex.keyframes({
	to: { opacity: 0, transform: "translateY(-0.5rem)" },
});

const styles = stylex.create({
	shell: {
		backgroundColor: color.canvas,
		display: "flex",
		flexDirection: "column",
		minHeight: "100vh",
	},
	skipLink: {
		backgroundColor: color.action,
		borderRadius: radius.md,
		borderWidth: 0,
		clipPath: { default: "inset(50%)", ":focus": "none" },
		color: color.white,
		fontSize: "0.875rem",
		fontWeight: 500,
		height: { default: 1, ":focus": "auto" },
		left: { default: null, ":focus": 12 },
		lineHeight: 1.4286,
		margin: { default: -1, ":focus": 0 },
		overflow: { default: "hidden", ":focus": "visible" },
		paddingBlock: { default: 0, ":focus": 8 },
		paddingInline: { default: 0, ":focus": 12 },
		position: { default: "absolute", ":focus": "absolute" },
		top: { default: null, ":focus": 12 },
		whiteSpace: { default: "nowrap", ":focus": "normal" },
		width: { default: 1, ":focus": "auto" },
		zIndex: { default: null, ":focus": 50 },
		boxShadow: {
			default: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
			":focus":
				"0 0 0 2px oklch(70.7% 0.165 254.624 / 0.7), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		},
		outlineStyle: { default: null, ":focus": "none" },
	},
	nav: {
		backgroundColor: color.canvas,
		borderBottomColor: color.surface,
		borderBottomWidth: 1,
	},
	navInner: {
		paddingInline: { default: 8, [media.sm]: 16, [media.lg]: 32 },
		width: "100%",
	},
	navRow: {
		display: "flex",
		height: 64,
		justifyContent: { default: "space-between", [media.md]: "center" },
		position: "relative",
	},
	mobileBar: {
		alignItems: "center",
		display: { default: "flex", [media.md]: "none" },
		gap: 16,
	},
	menuButton: {
		borderRadius: radius.md,
		color: { default: color.muted, ":hover": color.heading },
		boxShadow: {
			default: null,
			":focus-visible":
				"0 0 0 2px oklch(21% 0.006 285.885), 0 0 0 4px oklch(62.3% 0.214 259.815 / 0.7)",
		},
		outlineStyle: { default: null, ":focus-visible": "none" },
	},
	menuIcon: {
		height: 24,
		width: 24,
	},
	activeTab: {
		color: color.heading,
		fontSize: "1.125rem",
		fontWeight: 700,
		lineHeight: 1.5556,
	},
	desktopNav: {
		display: { default: "none", [media.md]: "flex" },
		alignItems: { default: null, [media.md]: "center" },
		justifyContent: { default: null, [media.md]: "center" },
		marginInline: "auto",
		maxWidth: "100%",
		overflowX: "auto",
		width: "100%",
	},
	navGroups: {
		alignItems: "center",
		display: "flex",
		flexWrap: "nowrap",
		gap: { default: 8, [media.sm]: 12, [media.md]: 16, [media.lg]: 32 },
		justifyContent: "center",
		paddingInline: 8,
	},
	navGroup: {
		alignItems: "center",
		display: "flex",
		gap: { default: 8, [media.sm]: 12, [media.md]: 16 },
	},
	centerGroup: {
		alignItems: "center",
		borderInlineColor: color.surface,
		borderInlineWidth: 1,
		display: "flex",
		paddingInline: { default: 8, [media.sm]: 12, [media.md]: 16 },
	},
	navLink: {
		alignItems: "center",
		borderRadius: radius.lg,
		borderWidth: 1,
		color: color.white,
		display: "flex",
		fontSize: { default: "0.8rem", [media.md]: "0.875rem" },
		fontWeight: 500,
		gap: 8,
		justifyContent: "center",
		overflow: "hidden",
		paddingBlock: 8,
		paddingInline: { default: 8, [media.sm]: 12, [media.md]: 16 },
		position: "relative",
		transitionDuration: "0.3s",
		transitionProperty: "all",
		transitionTimingFunction: motion.easing,
		whiteSpace: "nowrap",
		outlineStyle: { default: null, ":focus-visible": "none" },
		"::after": {
			content: "''",
			inset: 0,
			position: "absolute",
			transitionDuration: motion.duration,
			transitionProperty: "color, background-color, border-color",
			transitionTimingFunction: motion.easing,
		},
	},
	desktopLink: {
		minWidth: "max-content",
		width: { default: "6.5rem", [media.md]: "7rem", [media.lg]: "8rem" },
	},
	mobileLink: {
		width: "100%",
	},
	activeLink: {
		backgroundColor: "oklch(54.6% 0.245 262.881 / 0.2)",
		borderColor: "oklch(62.3% 0.214 259.815 / 0.6)",
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(54.6% 0.245 262.881 / 0.6), 0 1px 2px -1px oklch(54.6% 0.245 262.881 / 0.6)",
			":focus-visible":
				"0 0 0 2px oklch(21% 0.006 285.885), 0 0 0 4px oklch(62.3% 0.214 259.815 / 0.6), 0 1px 3px 0 oklch(54.6% 0.245 262.881 / 0.6), 0 1px 2px -1px oklch(54.6% 0.245 262.881 / 0.6)",
		},
		"::after": { backgroundColor: "oklch(62.3% 0.214 259.815 / 0.2)" },
	},
	inactiveLink: {
		backgroundColor: { default: null, ":hover": "oklch(55.2% 0.016 285.938 / 0.2)" },
		borderColor: {
			default: "oklch(70.5% 0.015 286.067 / 0.3)",
			":hover": "oklch(87.1% 0.006 286.286 / 0.5)",
		},
		boxShadow: {
			default:
				"0 1px 3px 0 oklch(55.2% 0.016 285.938 / 0.3), 0 1px 2px -1px oklch(55.2% 0.016 285.938 / 0.3)",
			":hover":
				"0 1px 3px 0 oklch(70.5% 0.015 286.067 / 0.6), 0 1px 2px -1px oklch(70.5% 0.015 286.067 / 0.6)",
			":focus-visible":
				"0 0 0 2px oklch(21% 0.006 285.885), 0 0 0 4px oklch(62.3% 0.214 259.815 / 0.6), 0 1px 3px 0 oklch(55.2% 0.016 285.938 / 0.3), 0 1px 2px -1px oklch(55.2% 0.016 285.938 / 0.3)",
		},
		"::after": {
			backgroundColor: { default: "transparent", ":hover": "oklch(87.1% 0.006 286.286 / 0.2)" },
		},
	},
	navLabel: {
		alignItems: "center",
		display: "flex",
		fontSize: { default: "0.75rem", [media.sm]: "0.875rem" },
		gap: { default: 4, [media.sm]: 8 },
		justifyContent: "center",
		position: "relative",
		transform: { default: null, [stylex.when.ancestor(":hover", control)]: "scale(1.05)" },
		transitionDuration: motion.duration,
		transitionProperty: "transform, translate, scale, rotate",
		transitionTimingFunction: motion.easing,
		zIndex: 10,
	},
	centerLabel: {
		fontSize: { default: "0.8rem", [media.md]: "0.875rem" },
	},
	profileTrigger: {
		alignItems: "center",
		backgroundColor: {
			default: "oklch(27.4% 0.006 286.033 / 0.6)",
			":hover": "oklch(37% 0.013 285.805 / 0.6)",
		},
		borderColor: "oklch(37% 0.013 285.805 / 0.7)",
		borderRadius: radius.pill,
		borderWidth: 1,
		color: "oklch(80.9% 0.105 251.813)",
		display: "inline-flex",
		justifyContent: "center",
		padding: 8,
		position: { default: null, [media.md]: "absolute" },
		right: { default: null, [media.md]: 0 },
		top: { default: null, [media.md]: "50%" },
		translate: { default: null, [media.md]: "0 -50%" },
		boxShadow: {
			default: null,
			":focus-visible":
				"0 0 0 2px oklch(21% 0.006 285.885), 0 0 0 4px oklch(62.3% 0.214 259.815 / 0.7)",
		},
		outlineStyle: { default: null, ":focus-visible": "none" },
	},
	triggerAvatar: {
		borderRadius: radius.pill,
		height: 24,
		objectFit: "cover",
		width: 24,
	},
	profilePanel: {
		backgroundColor: color.canvas,
		borderColor: color.surfaceRaised,
		borderWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
		color: color.heading,
		padding: 12,
		width: "18rem",
	},
	srOnly: {
		borderWidth: 0,
		clipPath: "inset(50%)",
		height: 1,
		margin: -1,
		overflow: "hidden",
		padding: 0,
		position: "absolute",
		whiteSpace: "nowrap",
		width: 1,
	},
	panelAvatar: {
		borderColor: color.surfaceRaised,
		borderRadius: radius.pill,
		borderWidth: 1,
		height: 40,
		marginBottom: 12,
		objectFit: "cover",
		width: 40,
	},
	fieldLabel: {
		color: color.muted,
		fontSize: "0.75rem",
		letterSpacing: "0.025em",
		lineHeight: 1.3333,
		textTransform: "uppercase",
	},
	fieldLabelSpaced: {
		marginTop: 12,
	},
	fieldValue: {
		color: color.heading,
		fontSize: "0.875rem",
		fontWeight: 600,
		lineHeight: 1.4286,
		marginTop: 4,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	fieldMono: {
		color: color.body,
		fontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		fontSize: "0.75rem",
		lineHeight: 1.3333,
		marginTop: 4,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	avatarSpacer: {
		display: { default: "block", [media.md]: "none" },
		width: 40,
	},
	menuPanel: {
		animationDuration: "0.2s",
		animationName: {
			default: null,
			":is([data-open])": menuOpen,
			":is([data-closed])": menuClosed,
			[media.reducedMotion]: "none",
		},
		animationTimingFunction: motion.easing,
		backgroundColor: color.canvas,
		borderBottomColor: color.surface,
		borderBottomWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		display: { default: null, [media.md]: "none" },
		left: 0,
		position: "fixed",
		right: 0,
		top: 64,
		zIndex: 50,
	},
	menuList: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		paddingBottom: 12,
		paddingInline: 8,
		paddingTop: 8,
	},
	main: {
		flex: 1,
		marginInline: "auto",
		maxWidth: "80rem",
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
		width: "100%",
	},
	footer: {
		borderTopColor: color.surface,
		borderTopWidth: 1,
		paddingBlock: 16,
	},
	footerInner: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		marginInline: "auto",
		maxWidth: "64rem",
		paddingInline: { default: 16, [media.sm]: 24, [media.lg]: 32 },
	},
	footerText: {
		color: color.muted,
		fontSize: "0.875rem",
		lineHeight: 1.4286,
		textAlign: "center",
	},
	footerLink: {
		color: { default: color.link, ":hover": color.linkHover },
		textDecorationLine: { default: null, ":hover": "underline" },
	},
});

export default function Layout({ loaderData }: Route.ComponentProps) {
	const location = useLocation();
	const { monthStatus, isAdmin, discordId, discordAvatarUrl, pseudoHandle } = loaderData;
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const getCenterItem = () => {
		switch (monthStatus) {
			case "nominating":
				return { path: "/nominate", label: "Nominate" };
			case "voting":
				return { path: "/voting", label: "Vote" };
			case "jury":
			case "playing":
			case "over":
				return null;
			default:
				return { path: "/", label: "GOTM" };
		}
	};

	const centerItem = getCenterItem();
	const navLinks = [
		{ path: "/", label: "GOTM" },
		{ path: "/history", label: "History" },
		...(centerItem ? [centerItem] : []),
		{ path: "/stats", label: "Stats" },
		{ path: "/patience", label: "Patience" },
		// Only show admin link for jury members
		...(isAdmin ? [{ path: "/admin", label: "Admin" }] : []),
	];

	const activeTab = navLinks.find((link) => link.path === location.pathname)?.label || "GOTM";
	const closeMobileMenu = () => {
		setIsMobileMenuOpen(false);
	};
	const avatarAlt = pseudoHandle ? `${pseudoHandle} avatar` : "User avatar";
	const linkState = (path: string) =>
		location.pathname === path ? styles.activeLink : styles.inactiveLink;

	return (
		<div {...stylex.props(styles.shell)}>
			<a href="#main-content" {...stylex.props(styles.skipLink)}>
				Skip to content
			</a>
			<nav {...stylex.props(styles.nav)}>
				<Collapsible.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
					<div {...stylex.props(styles.navInner)}>
						<div {...stylex.props(styles.navRow)}>
							{/* Mobile menu button and active page title */}
							<div {...stylex.props(styles.mobileBar)}>
								<Collapsible.Trigger {...stylex.props(styles.menuButton)}>
									<span {...stylex.props(styles.srOnly)}>
										{isMobileMenuOpen ? "Close main menu" : "Open main menu"}
									</span>
									{!isMobileMenuOpen ? (
										<Menu {...stylex.props(styles.menuIcon)} aria-hidden="true" />
									) : (
										<X {...stylex.props(styles.menuIcon)} aria-hidden="true" />
									)}
								</Collapsible.Trigger>
								<span {...stylex.props(styles.activeTab)}>{activeTab}</span>
							</div>

							{/* Desktop navigation */}
							<div {...stylex.props(styles.desktopNav)}>
								<div {...stylex.props(styles.navGroups)}>
									<div {...stylex.props(styles.navGroup)}>
										{navLinks
											.filter((link) => link.path === "/" || link.path === "/history")
											.map((link) => (
												<Link
													key={link.path}
													to={link.path}
													prefetch="viewport"
													aria-current={location.pathname === link.path ? "page" : undefined}
													onClick={closeMobileMenu}
													{...stylex.props(
														control,
														styles.navLink,
														styles.desktopLink,
														linkState(link.path),
													)}
												>
													<span {...stylex.props(styles.navLabel)}>{link.label}</span>
												</Link>
											))}
									</div>

									{centerItem && (
										<div {...stylex.props(styles.centerGroup)}>
											<Link
												to={centerItem.path}
												prefetch="viewport"
												aria-current={location.pathname === centerItem.path ? "page" : undefined}
												onClick={closeMobileMenu}
												{...stylex.props(
													control,
													styles.navLink,
													styles.desktopLink,
													linkState(centerItem.path),
												)}
											>
												<span {...stylex.props(styles.navLabel, styles.centerLabel)}>
													{centerItem.label}
												</span>
											</Link>
										</div>
									)}

									<div {...stylex.props(styles.navGroup)}>
										{navLinks
											.filter(
												(link) =>
													link.path !== "/" &&
													link.path !== "/history" &&
													link.path !== centerItem?.path,
											)
											.map((link) => (
												<Link
													key={link.path}
													to={link.path}
													prefetch="viewport"
													aria-current={location.pathname === link.path ? "page" : undefined}
													onClick={closeMobileMenu}
													{...stylex.props(
														control,
														styles.navLink,
														styles.desktopLink,
														linkState(link.path),
													)}
												>
													<span {...stylex.props(styles.navLabel)}>{link.label}</span>
												</Link>
											))}
									</div>
								</div>
							</div>

							{pseudoHandle ? (
								<Popover>
									<PopoverTrigger
										aria-label="Open profile details"
										{...stylex.props(styles.profileTrigger)}
									>
										{discordAvatarUrl && (
											<img
												src={discordAvatarUrl}
												alt={avatarAlt}
												{...stylex.props(styles.triggerAvatar)}
											/>
										)}
									</PopoverTrigger>
									{discordId && (
										<PopoverContent align="end" sideOffset={8} style={styles.profilePanel}>
											<PopoverTitle style={styles.srOnly}>Profile details</PopoverTitle>
											{discordAvatarUrl && (
												<img
													src={discordAvatarUrl}
													alt={avatarAlt}
													{...stylex.props(styles.panelAvatar)}
												/>
											)}
											<p {...stylex.props(styles.fieldLabel)}>Name</p>
											<p {...stylex.props(styles.fieldValue)}>{pseudoHandle}</p>
											<p {...stylex.props(styles.fieldLabel, styles.fieldLabelSpaced)}>ID</p>
											<p {...stylex.props(styles.fieldMono)}>{discordId}</p>
										</PopoverContent>
									)}
								</Popover>
							) : (
								<div {...stylex.props(styles.avatarSpacer)} />
							)}
						</div>
					</div>

					<Collapsible.Panel {...stylex.props(styles.menuPanel)}>
						<div {...stylex.props(styles.menuList)}>
							{navLinks.map((link) => (
								<Link
									key={link.path}
									to={link.path}
									prefetch="viewport"
									aria-current={location.pathname === link.path ? "page" : undefined}
									onClick={closeMobileMenu}
									{...stylex.props(
										control,
										styles.navLink,
										styles.mobileLink,
										linkState(link.path),
									)}
								>
									{link.label}
								</Link>
							))}
						</div>
					</Collapsible.Panel>
				</Collapsible.Root>
			</nav>
			<main id="main-content" {...stylex.props(styles.main)}>
				<Outlet />
			</main>
			<footer {...stylex.props(styles.footer)}>
				<div {...stylex.props(styles.footerInner)}>
					<p {...stylex.props(styles.footerText)}>
						Created by{" "}
						<a
							href="https://github.com/sneakingJ"
							{...stylex.props(styles.footerLink)}
							target="_blank"
							rel="noopener noreferrer"
						>
							@sneakingJ
						</a>
						. Source code on{" "}
						<a
							href="https://github.com/obviyus/gotm-remix"
							{...stylex.props(styles.footerLink)}
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
						.
					</p>
					<p {...stylex.props(styles.footerText)}>
						<a
							href={DISCORD_INVITE_URL}
							{...stylex.props(styles.footerLink)}
							target="_blank"
							rel="noopener noreferrer"
						>
							Join the Discord
						</a>
						{" · "}
						<Link to="/jury" {...stylex.props(styles.footerLink)}>
							Jury
						</Link>
						{" · "}
						<Link to="/privacy" {...stylex.props(styles.footerLink)}>
							Privacy
						</Link>
					</p>
				</div>
			</footer>
		</div>
	);
}
