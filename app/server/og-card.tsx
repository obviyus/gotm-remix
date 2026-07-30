interface OgCardProps {
	eyebrow: string;
	title: string;
	subtitle?: string;
	/** Data URIs; remote URLs will not render. */
	covers?: string[];
	footnote?: string;
}

// Satori supports flexbox only, so every container declares display: flex.
export function OgCard({ eyebrow, title, subtitle, covers = [], footnote }: OgCardProps) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "64px",
				backgroundColor: "#18181b",
				color: "#fafafa",
				fontFamily: "Inter",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<div
					style={{
						display: "flex",
						fontSize: 24,
						fontWeight: 700,
						letterSpacing: "0.18em",
						textTransform: "uppercase",
						color: "#60a5fa",
					}}
				>
					{eyebrow}
				</div>
				<div
					style={{
						display: "flex",
						marginTop: 28,
						fontSize: 76,
						fontWeight: 700,
						lineHeight: 1.05,
						color: "#fafafa",
					}}
				>
					{title}
				</div>
				{subtitle ? (
					<div style={{ display: "flex", marginTop: 20, fontSize: 36, color: "#d4d4d8" }}>
						{subtitle}
					</div>
				) : null}
			</div>

			<div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
				<div style={{ display: "flex", flexDirection: "column" }}>
					{footnote ? (
						<div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>{footnote}</div>
					) : null}
					<div style={{ display: "flex", marginTop: 12, fontSize: 26, color: "#71717a" }}>
						pg-gotm.com
					</div>
				</div>

				{covers.length ? (
					<div style={{ display: "flex", gap: 20 }}>
						{covers.map((cover) => (
							<img
								key={cover.slice(-32)}
								src={cover}
								width={168}
								height={224}
								style={{ borderRadius: 12, objectFit: "cover" }}
							/>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
