import { db } from '../db';
import { gamesTable, gameCellsTable } from '../db/schema';
import { type CreateGameInput, type GameStateResponse } from '../schema';

export async function createGame(input: CreateGameInput): Promise<GameStateResponse> {
  try {
    // Define default configurations for each difficulty level
    const defaultConfigs = {
      beginner: { rows: 8, columns: 8, mines: 10 },
      intermediate: { rows: 16, columns: 16, mines: 40 },
      expert: { rows: 16, columns: 30, mines: 99 },
      custom: { 
        rows: input.rows || 8, 
        columns: input.columns || 8, 
        mines: input.mines || 10 
      }
    };
    
    const config = defaultConfigs[input.difficulty];
    
    // Validate that mines don't exceed total cells
    const totalCells = config.rows * config.columns;
    if (config.mines >= totalCells) {
      throw new Error(`Too many mines: ${config.mines} mines for ${totalCells} cells`);
    }

    // Create the game record
    const gameResult = await db.insert(gamesTable)
      .values({
        player_name: input.player_name,
        difficulty: input.difficulty,
        rows: config.rows,
        columns: config.columns,
        mines: config.mines,
        status: 'in_progress',
        cells_revealed: 0,
        flags_placed: 0,
      })
      .returning()
      .execute();

    const game = gameResult[0];

    // Generate minefield
    const grid = generateMinefield(config.rows, config.columns, config.mines);

    // Calculate adjacent mine counts
    calculateAdjacentMines(grid, config.rows, config.columns);

    // Store all game cells in the database
    const cellInserts = [];
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.columns; col++) {
        const cell = grid[row][col];
        cellInserts.push({
          game_id: game.id,
          row: cell.row,
          column: cell.column,
          is_mine: cell.is_mine,
          is_revealed: cell.is_revealed,
          is_flagged: cell.is_flagged,
          adjacent_mines: cell.adjacent_mines,
        });
      }
    }

    await db.insert(gameCellsTable)
      .values(cellInserts)
      .execute();

    // Return the game state with client-safe grid (hide mine information)
    const clientGrid = grid.map(row =>
      row.map(cell => ({
        row: cell.row,
        column: cell.column,
        is_mine: false, // Always hide mine information from client
        is_revealed: cell.is_revealed,
        is_flagged: cell.is_flagged,
        adjacent_mines: cell.is_revealed ? cell.adjacent_mines : 0, // Only show adjacent mines if revealed
      }))
    );

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
      grid: clientGrid,
      remaining_mines: config.mines,
      is_game_over: false,
      is_victory: false,
    };
  } catch (error) {
    console.error('Game creation failed:', error);
    throw error;
  }
}

// Cell interface for internal game logic
interface GameCell {
  row: number;
  column: number;
  is_mine: boolean;
  is_revealed: boolean;
  is_flagged: boolean;
  adjacent_mines: number;
}

// Helper function to generate minefield with randomly placed mines
function generateMinefield(rows: number, columns: number, mineCount: number): GameCell[][] {
  // Initialize empty grid
  const grid: GameCell[][] = [];
  for (let row = 0; row < rows; row++) {
    grid[row] = [];
    for (let col = 0; col < columns; col++) {
      grid[row][col] = {
        row,
        column: col,
        is_mine: false,
        is_revealed: false,
        is_flagged: false,
        adjacent_mines: 0,
      };
    }
  }

  // Place mines randomly
  let minesPlaced = 0;
  while (minesPlaced < mineCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * columns);
    
    if (!grid[randomRow][randomCol].is_mine) {
      grid[randomRow][randomCol].is_mine = true;
      minesPlaced++;
    }
  }

  return grid;
}

// Helper function to calculate adjacent mine counts for each cell
function calculateAdjacentMines(grid: GameCell[][], rows: number, columns: number): void {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (!grid[row][col].is_mine) {
        let adjacentMines = 0;
        
        for (const [deltaRow, deltaCol] of directions) {
          const newRow = row + deltaRow;
          const newCol = col + deltaCol;
          
          if (
            newRow >= 0 && newRow < rows &&
            newCol >= 0 && newCol < columns &&
            grid[newRow][newCol].is_mine
          ) {
            adjacentMines++;
          }
        }
        
        grid[row][col].adjacent_mines = adjacentMines;
      }
    }
  }
}