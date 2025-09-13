import { cn } from '@/lib/utils';
import type { Cell } from '../../../server/src/schema';

interface GameBoardProps {
  grid: Cell[][];
  onCellClick: (row: number, column: number, action: 'reveal' | 'flag' | 'unflag') => void;
  isGameOver: boolean;
  isVictory: boolean;
}

export function GameBoard({ grid, onCellClick, isGameOver, isVictory }: GameBoardProps) {
  const handleCellClick = (row: number, column: number, event: React.MouseEvent) => {
    event.preventDefault();
    
    const cell = grid[row][column];
    if (cell.is_revealed) return;

    if (event.button === 0) {
      // Left click - reveal
      if (!cell.is_flagged) {
        onCellClick(row, column, 'reveal');
      }
    } else if (event.button === 2) {
      // Right click - flag/unflag
      onCellClick(row, column, cell.is_flagged ? 'unflag' : 'flag');
    }
  };

  const getCellContent = (cell: Cell) => {
    if (cell.is_flagged && !isGameOver) {
      return '🚩';
    }
    
    if (!cell.is_revealed && !isGameOver) {
      return '';
    }

    // Game over or cell revealed
    if (cell.is_mine) {
      if (isGameOver && !isVictory) {
        return '💣';
      } else if (isVictory || cell.is_flagged) {
        return '🚩';
      }
      return '💣';
    }

    if (cell.adjacent_mines > 0) {
      return cell.adjacent_mines.toString();
    }

    return '';
  };

  const getCellClassName = (cell: Cell) => {
    const baseClasses = "w-8 h-8 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer transition-all select-none";
    
    if (cell.is_revealed || isGameOver) {
      if (cell.is_mine) {
        if (isGameOver && !isVictory && !cell.is_flagged) {
          return cn(baseClasses, "bg-red-500 text-white animate-pulse");
        }
        return cn(baseClasses, "bg-red-200 dark:bg-red-900");
      }
      
      const numberColors = {
        1: "text-blue-600",
        2: "text-green-600", 
        3: "text-red-600",
        4: "text-purple-600",
        5: "text-yellow-600",
        6: "text-pink-600",
        7: "text-black dark:text-white",
        8: "text-gray-600",
      };
      
      return cn(
        baseClasses,
        "bg-slate-100 dark:bg-slate-700 cursor-default",
        cell.adjacent_mines > 0 && numberColors[cell.adjacent_mines as keyof typeof numberColors]
      );
    }
    
    if (cell.is_flagged) {
      return cn(baseClasses, "bg-yellow-200 dark:bg-yellow-800");
    }
    
    return cn(
      baseClasses,
      "bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500"
    );
  };

  const columns = grid[0]?.length || 0;
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    maxWidth: Math.min(columns * 32 + (columns + 1) * 1, 800) + 'px'
  };

  return (
    <div 
      className="inline-grid gap-px bg-slate-400 dark:bg-slate-500 p-1 rounded-lg shadow-lg"
      style={gridStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <button
            key={`${rowIndex}-${colIndex}`}
            className={getCellClassName(cell)}
            onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
            onMouseDown={(e) => {
              if (e.button === 2) {
                e.preventDefault();
                handleCellClick(rowIndex, colIndex, e);
              }
            }}
            disabled={isGameOver && !isVictory}
          >
            {getCellContent(cell)}
          </button>
        ))
      )}
    </div>
  );
}