import { Link, Outlet, useLocation } from "@remix-run/react";

export default function Layout() {
	const location = useLocation();

	const getLinkClassName = (path: string) => {
		const isActive = location.pathname === path;
		return `inline-flex items-center px-4 py-2 text-lg font-medium rounded-lg transition-all ${
			isActive
				? "bg-gray-900 text-white"
				: "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
		}`;
	};

	return (
		<div className="min-h-full">
			<nav className="border-b border-gray-200 bg-white">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 justify-center">
						<div className="flex items-center space-x-8">
							<Link to="/" className={getLinkClassName("/")}>
								GOTM
							</Link>
							<Link to="/nominate" className={getLinkClassName("/nominate")}>
								Nominate
							</Link>
							<Link to="/history" className={getLinkClassName("/history")}>
								History
							</Link>
							<Link to="/jury" className={getLinkClassName("/jury")}>
								Jury
							</Link>
							<Link to="/privacy" className={getLinkClassName("/privacy")}>
								Privacy
							</Link>
						</div>
					</div>
				</div>
			</nav>
			<main className="mx-auto max-w-5xl">
				<Outlet />
			</main>
		</div>
	);
}
