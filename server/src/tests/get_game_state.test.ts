import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { getGameState } from '../handlers/get_game_state';

describe('getGameState', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve game state for in-progress game', async () => {
    // Create test game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'Test Player',
        difficulty: 'beginner',
        rows: 3,
        columns: 3,
        mines: 2,
        status: 'in_progress',
        cells_revealed: 2,
        flags_placed: 1,
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;

    // Create test cells
    await db.insert(gameCellsTable)
      .values([
        // Row 0
        { game_id: gameId, row: 0, column: 0, is_mine: true, is_revealed: false, is_flagged: true, adjacent_mines: 0 },
        { game_id: gameId, row: 0, column: 1, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 2 },
        { game_id: gameId, row: 0, column: 2, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 1 },
        // Row 1
        { game_id: gameId, row: 1, column: 0, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 2 },
        { game_id: gameId, row: 1, column: 1, is_mine: true, is_revealed: false, is_flagged: false, adjacent_mines: 0 },
        { game_id: gameId, row: 1, column: 2, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 2 },
        // Row 2
        { game_id: gameId, row: 2, column: 0, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 2, column: 1, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 2, column: 2, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
      ])
      .execute();

    const result = await getGameState(gameId);

    // Verify game data
    expect(result.game.id).toEqual(gameId);
    expect(result.game.player_name).toEqual('Test Player');
    expect(result.game.difficulty).toEqual('beginner');
    expect(result.game.rows).toEqual(3);
    expect(result.game.columns).toEqual(3);
    expect(result.game.mines).toEqual(2);
    expect(result.game.status).toEqual('in_progress');
    expect(result.game.cells_revealed).toEqual(2);
    expect(result.game.flags_placed).toEqual(1);
    expect(result.game.start_time).toBeInstanceOf(Date);
    expect(result.game.created_at).toBeInstanceOf(Date);
    expect(result.game.updated_at).toBeInstanceOf(Date);

    // Verify grid structure
    expect(result.grid).toHaveLength(3);
    expect(result.grid[0]).toHaveLength(3);

    // Verify cell visibility rules for in-progress game
    // Flagged cell (0,0) - should show as flagged but not reveal mine
    expect(result.grid[0][0].is_flagged).toBe(true);
    expect(result.grid[0][0].is_revealed).toBe(false);
    expect(result.grid[0][0].is_mine).toBe(false); // Hidden because game not over

    // Revealed cells (0,1) and (0,2) - should show full info
    expect(result.grid[0][1].is_revealed).toBe(true);
    expect(result.grid[0][1].is_mine).toBe(false);
    expect(result.grid[0][1].adjacent_mines).toEqual(2);

    expect(result.grid[0][2].is_revealed).toBe(true);
    expect(result.grid[0][2].is_mine).toBe(false);
    expect(result.grid[0][2].adjacent_mines).toEqual(1);

    // Hidden cells should not reveal mine status
    expect(result.grid[1][1].is_revealed).toBe(false);
    expect(result.grid[1][1].is_mine).toBe(false); // Hidden because game not over

    // Verify calculated fields
    expect(result.remaining_mines).toEqual(1); // 2 mines - 1 flag
    expect(result.is_game_over).toBe(false);
    expect(result.is_victory).toBe(false);
  });

  it('should reveal all mines when game is over (lost)', async () => {
    // Create lost game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'Failed Player',
        difficulty: 'beginner',
        rows: 2,
        columns: 2,
        mines: 1,
        status: 'lost',
        cells_revealed: 1,
        flags_placed: 0,
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;

    // Create test cells with one mine
    await db.insert(gameCellsTable)
      .values([
        { game_id: gameId, row: 0, column: 0, is_mine: true, is_revealed: true, is_flagged: false, adjacent_mines: 0 }, // Hit mine
        { game_id: gameId, row: 0, column: 1, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 1, column: 0, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 1, column: 1, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 1 },
      ])
      .execute();

    const result = await getGameState(gameId);

    // Verify game over status
    expect(result.game.status).toEqual('lost');
    expect(result.is_game_over).toBe(true);
    expect(result.is_victory).toBe(false);

    // All cells should be revealed when game is over
    expect(result.grid[0][0].is_revealed).toBe(true);
    expect(result.grid[0][0].is_mine).toBe(true); // Mine should be visible now
    expect(result.grid[0][1].is_revealed).toBe(true);
    expect(result.grid[1][0].is_revealed).toBe(true);
    expect(result.grid[1][1].is_revealed).toBe(true);
  });

  it('should handle won game correctly', async () => {
    // Create won game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'Winner',
        difficulty: 'expert',
        rows: 2,
        columns: 2,
        mines: 1,
        status: 'won',
        cells_revealed: 3,
        flags_placed: 1,
        duration_seconds: 45,
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;

    // Create test cells for won game
    await db.insert(gameCellsTable)
      .values([
        { game_id: gameId, row: 0, column: 0, is_mine: true, is_revealed: false, is_flagged: true, adjacent_mines: 0 },
        { game_id: gameId, row: 0, column: 1, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 1, column: 0, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 1, column: 1, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 1 },
      ])
      .execute();

    const result = await getGameState(gameId);

    // Verify victory status
    expect(result.game.status).toEqual('won');
    expect(result.game.duration_seconds).toEqual(45);
    expect(result.is_game_over).toBe(true);
    expect(result.is_victory).toBe(true);

    // All cells should be revealed when game is over
    expect(result.grid[0][0].is_revealed).toBe(true);
    expect(result.grid[0][0].is_mine).toBe(true); // Mine visible after victory
    expect(result.grid[0][0].is_flagged).toBe(true); // Flag status preserved

    expect(result.remaining_mines).toEqual(0); // 1 mine - 1 flag
  });

  it('should handle anonymous player games', async () => {
    // Create anonymous game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: null, // Anonymous
        difficulty: 'intermediate',
        rows: 4,
        columns: 4,
        mines: 3,
        status: 'paused',
        cells_revealed: 0,
        flags_placed: 0,
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;

    // Create minimal cell data
    await db.insert(gameCellsTable)
      .values([
        { game_id: gameId, row: 0, column: 0, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 0 },
        { game_id: gameId, row: 0, column: 1, is_mine: true, is_revealed: false, is_flagged: false, adjacent_mines: 0 },
      ])
      .execute();

    const result = await getGameState(gameId);

    // Verify anonymous player handling
    expect(result.game.player_name).toBeNull();
    expect(result.game.difficulty).toEqual('intermediate');
    expect(result.game.status).toEqual('paused');
    expect(result.remaining_mines).toEqual(3); // 3 mines - 0 flags
    expect(result.is_game_over).toBe(false);
    expect(result.is_victory).toBe(false);

    // Verify grid dimensions
    expect(result.grid).toHaveLength(4);
    expect(result.grid[0]).toHaveLength(4);
  });

  it('should throw error for non-existent game', async () => {
    const nonExistentId = 999;

    await expect(getGameState(nonExistentId))
      .rejects
      .toThrow(/Game with id 999 not found/i);
  });

  it('should handle custom difficulty with large grid', async () => {
    // Create custom difficulty game
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'Expert Player',
        difficulty: 'custom',
        rows: 10,
        columns: 15,
        mines: 25,
        status: 'in_progress',
        cells_revealed: 5,
        flags_placed: 3,
      })
      .returning()
      .execute();

    const gameId = gameResult[0].id;

    // Create a few test cells (not full grid for performance)
    await db.insert(gameCellsTable)
      .values([
        { game_id: gameId, row: 0, column: 0, is_mine: false, is_revealed: true, is_flagged: false, adjacent_mines: 1 },
        { game_id: gameId, row: 5, column: 7, is_mine: true, is_revealed: false, is_flagged: true, adjacent_mines: 0 },
        { game_id: gameId, row: 9, column: 14, is_mine: false, is_revealed: false, is_flagged: false, adjacent_mines: 2 },
      ])
      .execute();

    const result = await getGameState(gameId);

    // Verify custom game properties
    expect(result.game.difficulty).toEqual('custom');
    expect(result.game.rows).toEqual(10);
    expect(result.game.columns).toEqual(15);
    expect(result.game.mines).toEqual(25);
    expect(result.remaining_mines).toEqual(22); // 25 mines - 3 flags

    // Verify grid size
    expect(result.grid).toHaveLength(10);
    expect(result.grid[0]).toHaveLength(15);
    expect(result.grid[9]).toHaveLength(15);

    // Verify specific cells
    expect(result.grid[0][0].is_revealed).toBe(true);
    expect(result.grid[0][0].adjacent_mines).toEqual(1);
    
    expect(result.grid[5][7].is_flagged).toBe(true);
    expect(result.grid[5][7].is_mine).toBe(false); // Hidden in active game
    
    expect(result.grid[9][14].is_revealed).toBe(false);
    expect(result.grid[9][14].is_flagged).toBe(false);
  });
});