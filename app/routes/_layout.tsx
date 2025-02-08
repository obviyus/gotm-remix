import { Link, Outlet, useLocation, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { json, type LoaderFunction } from "@remix-run/node";
import { pool, getCurrentMonth } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { RowDataPacket } from "mysql2";

interface LoaderData {
	monthStatus: string;
	isJuryMember: boolean;
}

export const loader: LoaderFunction = async ({ request }) => {
	// Get latest month's status using getCurrentMonth utility
	const currentMonth = await getCurrentMonth();

	// Check if user is a jury member
	const session = await getSession(request.headers.get("Cookie"));
	const discordId = session.get("discordId");

	let isJuryMember = false;
	if (discordId) {
		const [juryRows] = await pool.execute<RowDataPacket[]>(
			"SELECT id FROM jury_members WHERE discord_id = ? AND active = 1",
			[discordId],
		);
		isJuryMember = juryRows.length > 0;
	}

	return json<LoaderData>({
		monthStatus: currentMonth?.status || "ready",
		isJuryMember,
	});
};

export default function Layout() {
	const location = useLocation();
	const { monthStatus, isJuryMember } = useLoaderData<LoaderData>();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const getLinkClassName = (path: string, isMobile = false) => {
		const isActive = location.pathname === path;
		return `${
			isMobile ? "block w-full" : "w-[6.5rem] md:w-[7rem] lg:w-[8rem] min-w-max"
		} items-center justify-center gap-2 px-2 sm:px-3 md:px-4 py-2 text-[0.8rem] md:text-sm font-medium rounded-lg transition-all duration-300 group/btn relative overflow-hidden whitespace-nowrap ${
			isActive
				? "text-white shadow-sm shadow-blue-600/50 border border-blue-500/50 bg-blue-600/20 border-blue-500/60 shadow-blue-600/60 after:absolute after:inset-0 after:bg-blue-500/20"
				: "text-white shadow-sm shadow-zinc-500/30 border border-zinc-400/30 hover:bg-zinc-500/20 hover:border-zinc-300/50 hover:shadow-zinc-400/60 after:absolute after:inset-0 after:bg-zinc-400/0 hover:after:bg-zinc-300/20 after:transition-colors"
		} flex`;
	};

	const getCenterItem = () => {
		switch (monthStatus) {
			case "nominating":
				return { path: "/nominate", label: "Nominate" };
			case "voting":
				return { path: "/voting", label: "Vote" };
			case "jury":
				return { path: "/", label: "Jury at Work" };
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
		{ path: "/jury", label: "Jury Members" },
		{ path: "/privacy", label: "Privacy" },
		// Only show admin link for jury members
		...(isJuryMember ? [{ path: "/admin", label: "Admin" }] : []),
	];

	const activeTab =
		navLinks.find((link) => link.path === location.pathname)?.label || "GOTM";

	return (
		<div className="min-h-screen flex flex-col bg-zinc-900">
			<nav className="border-b border-zinc-800 bg-zinc-900">
				<div className="w-full px-2 sm:px-4 lg:px-8">
					<div className="flex h-16 justify-between md:justify-center">
						{/* Mobile menu button and active page title */}
						<div className="flex items-center gap-4 md:hidden">
							<button
								type="button"
								className="text-zinc-400 hover:text-zinc-100 focus:outline-none"
								onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
							>
								<span className="sr-only">Open main menu</span>
								{!isMobileMenuOpen ? (
									<Bars3Icon className="h-6 w-6" aria-hidden="true" />
								) : (
									<XMarkIcon className="h-6 w-6" aria-hidden="true" />
								)}
							</button>
							<span className="text-lg font-bold text-zinc-100">
								{activeTab}
							</span>
						</div>

						{/* Desktop navigation */}
						<div className="hidden md:flex md:items-center md:justify-center w-full max-w-full mx-auto overflow-x-auto">
							<div className="flex items-center justify-center flex-nowrap space-x-2 sm:space-x-3 md:space-x-4 lg:space-x-8 px-2">
								<div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
									{navLinks
										.filter(
											(link) => link.path === "/" || link.path === "/history",
										)
										.map((link) => (
											<Link
												key={link.path}
												to={link.path}
												prefetch="viewport"
												className={getLinkClassName(link.path)}
											>
												<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-xs sm:text-sm">
													{link.label}
												</span>
											</Link>
										))}
								</div>

								{centerItem && (
									<div className="flex items-center border-x border-zinc-800 mx-2 sm:mx-3 md:mx-4">
										<Link
											to={centerItem.path}
											className={`${getLinkClassName(centerItem.path)} mx-2 sm:mx-3 md:mx-4`}
										>
											<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-[0.8rem] md:text-sm">
												{centerItem.label}
											</span>
										</Link>
									</div>
								)}

								<div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
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
												className={getLinkClassName(link.path)}
											>
												<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 transition-transform group-hover/btn:scale-105 text-xs sm:text-sm">
													{link.label}
												</span>
											</Link>
										))}
								</div>
							</div>
						</div>

						{/* Placeholder div to maintain centering on desktop */}
						<div className="w-10 md:hidden" />
					</div>
				</div>

				{/* Mobile menu, show/hide based on menu state */}
				<div
					className={`md:hidden fixed top-16 left-0 right-0 bg-zinc-900 border-b border-zinc-800 shadow-lg z-50 transition-all duration-200 ease-in-out ${
						isMobileMenuOpen
							? "opacity-100 translate-y-0"
							: "opacity-0 -translate-y-2"
					}`}
					style={{
						pointerEvents: isMobileMenuOpen ? "auto" : "none",
					}}
				>
					<div className="space-y-1 px-2 pb-3 pt-2">
						{navLinks.map((link) => (
							<Link
								key={link.path}
								to={link.path}
								className={getLinkClassName(link.path, true)}
								onClick={() => setIsMobileMenuOpen(false)}
							>
								{link.label}
							</Link>
						))}
					</div>
				</div>
			</nav>
			<main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 flex-1">
				<Outlet />
			</main>
			<footer className="py-4 border-t border-zinc-800">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
					<p className="text-center text-sm text-zinc-400">
						Created by{" "}
						<a
							href="https://github.com/sneakingJ"
							className="text-blue-400 hover:text-blue-300 hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							@sneakingJ
						</a>
						. Source code on{" "}
						<a
							href="https://github.com/obviyus/gotm-remix"
							className="text-blue-400 hover:text-blue-300 hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</p>
				</div>
			</footer>
		</div>
	);
}
