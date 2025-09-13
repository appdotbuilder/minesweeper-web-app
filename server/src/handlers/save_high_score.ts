import { type HighScore } from '../schema';

interface SaveHighScoreInput {
    game_id: number;
    player_name: string;
}

export async function saveHighScore(input: SaveHighScoreInput): Promise<HighScore> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is:
    // 1. Fetch the completed game by ID to get duration and difficulty
    // 2. Validate that the game is actually won (not lost or in progress)
    // 3. Create a new high score record in the database
    // 4. Return the created high score record
    // 5. This is typically called when a player wins a game and wants to save their score
    
    // Placeholder response structure
    return {
        id: 1, // Placeholder ID
        player_name: input.player_name,
        difficulty: 'beginner' as const,
        duration_seconds: 45, // Would be fetched from the completed game
        created_at: new Date(),
    };
}