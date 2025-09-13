import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gamesTable, gameCellsTable, highScoresTable } from '../db/schema';
import { type GameMoveInput } from '../schema';
import { makeMove } from '../handlers/make_move';
import { eq, and } from 'drizzle-orm';

describe('makeMove', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test game with cells
  async function createTestGame(rows: number = 3, columns: number = 3, mines: number = 1) {
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: 'Test Player',
        difficulty: 'custom',
        rows,
        columns,
        mines,
        status: 'in_progress',
        start_time: new Date(),
        cells_revealed: 0,
        flags_placed: 0,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    // Create cells - mine at (0,0), others safe
    const cells = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const isMine = row === 0 && col === 0; // Mine at top-left
        let adjacentMines = 0;

        // Calculate adjacent mines
        if (!isMine) {
          const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
          ];

          for (const [dr, dc] of directions) {
            const adjRow = row + dr;
            const adjCol = col + dc;
            if (adjRow >= 0 && adjRow < rows && adjCol >= 0 && adjCol < columns) {
              if (adjRow === 0 && adjCol === 0) { // Mine position
                adjacentMines++;
              }
            }
          }
        }

        cells.push({
          game_id: game.id,
          row,
          column: col,
          is_mine: isMine,
          is_revealed: false,
          is_flagged: false,
          adjacent_mines: adjacentMines,
        });
      }
    }

    await db.insert(gameCellsTable).values(cells).execute();
    return game;
  }

  describe('game validation', () => {
    it('should throw error for non-existent game', async () => {
      const input: GameMoveInput = {
        game_id: 999,
        row: 0,
        column: 0,
        action: 'reveal',
      };

      await expect(makeMove(input)).rejects.toThrow(/game not found/i);
    });

    it('should throw error for finished game', async () => {
      const game = await createTestGame();
      
      // End the game
      await db.update(gamesTable)
        .set({ status: 'won' })
        .where(eq(gamesTable.id, game.id))
        .execute();

      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      };

      await expect(makeMove(input)).rejects.toThrow(/game is not in progress/i);
    });

    it('should throw error for out of bounds coordinates', async () => {
      const game = await createTestGame(3, 3);

      const input: GameMoveInput = {
        game_id: game.id,
        row: 5,
        column: 5,
        action: 'reveal',
      };

      await expect(makeMove(input)).rejects.toThrow(/out of bounds/i);
    });
  });

  describe('reveal action', () => {
    it('should reveal a safe cell', async () => {
      const game = await createTestGame();

      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      };

      const result = await makeMove(input);

      expect(result.game.status).toEqual('in_progress');
      expect(result.game.cells_revealed).toEqual(1);
      expect(result.grid[1][1].is_revealed).toBe(true);
      expect(result.is_game_over).toBe(false);
      expect(result.is_victory).toBe(false);
    });

    it('should trigger game loss when revealing a mine', async () => {
      const game = await createTestGame();

      const input: GameMoveInput = {
        game_id: game.id,
        row: 0,
        column: 0, // Mine position
        action: 'reveal',
      };

      const result = await makeMove(input);

      expect(result.game.status).toEqual('lost');
      expect(result.game.end_time).toBeDefined();
      expect(result.game.duration_seconds).toBeGreaterThan(0);
      expect(result.grid[0][0].is_revealed).toBe(true);
      expect(result.is_game_over).toBe(true);
      expect(result.is_victory).toBe(false);
    });

    it('should trigger game win when all safe cells are revealed', async () => {
      // Create a simple 2x2 grid with 1 mine to have precise control
      const gameResult = await db.insert(gamesTable)
        .values({
          player_name: 'Test Player',
          difficulty: 'custom',
          rows: 2,
          columns: 2,
          mines: 1,
          status: 'in_progress',
          start_time: new Date(),
          cells_revealed: 0,
          flags_placed: 0,
        })
        .returning()
        .execute();

      const game = gameResult[0];

      // Create cells with mine at (0,0)
      const cells = [
        { game_id: game.id, row: 0, column: 0, is_mine: true, adjacent_mines: 0 },
        { game_id: game.id, row: 0, column: 1, is_mine: false, adjacent_mines: 1 },
        { game_id: game.id, row: 1, column: 0, is_mine: false, adjacent_mines: 1 },
        { game_id: game.id, row: 1, column: 1, is_mine: false, adjacent_mines: 1 },
      ];

      await db.insert(gameCellsTable).values(cells).execute();

      // Reveal first safe cell
      await makeMove({
        game_id: game.id,
        row: 0,
        column: 1,
        action: 'reveal',
      });

      // Reveal second safe cell
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 0,
        action: 'reveal',
      });

      // Reveal the last safe cell to win
      const result = await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      });

      expect(result.game.status).toEqual('won');
      expect(result.game.end_time).toBeDefined();
      expect(result.game.duration_seconds).toBeGreaterThan(0);
      expect(result.is_game_over).toBe(true);
      expect(result.is_victory).toBe(true);

      // Check high score was created
      const highScores = await db.select()
        .from(highScoresTable)
        .where(eq(highScoresTable.player_name, 'Test Player'))
        .execute();

      expect(highScores).toHaveLength(1);
      expect(highScores[0].difficulty).toEqual('custom');
      expect(highScores[0].duration_seconds).toBeGreaterThan(0);
    });

    it('should chain reveal empty cells', async () => {
      // Create a 4x4 grid with one mine in corner to test chain revealing
      const gameResult = await db.insert(gamesTable)
        .values({
          player_name: 'Test Player',
          difficulty: 'custom',
          rows: 4,
          columns: 4,
          mines: 1, 
          status: 'in_progress',
          start_time: new Date(),
          cells_revealed: 0,
          flags_placed: 0,
        })
        .returning()
        .execute();

      const game = gameResult[0];

      // Create cells with mine only at (0,0)
      const cells = [];
      
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const isMine = row === 0 && col === 0;
          let adjacentMines = 0;

          // Calculate adjacent mines
          if (!isMine) {
            const directions = [
              [-1, -1], [-1, 0], [-1, 1],
              [0, -1],           [0, 1],
              [1, -1],  [1, 0],  [1, 1]
            ];

            for (const [dr, dc] of directions) {
              const adjRow = row + dr;
              const adjCol = col + dc;
              if (adjRow >= 0 && adjRow < 4 && adjCol >= 0 && adjCol < 4) {
                if (adjRow === 0 && adjCol === 0) { // Mine at (0,0)
                  adjacentMines++;
                }
              }
            }
          }

          cells.push({
            game_id: game.id,
            row,
            column: col,
            is_mine: isMine,
            is_revealed: false,
            is_flagged: false,
            adjacent_mines: adjacentMines,
          });
        }
      }

      await db.insert(gameCellsTable).values(cells).execute();

      // Reveal cell (2,2) which should have adjacent_mines = 0 and trigger chain reveal
      // But we'll manually reveal a few other cells first so it doesn't win immediately
      
      // First reveal a couple of cells to prevent immediate win
      await makeMove({
        game_id: game.id,
        row: 0,
        column: 1, // This has adjacent_mines = 1, won't chain
        action: 'reveal',
      });

      // Now reveal (3,3) which should chain reveal several cells with adjacent_mines = 0
      const input: GameMoveInput = {
        game_id: game.id,
        row: 3,
        column: 3,
        action: 'reveal',
      };

      const result = await makeMove(input);

      // The game might win here since there are many cells, but let's check chain revealing worked
      expect(result.game.cells_revealed).toBeGreaterThan(2); // Should reveal multiple cells due to chain
      
      // Check that cell (3,3) was revealed and had adjacent_mines = 0
      expect(result.grid[3][3].is_revealed).toBe(true);
      expect(result.grid[3][3].adjacent_mines).toEqual(0);
      
      // Check that some adjacent cells were also revealed due to chain revealing
      let revealedCount = 0;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (result.grid[row][col].is_revealed) {
            revealedCount++;
          }
        }
      }
      expect(revealedCount).toBeGreaterThan(2);
    });

    it('should throw error when revealing already revealed cell', async () => {
      const game = await createTestGame();

      // First reveal
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      });

      // Try to reveal same cell again
      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      };

      await expect(makeMove(input)).rejects.toThrow(/already revealed/i);
    });

    it('should throw error when revealing flagged cell', async () => {
      const game = await createTestGame();

      // First flag the cell
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      });

      // Try to reveal flagged cell
      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      };

      await expect(makeMove(input)).rejects.toThrow(/cannot reveal flagged cell/i);
    });
  });

  describe('flag action', () => {
    it('should flag a hidden cell', async () => {
      const game = await createTestGame();

      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      };

      const result = await makeMove(input);

      expect(result.game.flags_placed).toEqual(1);
      expect(result.grid[1][1].is_flagged).toBe(true);
      expect(result.remaining_mines).toEqual(0); // 1 mine - 1 flag = 0
    });

    it('should throw error when flagging revealed cell', async () => {
      const game = await createTestGame();

      // First reveal the cell
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      });

      // Try to flag revealed cell
      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      };

      await expect(makeMove(input)).rejects.toThrow(/cannot flag revealed cell/i);
    });

    it('should throw error when flagging already flagged cell', async () => {
      const game = await createTestGame();

      // First flag the cell
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      });

      // Try to flag same cell again
      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      };

      await expect(makeMove(input)).rejects.toThrow(/already flagged/i);
    });
  });

  describe('unflag action', () => {
    it('should unflag a flagged cell', async () => {
      const game = await createTestGame();

      // First flag the cell
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      });

      // Then unflag it
      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'unflag',
      };

      const result = await makeMove(input);

      expect(result.game.flags_placed).toEqual(0);
      expect(result.grid[1][1].is_flagged).toBe(false);
      expect(result.remaining_mines).toEqual(1); // 1 mine - 0 flags = 1
    });

    it('should throw error when unflagging non-flagged cell', async () => {
      const game = await createTestGame();

      const input: GameMoveInput = {
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'unflag',
      };

      await expect(makeMove(input)).rejects.toThrow(/cell is not flagged/i);
    });
  });

  describe('game state response', () => {
    it('should return correct remaining mines count', async () => {
      const game = await createTestGame(3, 3, 3); // 3 mines

      // Flag 2 cells
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      });

      const result = await makeMove({
        game_id: game.id,
        row: 1,
        column: 2,
        action: 'flag',
      });

      expect(result.remaining_mines).toEqual(1); // 3 mines - 2 flags = 1
      expect(result.game.flags_placed).toEqual(2);
    });

    it('should not have negative remaining mines', async () => {
      const game = await createTestGame(3, 3, 1); // 1 mine

      // Flag 3 cells (more than mines)
      await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'flag',
      });

      await makeMove({
        game_id: game.id,
        row: 1,
        column: 2,
        action: 'flag',
      });

      const result = await makeMove({
        game_id: game.id,
        row: 2,
        column: 1,
        action: 'flag',
      });

      expect(result.remaining_mines).toEqual(0); // Should be 0, not negative
      expect(result.game.flags_placed).toEqual(3);
    });

    it('should return correct grid structure', async () => {
      const game = await createTestGame(2, 2);

      const result = await makeMove({
        game_id: game.id,
        row: 1,
        column: 1,
        action: 'reveal',
      });

      expect(result.grid).toHaveLength(2);
      expect(result.grid[0]).toHaveLength(2);
      expect(result.grid[1]).toHaveLength(2);

      // Check cell structure
      const cell = result.grid[1][1];
      expect(cell.row).toEqual(1);
      expect(cell.column).toEqual(1);
      expect(cell.is_revealed).toBe(true);
      expect(typeof cell.is_mine).toBe('boolean');
      expect(typeof cell.is_flagged).toBe('boolean');
      expect(typeof cell.adjacent_mines).toBe('number');
      expect(cell.adjacent_mines).toBeGreaterThanOrEqual(0);
      expect(cell.adjacent_mines).toBeLessThanOrEqual(8);
    });
  });

  describe('anonymous games', () => {
    it('should not create high score for anonymous win', async () => {
      // Create anonymous game (no player name)
      const gameResult = await db.insert(gamesTable)
        .values({
          player_name: null, // Anonymous
          difficulty: 'custom',
          rows: 2,
          columns: 2,
          mines: 1,
          status: 'in_progress',
          start_time: new Date(),
          cells_revealed: 0,
          flags_placed: 0,
        })
        .returning()
        .execute();

      const game = gameResult[0];

      // Create minimal cells with mine at (0,0)
      const cells = [
        { game_id: game.id, row: 0, column: 0, is_mine: true, adjacent_mines: 0 },
        { game_id: game.id, row: 0, column: 1, is_mine: false, adjacent_mines: 1 },
        { game_id: game.id, row: 1, column: 0, is_mine: false, adjacent_mines: 1 },
        { game_id: game.id, row: 1, column: 1, is_mine: false, adjacent_mines: 1 },
      ];

      await db.insert(gameCellsTable).values(cells).execute();

      // Win the game by revealing all safe cells
      await makeMove({ game_id: game.id, row: 0, column: 1, action: 'reveal' });
      await makeMove({ game_id: game.id, row: 1, column: 0, action: 'reveal' });
      const result = await makeMove({ game_id: game.id, row: 1, column: 1, action: 'reveal' });

      expect(result.game.status).toEqual('won');
      expect(result.is_victory).toBe(true);

      // Check no high score was created
      const highScores = await db.select()
        .from(highScoresTable)
        .execute();

      expect(highScores).toHaveLength(0);
    });
  });
});