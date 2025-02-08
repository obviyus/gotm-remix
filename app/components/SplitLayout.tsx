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
		<div className="bg-white rounded-lg shadow p-4 space-y-4">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold">{title}</h2>
				{statusBadge && (
					<span
						className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
							statusBadge.isSuccess
								? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
								: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20"
						}`}
					>
						{statusBadge.text}
					</span>
				)}
			</div>
			<div className="min-h-[60px]">{action}</div>
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
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<div className="text-center space-y-2 mb-8">
				<h1 className="text-3xl font-bold">{title}</h1>
				{subtitle && <h2 className="text-xl">{subtitle}</h2>}
				{description && <p className="text-gray-600">{description}</p>}
			</div>

			<div className="grid md:grid-cols-2 gap-6">{children}</div>
		</div>
	);
}
