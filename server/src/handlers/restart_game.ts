import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { type RestartGameInput, type GameStateResponse, type Cell } from '../schema';
import { eq } from 'drizzle-orm';

// Helper function to generate random mine positions
function generateMinePositions(rows: number, columns: number, totalMines: number): Set<string> {
  const minePositions = new Set<string>();
  const totalCells = rows * columns;
  
  if (totalMines >= totalCells) {
    throw new Error('Too many mines for the grid size');
  }
  
  while (minePositions.size < totalMines) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * columns);
    const position = `${row},${col}`;
    minePositions.add(position);
  }
  
  return minePositions;
}

// Helper function to calculate adjacent mine count
function calculateAdjacentMines(row: number, col: number, minePositions: Set<string>): number {
  let count = 0;
  
  // Check all 8 adjacent cells
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r === row && c === col) continue; // Skip the cell itself
      if (minePositions.has(`${r},${c}`)) {
        count++;
      }
    }
  }
  
  return count;
}

export async function restartGame(input: RestartGameInput): Promise<GameStateResponse> {
  try {
    // 1. Fetch the existing game to get its configuration
    const existingGames = await db.select()
      .from(gamesTable)
      .where(eq(gamesTable.id, input.game_id))
      .execute();
    
    if (existingGames.length === 0) {
      throw new Error(`Game with id ${input.game_id} not found`);
    }
    
    const existingGame = existingGames[0];
    
    // 2. Create a new game with the same configuration
    const newGameResult = await db.insert(gamesTable)
      .values({
        player_name: existingGame.player_name,
        difficulty: existingGame.difficulty,
        rows: existingGame.rows,
        columns: existingGame.columns,
        mines: existingGame.mines,
        status: 'in_progress',
        cells_revealed: 0,
        flags_placed: 0,
      })
      .returning()
      .execute();
    
    const newGame = newGameResult[0];
    
    // 3. Generate a new minefield with randomly placed mines
    const minePositions = generateMinePositions(newGame.rows, newGame.columns, newGame.mines);
    
    // 4. Create grid and calculate adjacent mine counts
    const cellsData = [];
    for (let row = 0; row < newGame.rows; row++) {
      for (let col = 0; col < newGame.columns; col++) {
        const isMine = minePositions.has(`${row},${col}`);
        const adjacentMines = isMine ? 0 : calculateAdjacentMines(row, col, minePositions);
        
        cellsData.push({
          game_id: newGame.id,
          row,
          column: col,
          is_mine: isMine,
          is_revealed: false,
          is_flagged: false,
          adjacent_mines: adjacentMines,
        });
      }
    }
    
    // 5. Store the new game cells in the database
    await db.insert(gameCellsTable)
      .values(cellsData)
      .execute();
    
    // 6. Build the grid response (hide mine information from client)
    const grid: Cell[][] = [];
    for (let row = 0; row < newGame.rows; row++) {
      grid[row] = [];
      for (let col = 0; col < newGame.columns; col++) {
        const cellData = cellsData.find(cell => cell.row === row && cell.column === col);
        if (!cellData) {
          throw new Error(`Cell data not found for position ${row},${col}`);
        }
        
        grid[row][col] = {
          row,
          column: col,
          is_mine: false, // Hidden from client
          is_revealed: cellData.is_revealed,
          is_flagged: cellData.is_flagged,
          adjacent_mines: 0, // Hidden from client until revealed
        };
      }
    }
    
    // 7. Return the new game state
    return {
      game: {
        id: newGame.id,
        player_name: newGame.player_name,
        difficulty: newGame.difficulty,
        rows: newGame.rows,
        columns: newGame.columns,
        mines: newGame.mines,
        status: newGame.status,
        start_time: newGame.start_time,
        end_time: newGame.end_time,
        duration_seconds: newGame.duration_seconds,
        cells_revealed: newGame.cells_revealed,
        flags_placed: newGame.flags_placed,
        created_at: newGame.created_at,
        updated_at: newGame.updated_at,
      },
      grid,
      remaining_mines: newGame.mines,
      is_game_over: false,
      is_victory: false,
    };
  } catch (error) {
    console.error('Game restart failed:', error);
    throw error;
  }
}