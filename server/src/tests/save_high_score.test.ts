import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable, highScoresTable } from '../db/schema';
import { saveHighScore } from '../handlers/save_high_score';
import { eq } from 'drizzle-orm';

describe('saveHighScore', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should save high score for a won game', async () => {
    // Create a won game first
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'beginner',
        rows: 9,
        columns: 9,
        mines: 10,
        status: 'won',
        duration_seconds: 45,
        cells_revealed: 71,
        flags_placed: 10,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    // Save high score
    const result = await saveHighScore({
      game_id: game.id,
      player_name: 'HighScorePlayer',
    });

    // Verify the returned high score
    expect(result.id).toBeDefined();
    expect(result.player_name).toEqual('HighScorePlayer');
    expect(result.difficulty).toEqual('beginner');
    expect(result.duration_seconds).toEqual(45);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save high score to database correctly', async () => {
    // Create a won game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'expert',
        rows: 16,
        columns: 30,
        mines: 99,
        status: 'won',
        duration_seconds: 120,
        cells_revealed: 381,
        flags_placed: 99,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    // Save high score
    const result = await saveHighScore({
      game_id: game.id,
      player_name: 'ExpertPlayer',
    });

    // Verify the high score was saved in the database
    const savedHighScores = await db.select()
      .from(highScoresTable)
      .where(eq(highScoresTable.id, result.id))
      .execute();

    expect(savedHighScores).toHaveLength(1);
    const savedHighScore = savedHighScores[0];
    expect(savedHighScore.player_name).toEqual('ExpertPlayer');
    expect(savedHighScore.difficulty).toEqual('expert');
    expect(savedHighScore.duration_seconds).toEqual(120);
    expect(savedHighScore.created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent game', async () => {
    await expect(saveHighScore({
      game_id: 999,
      player_name: 'TestPlayer',
    })).rejects.toThrow(/Game with ID 999 not found/i);
  });

  it('should throw error for game that is not won', async () => {
    // Create a lost game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'intermediate',
        rows: 16,
        columns: 16,
        mines: 40,
        status: 'lost',
        duration_seconds: 30,
        cells_revealed: 15,
        flags_placed: 5,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    await expect(saveHighScore({
      game_id: game.id,
      player_name: 'TestPlayer',
    })).rejects.toThrow(/Cannot save high score for game with status: lost/i);
  });

  it('should throw error for in-progress game', async () => {
    // Create an in-progress game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'beginner',
        rows: 9,
        columns: 9,
        mines: 10,
        status: 'in_progress',
        cells_revealed: 20,
        flags_placed: 3,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    await expect(saveHighScore({
      game_id: game.id,
      player_name: 'TestPlayer',
    })).rejects.toThrow(/Cannot save high score for game with status: in_progress/i);
  });

  it('should throw error for game without duration', async () => {
    // Create a won game without duration
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'beginner',
        rows: 9,
        columns: 9,
        mines: 10,
        status: 'won',
        duration_seconds: null,
        cells_revealed: 71,
        flags_placed: 10,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    await expect(saveHighScore({
      game_id: game.id,
      player_name: 'TestPlayer',
    })).rejects.toThrow(/Cannot save high score: game duration is not available/i);
  });

  it('should handle different difficulty levels correctly', async () => {
    // Create games with different difficulties
    const difficulties = ['beginner', 'intermediate', 'expert', 'custom'] as const;
    const durations = [25, 60, 180, 300];

    for (let i = 0; i < difficulties.length; i++) {
      const gameResult = await db.insert(gamesTable)
        .values({
          player_name: `Player${i}`,
          difficulty: difficulties[i],
          rows: 9 + i * 3,
          columns: 9 + i * 3,
          mines: 10 + i * 20,
          status: 'won',
          duration_seconds: durations[i],
          cells_revealed: 50 + i * 100,
          flags_placed: 10 + i * 20,
        })
        .returning()
        .execute();

      const game = gameResult[0];

      const result = await saveHighScore({
        game_id: game.id,
        player_name: `HighScore${i}`,
      });

      expect(result.difficulty).toEqual(difficulties[i]);
      expect(result.duration_seconds).toEqual(durations[i]);
      expect(result.player_name).toEqual(`HighScore${i}`);
    }

    // Verify all high scores were saved
    const allHighScores = await db.select()
      .from(highScoresTable)
      .execute();

    expect(allHighScores).toHaveLength(4);
  });
});