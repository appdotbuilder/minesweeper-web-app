interface TimerProps {
  seconds: number;
  isActive: boolean;
}

export function Timer({ seconds, isActive }: TimerProps) {
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-md">
      <span className="text-lg">{isActive ? '⏱️' : '⏸️'}</span>
      <span className="font-mono text-lg font-bold text-blue-700 dark:text-blue-300">
        {formatTime(seconds)}
      </span>
    </div>
  );
}