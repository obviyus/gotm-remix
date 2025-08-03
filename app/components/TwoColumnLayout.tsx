import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

interface TwoColumnLayoutProps {
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
		<Card className="bg-zinc-900 border-zinc-800">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-2xl font-bold text-zinc-100">
					{title}
				</CardTitle>
				{statusBadge && (
					<Badge
						variant="secondary"
						className={
							statusBadge.isSuccess
								? "bg-green-950 text-green-400 border-green-800"
								: "bg-zinc-800 text-zinc-400 border-zinc-700"
						}
					>
						{statusBadge.text}
					</Badge>
				)}
			</CardHeader>
			<Separator className="bg-zinc-800" />
			<CardContent className="pt-6 space-y-4">
				{action}
				{children}
			</CardContent>
		</Card>
	);
}

export default function TwoColumnLayout({
	title,
	subtitle,
	description,
	children,
}: TwoColumnLayoutProps) {
	return (
		<div className="mx-auto">
			<div className="text-center space-y-2 mb-8">
				<h1 className="text-3xl font-bold">{title}</h1>
				{subtitle && (
					<h2 className="text-xl text-muted-foreground">{subtitle}</h2>
				)}
				{description && <p className="text-muted-foreground">{description}</p>}
			</div>

			<div className="grid md:grid-cols-2 gap-6">{children}</div>
		</div>
	);
}
