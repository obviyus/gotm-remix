import { useLoaderData } from "@remix-run/react";
import { pool } from "~/server/database.server";
import type { RowDataPacket } from "mysql2";

export const loader = async () => {
    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT name
         FROM jury_members
         WHERE active = 1
         ORDER BY name;`,
    );

    return { juryMembers: rows.map((row) => row.name) };
};

export default function Jury() {
    const { juryMembers } = useLoaderData<{ juryMembers: string[] }>();

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
