import { db } from '../db';
import { highScoresTable } from '../db/schema';
import { type GetLeaderboardInput, type HighScore } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getLeaderboard(input: GetLeaderboardInput): Promise<HighScore[]> {
  try {
    // Build query conditionally without reassigning to maintain type inference
    const results = input.difficulty
      ? await db.select()
          .from(highScoresTable)
          .where(eq(highScoresTable.difficulty, input.difficulty))
          .orderBy(asc(highScoresTable.duration_seconds))
          .limit(input.limit)
          .execute()
      : await db.select()
          .from(highScoresTable)
          .orderBy(asc(highScoresTable.duration_seconds))
          .limit(input.limit)
          .execute();

    // Return the high scores (no numeric conversions needed - all fields are integers/text)
    return results;
  } catch (error) {
    console.error('Get leaderboard failed:', error);
    throw error;
  }
}