import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GameStatusProps {
  isGameOver: boolean;
  isVictory: boolean;
  gameTime: number;
  onRestart: () => void;
  onNewGame: () => void;
}

export function GameStatus({ isGameOver, isVictory, gameTime, onRestart, onNewGame }: GameStatusProps) {
  if (!isGameOver) return null;

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`border-2 ${isVictory ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}`}>
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          <div className="text-6xl">
            {isVictory ? '🎉' : '💥'}
          </div>
          
          <div>
            <h2 className={`text-2xl font-bold ${isVictory ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {isVictory ? 'Congratulations!' : 'Game Over!'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {isVictory ? 'You successfully cleared the minefield!' : 'You hit a mine! Better luck next time.'}
            </p>
          </div>

          <div className="flex justify-center">
            <Badge variant={isVictory ? 'default' : 'destructive'} className="text-lg py-1 px-3">
              <span className="mr-2">⏱️</span>
              {formatTime(gameTime)}
            </Badge>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={onRestart} variant="outline">
              <span className="mr-1">🔄</span>
              Play Again
            </Button>
            <Button onClick={onNewGame}>
              <span className="mr-1">🆕</span>
              New Game
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}