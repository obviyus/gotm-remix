import { useState } from "react";
import {
	Form,
	useLoaderData,
	useSubmit,
	useActionData,
} from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { searchGames } from "~/utils/igdb.server";
import GameCard from "~/components/GameCard";

interface Game {
	id: number;
	name: string;
	cover?: {
		url: string;
	};
	first_release_date?: number;
	summary?: string;
}

interface LoaderData {
	games: Game[];
}

export const loader: LoaderFunction = async () => {
	return json<LoaderData>({ games: [] });
};

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const query = formData.get("query");

	if (typeof query !== "string") {
		return json({ games: [] });
	}

	const games = await searchGames(query);
	return json({ games });
}

export default function Nominate() {
	const { games: initialGames } = useLoaderData<LoaderData>();
	const actionData = useActionData<typeof action>();
	const games = actionData?.games || initialGames;
	const submit = useSubmit();
	const [searchTerm, setSearchTerm] = useState("");

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		submit(e.currentTarget);
	};

	const handleNominate = async (game: Game) => {
		// TODO: Implement nomination logic
		console.log("Nominating game:", game);
	};

	return (
		<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
			<h1 className="text-3xl font-bold mb-8">Nominate Games</h1>

			<Form method="post" onSubmit={handleSearch} className="mb-8">
				<div className="flex gap-4">
					<input
						type="search"
						name="query"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search for games..."
						className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
					<button
						type="submit"
						className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						Search
					</button>
				</div>
			</Form>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{games.map((game: Game) => (
					<GameCard
						key={game.id}
						game={game}
						onNominate={() => handleNominate(game)}
					/>
				))}
			</div>

			{games.length === 0 && searchTerm && (
				<p className="text-center text-gray-500 mt-8">
					No games found for &quot;{searchTerm}&quot;
				</p>
			)}
		</div>
	);
}
