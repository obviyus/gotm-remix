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
			isMobile
				? "block w-full px-4 py-2 text-base font-bold rounded-lg"
				: "inline-flex items-center px-4 py-2 text-lg font-medium rounded-lg"
		} transition-all ${
			isActive
				? "bg-blue-600 text-zinc-100"
				: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
		}`;
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
				<div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
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
						<div className="hidden md:flex md:items-center md:space-x-8">
							{navLinks.map((link) => (
								<Link
									key={link.path}
									to={link.path}
									className={getLinkClassName(link.path)}
								>
									{link.label}
								</Link>
							))}
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
