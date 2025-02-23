import { json, type ActionFunctionArgs } from "@remix-run/node";
import { pool } from "~/utils/database.server";
import { getSession } from "~/sessions";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { NominationFormData } from "~/types";

export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const discordId = session.get("discordId");

    if (!discordId) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for previous GOTM winners
    const [winners] = await pool.execute<RowDataPacket[]>(
        'SELECT DISTINCT game_id FROM winners'
    );
    const previousWinners = winners.map(w => w.game_id);

    if (request.method === "DELETE") {
        const formData = await request.formData();
        const nominationId = formData.get("nominationId");

        if (!nominationId) {
            return json({ error: "Missing nomination ID" }, { status: 400 });
        }

        // Verify the nomination belongs to the user
        const [nomination] = await pool.execute(
            "SELECT id FROM nominations WHERE id = ? AND discord_id = ?",
            [nominationId, discordId]
        );

        if (!Array.isArray(nomination) || nomination.length === 0) {
            return json({ error: "Nomination not found or unauthorized" }, { status: 404 });
        }

        // Delete the nomination (pitches will be cascade deleted)
        await pool.execute(
            "DELETE FROM nominations WHERE id = ?",
            [nominationId]
        );

        return json({ success: true });
    }

    if (request.method === "PATCH") {
        try {
            const contentType = request.headers.get("Content-Type");
            const data = contentType?.includes("application/json")
                ? await request.json()
                : Object.fromEntries(await request.formData());

            const nominationId = typeof data.nominationId === 'string' 
                ? Number.parseInt(data.nominationId, 10)
                : typeof data.nominationId === 'number'
                    ? data.nominationId
                    : null;

            if (!nominationId || Number.isNaN(nominationId)) {
                return json({ error: "Invalid nomination ID" }, { status: 400 });
            }

            const pitch = data.pitch?.toString() || null;

            // Check if the game is a previous winner
            const [nomination] = await pool.execute<RowDataPacket[]>(
                "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.id = ?",
                [nominationId]
            );

            if (!Array.isArray(nomination) || nomination.length === 0) {
                return json({ error: "Nomination not found" }, { status: 404 });
            }

            // Check if the game is a previous winner
            if (previousWinners.includes(nomination[0].game_id.toString())) {
                return json({ error: "Cannot modify nominations for previous GOTM winners" }, { status: 400 });
            }

            // Check if the user owns the nomination or is adding a new pitch
            const isOwner = nomination[0].discord_id === discordId;
            const hasExistingPitch = nomination[0].pitch_discord_id === discordId;

            if (!isOwner && hasExistingPitch) {
                return json({ error: "You have already added a pitch to this nomination" }, { status: 400 });
            }

            // Start a transaction for updating the pitch
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                if (hasExistingPitch) {
                    // Update existing pitch
                    await connection.execute(
                        "UPDATE pitches SET pitch = ?, updated_at = NOW() WHERE nomination_id = ? AND discord_id = ?",
                        [pitch, nominationId, discordId]
                    );
                } else {
                    // Add new pitch
                    await connection.execute(
                        "INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
                        [nominationId, discordId, pitch]
                    );
                }

                await connection.commit();
                connection.release();
                return json({ success: true });
            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }
        } catch (error) {
            console.error('Error processing edit:', error);
            return json(
                { error: 'Failed to process edit. Please try again.' },
                { status: 500 }
            );
        }
    }

    try {
        let data: NominationFormData;
        const contentType = request.headers.get("Content-Type");
        
        if (contentType?.includes("application/json")) {
            const body = await request.json();
            // Handle both direct JSON and stringified JSON in the 'json' field
            data = typeof body === 'string' ? JSON.parse(body) : 
                   body.json ? JSON.parse(body.json) : body;
        } else {
            const formData = await request.formData();
            const jsonStr = formData.get('json')?.toString();
            data = jsonStr ? JSON.parse(jsonStr) : {
                game: JSON.parse(formData.get('game')?.toString() || "{}"),
                monthId: formData.get('monthId')?.toString() || "",
                short: formData.get('short') === 'true',
                pitch: formData.get('pitch')?.toString() || null
            };
        }

        const { game, monthId, short, pitch } = data;

        if (!game || !monthId) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if the game is a previous winner
        if (previousWinners.includes(game.id.toString())) {
            return json({ error: "This game has already won GOTM in a previous month" }, { status: 400 });
        }

        // Check if game is already nominated for this month
        const [existing] = await pool.execute<RowDataPacket[]>(
            "SELECT n.*, p.discord_id as pitch_discord_id FROM nominations n LEFT JOIN pitches p ON n.id = p.nomination_id WHERE n.month_id = ? AND n.game_id = ? AND p.discord_id = ?",
            [monthId, game.id, discordId]
        );

        // If the user has already pitched this game, prevent them from nominating it again
        if (Array.isArray(existing) && existing.length > 0) {
            return json(
                { error: "You have already nominated or pitched this game for this month" },
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
                    game_name, game_year, game_cover, game_url, jury_selected
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    monthId,
                    game.id,
                    discordId,
                    short,
                    game.name,
                    game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear().toString() : null,
                    game.cover?.url.replace("t_thumb", "t_cover_big") || null,
                    game.url || null,
                    0 // Not jury selected by default
                ]
            );

            // If there's a pitch, insert it
            if (pitch) {
                await connection.execute(
                    `INSERT INTO pitches (nomination_id, discord_id, pitch, created_at, updated_at)
                     VALUES (?, ?, ?, NOW(), NOW())`,
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