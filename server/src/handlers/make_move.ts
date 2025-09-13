import { db } from '../db';
import { gamesTable, gameCellsTable, highScoresTable } from '../db/schema';
import { type GameMoveInput, type GameStateResponse, type Cell } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function makeMove(input: GameMoveInput): Promise<GameStateResponse> {
  try {
    // 1. Validate that the game exists and is in progress
    const game = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, input.game_id))
      .execute();

    if (!game || game.length === 0) {
      throw new Error('Game not found');
    }

    const gameRecord = game[0];

    if (gameRecord.status !== 'in_progress') {
      throw new Error('Game is not in progress');
    }

    // 2. Validate the move coordinates are within bounds
    if (input.row < 0 || input.row >= gameRecord.rows || 
        input.column < 0 || input.column >= gameRecord.columns) {
      throw new Error('Move coordinates are out of bounds');
    }

    // Get current cell state
    const cellResult = await db.select()
      .from(gameCellsTable)
      .where(
        and(
          eq(gameCellsTable.game_id, input.game_id),
          eq(gameCellsTable.row, input.row),
          eq(gameCellsTable.column, input.column)
        )
      )
      .execute();

    if (!cellResult || cellResult.length === 0) {
      throw new Error('Cell not found');
    }

    const currentCell = cellResult[0];

    // 3. Handle different action types
    let updatedGame = gameRecord;
    let gameStatusChanged = false;

    if (input.action === 'reveal') {
      // Can't reveal already revealed or flagged cells
      if (currentCell.is_revealed) {
        throw new Error('Cell is already revealed');
      }
      if (currentCell.is_flagged) {
        throw new Error('Cannot reveal flagged cell');
      }

      // Reveal the cell
      await db.update(gameCellsTable)
        .set({ is_revealed: true })
        .where(eq(gameCellsTable.id, currentCell.id))
        .execute();

      // Handle chain revealing for empty cells (adjacent_mines = 0)
      if (!currentCell.is_mine && currentCell.adjacent_mines === 0) {
        await revealAdjacentCells(input.game_id, input.row, input.column, gameRecord.rows, gameRecord.columns);
      }

      // Update cells_revealed count
      const revealedCount = await countRevealedCells(input.game_id);
      
      // Check for mine hit (lose condition)
      if (currentCell.is_mine) {
        const endTime = new Date();
        const durationSeconds = Math.max(1, Math.floor((endTime.getTime() - gameRecord.start_time.getTime()) / 1000));
        
        updatedGame = await updateGameStatus(input.game_id, 'lost', endTime, durationSeconds, revealedCount, gameRecord.flags_placed);
        gameStatusChanged = true;
      } else {
        // Check for win condition (all non-mine cells revealed)
        const totalCells = gameRecord.rows * gameRecord.columns;
        const nonMineCells = totalCells - gameRecord.mines;
        
        if (revealedCount >= nonMineCells) {
          const endTime = new Date();
          const durationSeconds = Math.max(1, Math.floor((endTime.getTime() - gameRecord.start_time.getTime()) / 1000));
          
          updatedGame = await updateGameStatus(input.game_id, 'won', endTime, durationSeconds, revealedCount, gameRecord.flags_placed);
          gameStatusChanged = true;

          // Add to high scores if player has a name
          if (gameRecord.player_name) {
            await db.insert(highScoresTable)
              .values({
                player_name: gameRecord.player_name,
                difficulty: gameRecord.difficulty,
                duration_seconds: durationSeconds
              })
              .execute();
          }
        } else {
          // Just update the revealed count
          updatedGame = await updateGameStats(input.game_id, revealedCount, gameRecord.flags_placed);
        }
      }

    } else if (input.action === 'flag') {
      // Can't flag already revealed cells
      if (currentCell.is_revealed) {
        throw new Error('Cannot flag revealed cell');
      }
      // Can't flag already flagged cells
      if (currentCell.is_flagged) {
        throw new Error('Cell is already flagged');
      }

      await db.update(gameCellsTable)
        .set({ is_flagged: true })
        .where(eq(gameCellsTable.id, currentCell.id))
        .execute();

      const newFlagsPlaced = gameRecord.flags_placed + 1;
      updatedGame = await updateGameStats(input.game_id, gameRecord.cells_revealed, newFlagsPlaced);

    } else if (input.action === 'unflag') {
      // Can only unflag flagged cells
      if (!currentCell.is_flagged) {
        throw new Error('Cell is not flagged');
      }

      await db.update(gameCellsTable)
        .set({ is_flagged: false })
        .where(eq(gameCellsTable.id, currentCell.id))
        .execute();

      const newFlagsPlaced = gameRecord.flags_placed - 1;
      updatedGame = await updateGameStats(input.game_id, gameRecord.cells_revealed, newFlagsPlaced);
    }

    // Get current game state and build response
    const grid = await buildGameGrid(input.game_id, updatedGame.rows, updatedGame.columns);
    const remainingMines = Math.max(0, updatedGame.mines - updatedGame.flags_placed);
    const isGameOver = updatedGame.status === 'won' || updatedGame.status === 'lost';
    const isVictory = updatedGame.status === 'won';

    return {
      game: updatedGame,
      grid,
      remaining_mines: remainingMines,
      is_game_over: isGameOver,
      is_victory: isVictory,
    };

  } catch (error) {
    console.error('Move execution failed:', error);
    throw error;
  }
}

// Helper function to reveal adjacent cells for empty cells
async function revealAdjacentCells(gameId: number, row: number, column: number, maxRows: number, maxColumns: number): Promise<void> {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = column + dc;

    // Check bounds
    if (newRow >= 0 && newRow < maxRows && newCol >= 0 && newCol < maxColumns) {
      const adjacentCell = await db.select()
        .from(gameCellsTable)
        .where(
          and(
            eq(gameCellsTable.game_id, gameId),
            eq(gameCellsTable.row, newRow),
            eq(gameCellsTable.column, newCol)
          )
        )
        .execute();

      if (adjacentCell && adjacentCell.length > 0) {
        const cell = adjacentCell[0];
        
        // Only reveal if not already revealed, not flagged, and not a mine
        if (!cell.is_revealed && !cell.is_flagged && !cell.is_mine) {
          await db.update(gameCellsTable)
            .set({ is_revealed: true })
            .where(eq(gameCellsTable.id, cell.id))
            .execute();

          // Recursively reveal if this cell is also empty
          if (cell.adjacent_mines === 0) {
            await revealAdjacentCells(gameId, newRow, newCol, maxRows, maxColumns);
          }
        }
      }
    }
  }
}

// Helper function to count revealed cells
async function countRevealedCells(gameId: number): Promise<number> {
  const result = await db.select()
    .from(gameCellsTable)
    .where(
      and(
        eq(gameCellsTable.game_id, gameId),
        eq(gameCellsTable.is_revealed, true)
      )
    )
    .execute();

  return result.length;
}

// Helper function to update game status when game ends
async function updateGameStatus(gameId: number, status: 'won' | 'lost', endTime: Date, durationSeconds: number, cellsRevealed: number, flagsPlaced: number) {
  const result = await db.update(gamesTable)
    .set({
      status,
      end_time: endTime,
      duration_seconds: durationSeconds,
      cells_revealed: cellsRevealed,
      flags_placed: flagsPlaced,
      updated_at: new Date()
    })
    .where(eq(gamesTable.id, gameId))
    .returning()
    .execute();

  return result[0];
}

// Helper function to update game stats without changing status
async function updateGameStats(gameId: number, cellsRevealed: number, flagsPlaced: number) {
  const result = await db.update(gamesTable)
    .set({
      cells_revealed: cellsRevealed,
      flags_placed: flagsPlaced,
      updated_at: new Date()
    })
    .where(eq(gamesTable.id, gameId))
    .returning()
    .execute();

  return result[0];
}

// Helper function to build the game grid for response
async function buildGameGrid(gameId: number, rows: number, columns: number): Promise<Cell[][]> {
  const cells = await db.select()
    .from(gameCellsTable)
    .where(eq(gameCellsTable.game_id, gameId))
    .execute();

  // Create grid array
  const grid: Cell[][] = Array(rows).fill(null).map(() => Array(columns).fill(null));

  // Fill grid with cell data
  for (const cell of cells) {
    grid[cell.row][cell.column] = {
      row: cell.row,
      column: cell.column,
      is_mine: cell.is_mine,
      is_revealed: cell.is_revealed,
      is_flagged: cell.is_flagged,
      adjacent_mines: cell.adjacent_mines,
    };
  }

  return grid;
}