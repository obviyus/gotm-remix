import * as stylex from "@stylexjs/stylex";
import React from "react";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { color, media } from "~/styles/tokens.stylex";

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

const styles = stylex.create({
	card: {
		backgroundColor: color.canvas,
		borderColor: color.surface,
	},
	header: {
		alignItems: "center",
		display: "flex",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingBottom: 8,
	},
	title: {
		color: color.heading,
		fontSize: "1.5rem",
		fontWeight: 700,
		lineHeight: 1.3333,
	},
	divider: {
		backgroundColor: color.surface,
	},
	content: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
		paddingTop: 24,
	},
	successBadge: {
		backgroundColor: "oklch(26.6% 0.065 152.934)",
		borderColor: "oklch(44.8% 0.119 151.328)",
		color: "oklch(79.2% 0.209 151.711)",
	},
	idleBadge: {
		backgroundColor: color.surface,
		borderColor: color.surfaceRaised,
		color: color.muted,
	},
	page: {
		marginInline: "auto",
	},
	intro: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginBottom: 32,
		textAlign: "center",
	},
	heading: {
		fontSize: "1.875rem",
		fontWeight: 700,
		lineHeight: 1.2,
	},
	subtitle: {
		color: "oklch(55.6% 0 0)",
		fontSize: "1.25rem",
		lineHeight: 1.4,
	},
	description: {
		color: "oklch(55.6% 0 0)",
	},
	columns: {
		display: "grid",
		gap: 24,
		gridTemplateColumns: { default: null, [media.md]: "repeat(2, minmax(0, 1fr))" },
	},
});

export function Column({ title, statusBadge, action, children }: ColumnProps) {
	return (
		<Card style={styles.card}>
			<CardHeader style={styles.header}>
				<CardTitle style={styles.title}>{title}</CardTitle>
				{statusBadge && (
					<Badge
						variant="secondary"
						style={statusBadge.isSuccess ? styles.successBadge : styles.idleBadge}
					>
						{statusBadge.text}
					</Badge>
				)}
			</CardHeader>
			<Separator style={styles.divider} />
			<CardContent style={styles.content}>
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
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.intro)}>
				<h2 {...stylex.props(styles.heading)}>{title}</h2>
				{subtitle && <p {...stylex.props(styles.subtitle)}>{subtitle}</p>}
				{description && <p {...stylex.props(styles.description)}>{description}</p>}
			</div>

			<div {...stylex.props(styles.columns)}>{children}</div>
		</div>
	);
}
