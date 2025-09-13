import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { highScoresTable } from '../db/schema';
import { type GetLeaderboardInput } from '../schema';
import { getLeaderboard } from '../handlers/get_leaderboard';

// Test input for getting all high scores
const testInputAll: GetLeaderboardInput = {
  limit: 10
};

// Test input for beginner difficulty
const testInputBeginner: GetLeaderboardInput = {
  difficulty: 'beginner',
  limit: 5
};

// Test input for intermediate difficulty
const testInputIntermediate: GetLeaderboardInput = {
  difficulty: 'intermediate',
  limit: 10
};

describe('getLeaderboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no high scores exist', async () => {
    const result = await getLeaderboard(testInputAll);

    expect(result).toEqual([]);
  });

  it('should return high scores sorted by duration (fastest first)', async () => {
    // Create test high scores with different durations
    await db.insert(highScoresTable).values([
      {
        player_name: 'Alice',
        difficulty: 'beginner',
        duration_seconds: 120,
      },
      {
        player_name: 'Bob',
        difficulty: 'beginner',
        duration_seconds: 60,
      },
      {
        player_name: 'Charlie',
        difficulty: 'beginner',
        duration_seconds: 90,
      }
    ]).execute();

    const result = await getLeaderboard(testInputAll);

    // Should be sorted by duration (ascending)
    expect(result).toHaveLength(3);
    expect(result[0].player_name).toEqual('Bob');
    expect(result[0].duration_seconds).toEqual(60);
    expect(result[1].player_name).toEqual('Charlie');
    expect(result[1].duration_seconds).toEqual(90);
    expect(result[2].player_name).toEqual('Alice');
    expect(result[2].duration_seconds).toEqual(120);

    // Verify all fields are properly populated
    result.forEach(score => {
      expect(score.id).toBeDefined();
      expect(score.player_name).toBeDefined();
      expect(score.difficulty).toBeDefined();
      expect(score.duration_seconds).toBeGreaterThan(0);
      expect(score.created_at).toBeInstanceOf(Date);
    });
  });

  it('should filter by difficulty when specified', async () => {
    // Create high scores with different difficulties
    await db.insert(highScoresTable).values([
      {
        player_name: 'Alice',
        difficulty: 'beginner',
        duration_seconds: 60,
      },
      {
        player_name: 'Bob',
        difficulty: 'intermediate',
        duration_seconds: 120,
      },
      {
        player_name: 'Charlie',
        difficulty: 'expert',
        duration_seconds: 180,
      },
      {
        player_name: 'Dave',
        difficulty: 'beginner',
        duration_seconds: 90,
      }
    ]).execute();

    // Test filtering for beginner difficulty
    const beginnerResult = await getLeaderboard(testInputBeginner);
    expect(beginnerResult).toHaveLength(2);
    expect(beginnerResult.every(score => score.difficulty === 'beginner')).toBe(true);
    expect(beginnerResult[0].player_name).toEqual('Alice'); // Fastest beginner
    expect(beginnerResult[1].player_name).toEqual('Dave');

    // Test filtering for intermediate difficulty
    const intermediateResult = await getLeaderboard(testInputIntermediate);
    expect(intermediateResult).toHaveLength(1);
    expect(intermediateResult[0].difficulty).toEqual('intermediate');
    expect(intermediateResult[0].player_name).toEqual('Bob');
  });

  it('should respect the limit parameter', async () => {
    // Create more high scores than the limit
    const scores = [];
    for (let i = 1; i <= 15; i++) {
      scores.push({
        player_name: `Player${i}`,
        difficulty: 'beginner' as const,
        duration_seconds: i * 30,
      });
    }
    await db.insert(highScoresTable).values(scores).execute();

    // Test with limit of 5
    const limitedResult = await getLeaderboard({
      difficulty: 'beginner',
      limit: 5
    });

    expect(limitedResult).toHaveLength(5);
    // Should get the 5 fastest times
    expect(limitedResult[0].duration_seconds).toEqual(30);
    expect(limitedResult[4].duration_seconds).toEqual(150);
  });

  it('should return all difficulties when no filter is specified', async () => {
    // Create high scores with different difficulties
    await db.insert(highScoresTable).values([
      {
        player_name: 'Alice',
        difficulty: 'beginner',
        duration_seconds: 90,
      },
      {
        player_name: 'Bob',
        difficulty: 'intermediate',
        duration_seconds: 60,
      },
      {
        player_name: 'Charlie',
        difficulty: 'expert',
        duration_seconds: 120,
      }
    ]).execute();

    const result = await getLeaderboard(testInputAll);

    expect(result).toHaveLength(3);
    // Should be sorted by duration regardless of difficulty
    expect(result[0].player_name).toEqual('Bob'); // 60 seconds
    expect(result[0].difficulty).toEqual('intermediate');
    expect(result[1].player_name).toEqual('Alice'); // 90 seconds
    expect(result[1].difficulty).toEqual('beginner');
    expect(result[2].player_name).toEqual('Charlie'); // 120 seconds
    expect(result[2].difficulty).toEqual('expert');
  });

  it('should handle custom difficulty correctly', async () => {
    // Create high scores with custom difficulty
    await db.insert(highScoresTable).values([
      {
        player_name: 'CustomPlayer1',
        difficulty: 'custom',
        duration_seconds: 180,
      },
      {
        player_name: 'CustomPlayer2',
        difficulty: 'custom',
        duration_seconds: 150,
      }
    ]).execute();

    const result = await getLeaderboard({
      difficulty: 'custom',
      limit: 10
    });

    expect(result).toHaveLength(2);
    expect(result.every(score => score.difficulty === 'custom')).toBe(true);
    expect(result[0].player_name).toEqual('CustomPlayer2'); // Faster time
    expect(result[1].player_name).toEqual('CustomPlayer1');
  });

  it('should use default limit when not specified', async () => {
    // Create more than 10 high scores
    const scores = [];
    for (let i = 1; i <= 15; i++) {
      scores.push({
        player_name: `Player${i}`,
        difficulty: 'beginner' as const,
        duration_seconds: i * 10,
      });
    }
    await db.insert(highScoresTable).values(scores).execute();

    const result = await getLeaderboard({
      difficulty: 'beginner',
      limit: 10 // Use explicit limit since input schema requires it
    });

    expect(result).toHaveLength(10); // Default limit applied
    expect(result[0].duration_seconds).toEqual(10); // Fastest
    expect(result[9].duration_seconds).toEqual(100); // 10th fastest
  });
});