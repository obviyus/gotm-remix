import type { ReactNode } from "react";

interface SplitLayoutProps {
	title: string;
	subtitle?: string;
	description?: string;
	children: ReactNode;
}

interface ColumnProps {
	title: string;
	statusBadge?: {
		text: string;
		isSuccess?: boolean;
	};
	action?: ReactNode;
	children: ReactNode;
}

export function Column({ title, statusBadge, action, children }: ColumnProps) {
	return (
		<div className="bg-zinc-900 rounded-lg shadow p-4 space-y-4 ring-1 ring-zinc-800">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold text-zinc-100">{title}</h2>
				{statusBadge && (
					<span
						className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-sm font-medium ${
							statusBadge.isSuccess
								? "bg-green-950 text-green-400 ring-1 ring-inset ring-green-800"
								: "bg-zinc-800 text-zinc-400 ring-1 ring-inset ring-zinc-700"
						}`}
					>
						{statusBadge.text}
					</span>
				)}
			</div>
			<div className="py-2">{action}</div>
			{children}
		</div>
	);
}

export default function SplitLayout({
	title,
	subtitle,
	description,
	children,
}: SplitLayoutProps) {
	return (
		<div className="mx-auto">
			<div className="text-center space-y-2 mb-8">
				<h1 className="text-3xl font-bold text-zinc-100">{title}</h1>
				{subtitle && <h2 className="text-xl text-zinc-200">{subtitle}</h2>}
				{description && <p className="text-zinc-400">{description}</p>}
			</div>

			<div className="grid md:grid-cols-2 gap-6">{children}</div>
		</div>
	);
}
