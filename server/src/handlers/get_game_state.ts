import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { type GameStateResponse, type Cell } from '../schema';
import { eq } from 'drizzle-orm';

export async function getGameState(gameId: number): Promise<GameStateResponse> {
  try {
    // 1. Fetch the game record from database by ID
    const gameResults = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .execute();

    if (gameResults.length === 0) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    const game = gameResults[0];

    // 2. Fetch all associated game cells
    const cellResults = await db.select()
      .from(gameCellsTable)
      .where(eq(gameCellsTable.game_id, gameId))
      .execute();

    // 3. Build the grid from the cell data
    const grid: Cell[][] = Array(game.rows).fill(null).map(() => 
      Array(game.columns).fill(null).map(() => ({
        row: 0,
        column: 0,
        is_mine: false,
        is_revealed: false,
        is_flagged: false,
        adjacent_mines: 0,
      }))
    );

    // Populate grid with actual cell data
    cellResults.forEach(cell => {
      if (cell.row < game.rows && cell.column < game.columns) {
        const gridCell = grid[cell.row][cell.column];
        gridCell.row = cell.row;
        gridCell.column = cell.column;
        gridCell.is_flagged = cell.is_flagged;
        gridCell.adjacent_mines = cell.adjacent_mines;

        // Apply visibility rules:
        // - Hidden cells show only flagged status
        // - Revealed cells show mine status and adjacent mine count  
        // - Game over: reveal all mines
        const isGameOver = game.status === 'won' || game.status === 'lost';
        
        if (cell.is_revealed || isGameOver) {
          gridCell.is_revealed = cell.is_revealed || isGameOver;
          gridCell.is_mine = cell.is_mine;
        } else {
          // Hidden cell - don't reveal mine status unless game is over
          gridCell.is_revealed = false;
          gridCell.is_mine = false;
        }
      }
    });

    // 4. Calculate remaining mines (total mines - flags placed)
    const remaining_mines = game.mines - game.flags_placed;

    // 5. Determine if game is over and if it's a victory
    const is_game_over = game.status === 'won' || game.status === 'lost';
    const is_victory = game.status === 'won';

    // 6. Return complete game state
    return {
      game: {
        id: game.id,
        player_name: game.player_name,
        difficulty: game.difficulty,
        rows: game.rows,
        columns: game.columns,
        mines: game.mines,
        status: game.status,
        start_time: game.start_time,
        end_time: game.end_time,
        duration_seconds: game.duration_seconds,
        cells_revealed: game.cells_revealed,
        flags_placed: game.flags_placed,
        created_at: game.created_at,
        updated_at: game.updated_at,
      },
      grid,
      remaining_mines,
      is_game_over,
      is_victory,
    };
  } catch (error) {
    console.error('Failed to get game state:', error);
    throw error;
  }
}