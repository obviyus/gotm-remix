import { Link, Outlet, useLocation } from "@remix-run/react";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Layout() {
	const location = useLocation();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const getLinkClassName = (path: string, isMobile = false) => {
		const isActive = location.pathname === path;
		return `${
			isMobile
				? "block w-full px-4 py-2 text-base font-bold rounded-lg"
				: "inline-flex items-center px-4 py-2 text-lg font-medium rounded-lg"
		} transition-all ${
			isActive
				? "bg-gray-900 text-white"
				: "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
		}`;
	};

	const navLinks = [
		{ path: "/", label: "GOTM" },
		{ path: "/nominate", label: "Nominate" },
		{ path: "/history", label: "History" },
		{ path: "/jury", label: "Jury" },
		{ path: "/privacy", label: "Privacy" },
	];

	const activeTab =
		navLinks.find((link) => link.path === location.pathname)?.label || "GOTM";

	return (
		<div className="min-h-full">
			<nav className="border-b border-gray-200 bg-white">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-between md:justify-center">
						{/* Mobile menu button and active page title */}
						<div className="flex items-center gap-4 md:hidden">
							<button
								type="button"
								className="text-gray-500 hover:text-gray-900 focus:outline-none"
								onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
							>
								<span className="sr-only">Open main menu</span>
								{!isMobileMenuOpen ? (
									<Bars3Icon className="h-6 w-6" aria-hidden="true" />
								) : (
									<XMarkIcon className="h-6 w-6" aria-hidden="true" />
								)}
							</button>
							<span className="text-lg font-bold text-gray-900">
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
					className={`md:hidden fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 transition-all duration-200 ease-in-out ${
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
			<main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
				<Outlet />
			</main>
		</div>
	);
}
