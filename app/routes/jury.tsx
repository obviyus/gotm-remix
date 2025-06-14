import { db } from "~/server/database.server";
import type { Route } from "./+types/jury";

export async function loader() {
	const result = await db.execute(
		`SELECT name
         FROM jury_members
         WHERE active = 1
         ORDER BY name;`,
	);

	return { juryMembers: result.rows.map((row) => row.name as string) };
}

export default function Jury({ loaderData }: Route.ComponentProps) {
	const { juryMembers } = loaderData;

	return (
		<div className="mx-auto h-full px-4 py-6 sm:px-6 lg:px-8">
			<article className="mx-auto h-full">
				<header className="mb-6">
					<h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
						Jury Members
					</h1>
				</header>

				<ul className="list-disc ml-6 mt-2">
					{juryMembers.map((member) => (
						<li key={member}>{member}</li>
					))}
				</ul>
			</article>
		</div>
	);
}
