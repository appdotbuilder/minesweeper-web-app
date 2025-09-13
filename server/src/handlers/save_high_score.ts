import { db } from '../db';
import { gamesTable, highScoresTable } from '../db/schema';
import { type HighScore } from '../schema';
import { eq } from 'drizzle-orm';

interface SaveHighScoreInput {
    game_id: number;
    player_name: string;
}

export async function saveHighScore(input: SaveHighScoreInput): Promise<HighScore> {
    try {
        // 1. Fetch the completed game by ID to get duration and difficulty
        const games = await db.select()
            .from(gamesTable)
            .where(eq(gamesTable.id, input.game_id))
            .execute();

        if (games.length === 0) {
            throw new Error(`Game with ID ${input.game_id} not found`);
        }

        const game = games[0];

        // 2. Validate that the game is actually won (not lost or in progress)
        if (game.status !== 'won') {
            throw new Error(`Cannot save high score for game with status: ${game.status}. Only won games can be saved as high scores.`);
        }

        // Validate that the game has a duration
        if (game.duration_seconds === null || game.duration_seconds === undefined) {
            throw new Error('Cannot save high score: game duration is not available');
        }

        // 3. Create a new high score record in the database
        const result = await db.insert(highScoresTable)
            .values({
                player_name: input.player_name,
                difficulty: game.difficulty,
                duration_seconds: game.duration_seconds,
            })
            .returning()
            .execute();

        // 4. Return the created high score record
        const highScore = result[0];
        return {
            id: highScore.id,
            player_name: highScore.player_name,
            difficulty: highScore.difficulty,
            duration_seconds: highScore.duration_seconds,
            created_at: highScore.created_at,
        };
    } catch (error) {
        console.error('High score save failed:', error);
        throw error;
    }
}