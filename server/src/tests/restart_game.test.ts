import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { type RestartGameInput } from '../schema';
import { restartGame } from '../handlers/restart_game';
import { eq } from 'drizzle-orm';

// Test input
const testInput: RestartGameInput = {
  game_id: 1
};

describe('restartGame', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should restart a game with the same configuration', async () => {
    // Create initial game
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'intermediate',
        rows: 16,
        columns: 16,
        mines: 40,
        status: 'lost',
        cells_revealed: 50,
        flags_placed: 10,
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Verify the new game has the same configuration
    expect(result.game.player_name).toEqual('TestPlayer');
    expect(result.game.difficulty).toEqual('intermediate');
    expect(result.game.rows).toEqual(16);
    expect(result.game.columns).toEqual(16);
    expect(result.game.mines).toEqual(40);
    
    // Verify the game is reset to initial state
    expect(result.game.status).toEqual('in_progress');
    expect(result.game.cells_revealed).toEqual(0);
    expect(result.game.flags_placed).toEqual(0);
    expect(result.game.end_time).toBeNull();
    expect(result.game.duration_seconds).toBeNull();
    
    // Verify new game has different ID
    expect(result.game.id).not.toEqual(initialGame.id);
    expect(result.game.id).toBeGreaterThan(initialGame.id);
  });

  it('should create correct grid dimensions', async () => {
    // Create initial game with custom dimensions
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'custom',
        rows: 12,
        columns: 20,
        mines: 30,
        status: 'won',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Verify grid dimensions
    expect(result.grid).toHaveLength(12); // rows
    expect(result.grid[0]).toHaveLength(20); // columns

    // Verify all cells are properly initialized
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 20; col++) {
        const cell = result.grid[row][col];
        expect(cell.row).toEqual(row);
        expect(cell.column).toEqual(col);
        expect(cell.is_revealed).toEqual(false);
        expect(cell.is_flagged).toEqual(false);
        // Mine and adjacent_mines should be hidden from client
        expect(cell.is_mine).toEqual(false);
        expect(cell.adjacent_mines).toEqual(0);
      }
    }
  });

  it('should save game cells to database', async () => {
    // Create initial game
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'beginner',
        rows: 8,
        columns: 8,
        mines: 10,
        status: 'in_progress',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Query the database for game cells
    const cells = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result.game.id))
      .execute();

    // Verify correct number of cells created
    expect(cells).toHaveLength(64); // 8x8 grid

    // Verify mine count
    const mineCount = cells.filter(cell => cell.is_mine).length;
    expect(mineCount).toEqual(10);

    // Verify all cells are properly initialized
    cells.forEach(cell => {
      expect(cell.game_id).toEqual(result.game.id);
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(8);
      expect(cell.column).toBeGreaterThanOrEqual(0);
      expect(cell.column).toBeLessThan(8);
      expect(cell.is_revealed).toEqual(false);
      expect(cell.is_flagged).toEqual(false);
      expect(cell.adjacent_mines).toBeGreaterThanOrEqual(0);
      expect(cell.adjacent_mines).toBeLessThanOrEqual(8);
    });
  });

  it('should calculate adjacent mines correctly', async () => {
    // Create initial game with small grid for easier verification
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: null,
        difficulty: 'custom',
        rows: 3,
        columns: 3,
        mines: 1,
        status: 'in_progress',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Query the database for game cells to verify adjacent mine calculations
    const cells = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result.game.id))
      .execute();

    // Find the mine cell
    const mineCell = cells.find(cell => cell.is_mine);
    expect(mineCell).toBeDefined();

    // Verify mine cell has adjacent_mines = 0 (mines don't count adjacent mines)
    expect(mineCell!.adjacent_mines).toEqual(0);

    // Verify adjacent cells have correct counts
    const nonMineCells = cells.filter(cell => !cell.is_mine);
    nonMineCells.forEach(cell => {
      // For a 3x3 grid with 1 mine, adjacent cells should have adjacent_mines = 1
      // Corner cells touching the mine should have 1, others should have 0 or 1
      expect(cell.adjacent_mines).toBeGreaterThanOrEqual(0);
      expect(cell.adjacent_mines).toBeLessThanOrEqual(1);
    });

    // At least one non-mine cell should have adjacent_mines = 1
    const adjacentCells = nonMineCells.filter(cell => cell.adjacent_mines === 1);
    expect(adjacentCells.length).toBeGreaterThan(0);
  });

  it('should return correct game state response', async () => {
    // Create initial game
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'expert',
        rows: 16,
        columns: 30,
        mines: 99,
        status: 'won',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Verify response structure
    expect(result.remaining_mines).toEqual(99);
    expect(result.is_game_over).toEqual(false);
    expect(result.is_victory).toEqual(false);

    // Verify timestamps are reasonable
    expect(result.game.start_time).toBeInstanceOf(Date);
    expect(result.game.created_at).toBeInstanceOf(Date);
    expect(result.game.updated_at).toBeInstanceOf(Date);
  });

  it('should handle anonymous games', async () => {
    // Create initial anonymous game
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: null,
        difficulty: 'beginner',
        rows: 8,
        columns: 8,
        mines: 10,
        status: 'lost',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game
    const result = await restartGame({ game_id: initialGame.id });

    // Verify anonymous game handling
    expect(result.game.player_name).toBeNull();
    expect(result.game.difficulty).toEqual('beginner');
    expect(result.game.status).toEqual('in_progress');
  });

  it('should throw error for non-existent game', async () => {
    // Try to restart a game that doesn't exist
    const nonExistentGameId = 999;

    await expect(restartGame({ game_id: nonExistentGameId }))
      .rejects.toThrow(/Game with id 999 not found/i);
  });

  it('should generate different mine layouts on restart', async () => {
    // Create initial game with sufficient mines for variation
    const initialGameResult = await db.insert(gamesTable)
      .values({
        player_name: 'TestPlayer',
        difficulty: 'intermediate',
        rows: 16,
        columns: 16,
        mines: 40,
        status: 'won',
      })
      .returning()
      .execute();

    const initialGame = initialGameResult[0];

    // Restart the game twice
    const result1 = await restartGame({ game_id: initialGame.id });
    const result2 = await restartGame({ game_id: initialGame.id });

    // Get cells from database for both games
    const cells1 = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result1.game.id))
      .execute();

    const cells2 = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result2.game.id))
      .execute();

    // Both should have same mine count
    const mineCount1 = cells1.filter(cell => cell.is_mine).length;
    const mineCount2 = cells2.filter(cell => cell.is_mine).length;
    expect(mineCount1).toEqual(40);
    expect(mineCount2).toEqual(40);

    // Mine positions should be different (very unlikely to be identical)
    const minePositions1 = cells1
      .filter(cell => cell.is_mine)
      .map(cell => `${cell.row},${cell.column}`)
      .sort();
    
    const minePositions2 = cells2
      .filter(cell => cell.is_mine)
      .map(cell => `${cell.row},${cell.column}`)
      .sort();

    expect(minePositions1).not.toEqual(minePositions2);
  });
});