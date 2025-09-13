import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { type CreateGameInput } from '../schema';
import { createGame } from '../handlers/create_game';
import { eq } from 'drizzle-orm';

describe('createGame', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a beginner game with default configuration', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Test Player',
      difficulty: 'beginner',
    };

    const result = await createGame(testInput);

    // Validate game record
    expect(result.game.player_name).toEqual('Test Player');
    expect(result.game.difficulty).toEqual('beginner');
    expect(result.game.rows).toEqual(8);
    expect(result.game.columns).toEqual(8);
    expect(result.game.mines).toEqual(10);
    expect(result.game.status).toEqual('in_progress');
    expect(result.game.cells_revealed).toEqual(0);
    expect(result.game.flags_placed).toEqual(0);
    expect(result.game.id).toBeDefined();
    expect(result.game.start_time).toBeInstanceOf(Date);
    expect(result.game.created_at).toBeInstanceOf(Date);

    // Validate game state
    expect(result.grid).toHaveLength(8);
    expect(result.grid[0]).toHaveLength(8);
    expect(result.remaining_mines).toEqual(10);
    expect(result.is_game_over).toEqual(false);
    expect(result.is_victory).toEqual(false);

    // Validate that mines are hidden from client
    const allCells = result.grid.flat();
    expect(allCells.every(cell => cell.is_mine === false)).toBe(true);
    expect(allCells.every(cell => cell.is_revealed === false)).toBe(true);
    expect(allCells.every(cell => cell.is_flagged === false)).toBe(true);
  });

  it('should create an intermediate game with correct configuration', async () => {
    const testInput: CreateGameInput = {
      player_name: null,
      difficulty: 'intermediate',
    };

    const result = await createGame(testInput);

    expect(result.game.player_name).toBeNull();
    expect(result.game.difficulty).toEqual('intermediate');
    expect(result.game.rows).toEqual(16);
    expect(result.game.columns).toEqual(16);
    expect(result.game.mines).toEqual(40);
    expect(result.grid).toHaveLength(16);
    expect(result.grid[0]).toHaveLength(16);
    expect(result.remaining_mines).toEqual(40);
  });

  it('should create an expert game with correct configuration', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Expert Player',
      difficulty: 'expert',
    };

    const result = await createGame(testInput);

    expect(result.game.difficulty).toEqual('expert');
    expect(result.game.rows).toEqual(16);
    expect(result.game.columns).toEqual(30);
    expect(result.game.mines).toEqual(99);
    expect(result.grid).toHaveLength(16);
    expect(result.grid[0]).toHaveLength(30);
    expect(result.remaining_mines).toEqual(99);
  });

  it('should create a custom game with provided dimensions', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Custom Player',
      difficulty: 'custom',
      rows: 12,
      columns: 15,
      mines: 25,
    };

    const result = await createGame(testInput);

    expect(result.game.difficulty).toEqual('custom');
    expect(result.game.rows).toEqual(12);
    expect(result.game.columns).toEqual(15);
    expect(result.game.mines).toEqual(25);
    expect(result.grid).toHaveLength(12);
    expect(result.grid[0]).toHaveLength(15);
    expect(result.remaining_mines).toEqual(25);
  });

  it('should create a custom game with default values when not provided', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Default Custom',
      difficulty: 'custom',
    };

    const result = await createGame(testInput);

    expect(result.game.rows).toEqual(8);
    expect(result.game.columns).toEqual(8);
    expect(result.game.mines).toEqual(10);
  });

  it('should save game record to database correctly', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Database Test',
      difficulty: 'beginner',
    };

    const result = await createGame(testInput);

    // Verify game record exists in database
    const games = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, result.game.id))
      .execute();

    expect(games).toHaveLength(1);
    const gameRecord = games[0];
    expect(gameRecord.player_name).toEqual('Database Test');
    expect(gameRecord.difficulty).toEqual('beginner');
    expect(gameRecord.rows).toEqual(8);
    expect(gameRecord.columns).toEqual(8);
    expect(gameRecord.mines).toEqual(10);
    expect(gameRecord.status).toEqual('in_progress');
  });

  it('should save all game cells to database', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Cell Test',
      difficulty: 'beginner',
    };

    const result = await createGame(testInput);

    // Verify all cells exist in database
    const cells = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result.game.id))
      .execute();

    expect(cells).toHaveLength(64); // 8x8 = 64 cells

    // Verify mine count in database matches expected
    const minesInDb = cells.filter(cell => cell.is_mine).length;
    expect(minesInDb).toEqual(10);

    // Verify all cells are initially unrevealed and unflagged
    expect(cells.every(cell => !cell.is_revealed)).toBe(true);
    expect(cells.every(cell => !cell.is_flagged)).toBe(true);

    // Verify adjacent mine counts are calculated (at least some cells should have counts > 0)
    const cellsWithAdjacentMines = cells.filter(cell => !cell.is_mine && cell.adjacent_mines > 0);
    expect(cellsWithAdjacentMines.length).toBeGreaterThan(0);
  });

  it('should generate correct grid coordinates', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Coordinate Test',
      difficulty: 'custom',
      rows: 3,
      columns: 4,
      mines: 2,
    };

    const result = await createGame(testInput);

    // Check all coordinates are present and correct
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = result.grid[row][col];
        expect(cell.row).toEqual(row);
        expect(cell.column).toEqual(col);
      }
    }
  });

  it('should throw error when mines exceed total cells', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Error Test',
      difficulty: 'custom',
      rows: 3,
      columns: 3,
      mines: 10, // More than 9 total cells
    };

    await expect(createGame(testInput)).rejects.toThrow(/too many mines/i);
  });

  it('should throw error when mines equal total cells', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Error Test',
      difficulty: 'custom',
      rows: 2,
      columns: 2,
      mines: 4, // Equal to 4 total cells
    };

    await expect(createGame(testInput)).rejects.toThrow(/too many mines/i);
  });

  it('should calculate adjacent mines correctly', async () => {
    const testInput: CreateGameInput = {
      player_name: 'Adjacent Test',
      difficulty: 'custom',
      rows: 5,
      columns: 5,
      mines: 3,
    };

    const result = await createGame(testInput);

    // Get actual mine positions from database to verify adjacent counts
    const cells = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, result.game.id))
      .execute();

    const mines = cells.filter(cell => cell.is_mine);
    expect(mines).toHaveLength(3);

    // Verify that adjacent mine counts are reasonable (0-8 range)
    const nonMineCells = cells.filter(cell => !cell.is_mine);
    expect(nonMineCells.every(cell => cell.adjacent_mines >= 0 && cell.adjacent_mines <= 8)).toBe(true);

    // Verify that at least some cells adjacent to mines have counts > 0
    const cellsWithCounts = nonMineCells.filter(cell => cell.adjacent_mines > 0);
    if (mines.length > 0) {
      expect(cellsWithCounts.length).toBeGreaterThan(0);
    }
  });
});