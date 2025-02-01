interface GameCardProps {
	title: string;
	draggableProps: any;
	dragHandleProps: any;
	innerRef: any;
}

export default function GameCard({
	title,
	draggableProps,
	dragHandleProps,
	innerRef,
}: GameCardProps) {
	return (
		<div
			ref={innerRef}
			{...draggableProps}
			{...dragHandleProps}
			className="bg-white border font-black border-gray-200 rounded-lg p-4 mb-4 shadow-sm hover:shadow"
		>
			<h3 className="font-medium">{title}</h3>
			{/* Add other game information */}
		</div>
	);
}
