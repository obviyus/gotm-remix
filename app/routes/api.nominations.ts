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

    const formData = await request.formData();
    const gameStr = formData.get('game');
    const monthId = formData.get('monthId');
    const short = formData.get('short') === 'true';

    if (!gameStr || !monthId) {
        return json({ error: "Missing required fields" }, { status: 400 });
    }

    const game = JSON.parse(gameStr.toString());

    try {
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

        // Insert the nomination
        const [result] = await pool.execute<ResultSetHeader>(
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
                0 // not jury selected by default
            ]
        );

        return json({ success: true, nominationId: result.insertId });

    } catch (error) {
        console.error('Error creating nomination:', error);
        return json(
            { error: 'Failed to create nomination' },
            { status: 500 }
        );
    }
}