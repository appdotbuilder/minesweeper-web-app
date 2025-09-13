interface MineCounterProps {
  remaining: number;
}

export function MineCounter({ remaining }: MineCounterProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900 rounded-md">
      <span className="text-lg">💣</span>
      <span className="font-mono text-lg font-bold text-red-700 dark:text-red-300">
        {remaining.toString().padStart(3, '0')}
      </span>
    </div>
  );
}