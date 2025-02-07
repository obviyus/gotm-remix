import { json, type ActionFunctionArgs } from "@remix-run/node";
import { pool } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { ResultSetHeader } from "mysql2";

export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const discordId = session.get("discordId");

    if (!discordId) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("Content-Type");
    let data;

    try {
        if (contentType?.includes("application/json")) {
            data = await request.json();
        } else {
            const formData = await request.formData();
            data = {
                game: JSON.parse(formData.get('game')?.toString() || "{}"),
                monthId: formData.get('monthId'),
                short: formData.get('short') === 'true',
                pitch: formData.get('pitch')?.toString()
            };
        }

        const { game, monthId, short, pitch } = data;

        if (!game || !monthId) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if game is already nominated for this month
        const [existing] = await pool.execute(
            "SELECT id FROM nominations WHERE month_id = ? AND game_id = ?",
            [monthId, game.id]
        );

        if (Array.isArray(existing) && existing.length > 0) {
            return json(
                { error: "Game already nominated for this month" },
                { status: 400 }
            );
        }

        // Start a transaction since we need to insert into multiple tables
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert the nomination
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO nominations (
                    month_id, game_id, discord_id, short,
                    game_name, game_year, game_cover, jury_selected
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    monthId,
                    game.id,
                    discordId,
                    short,
                    game.name,
                    game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear().toString() : null,
                    game.cover?.url.replace("t_thumb", "t_cover_big") || null,
                    0 // Not jury selected by default
                ]
            );

            // If there's a pitch, insert it
            if (pitch) {
                await connection.execute(
                    `INSERT INTO pitches (nomination_id, discord_id, pitch) 
                     VALUES (?, ?, ?)`,
                    [result.insertId, discordId, pitch]
                );
            }

            await connection.commit();
            connection.release();

            return json({ success: true, nominationId: result.insertId });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error processing nomination:', error);
        return json(
            { error: 'Failed to process nomination. Please make sure all required fields are provided.' },
            { status: 500 }
        );
    }
}