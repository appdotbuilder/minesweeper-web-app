import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { GameBoard } from '@/components/GameBoard';
import { GameSettings } from '@/components/GameSettings';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Timer } from '@/components/Timer';
import { MineCounter } from '@/components/MineCounter';
import { GameStatus } from '@/components/GameStatus';
import type { GameStateResponse, CreateGameInput } from '../../server/src/schema';

function App() {
  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [showSettings, setShowSettings] = useState(true);

  // Game timer state
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [gameTime, setGameTime] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Update timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerActive && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        setGameTime(Math.floor((now.getTime() - startTime.getTime()) / 1000));
      }, 1000);
    } else if (!isTimerActive) {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, startTime]);

  const createNewGame = useCallback(async (input: CreateGameInput) => {
    setIsLoading(true);
    try {
      const response = await trpc.createGame.mutate({
        ...input,
        player_name: playerName || null,
      });
      setGameState(response);
      setCurrentGameId(response.game.id);
      setStartTime(new Date());
      setGameTime(0);
      setIsTimerActive(true);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to create game:', error);
    } finally {
      setIsLoading(false);
    }
  }, [playerName]);

  const makeMove = useCallback(async (row: number, column: number, action: 'reveal' | 'flag' | 'unflag') => {
    if (!currentGameId || !gameState || gameState.is_game_over) return;

    try {
      const response = await trpc.makeMove.mutate({
        game_id: currentGameId,
        row,
        column,
        action,
      });
      setGameState(response);

      // Stop timer if game is over
      if (response.is_game_over) {
        setIsTimerActive(false);
      }
    } catch (error) {
      console.error('Failed to make move:', error);
    }
  }, [currentGameId, gameState]);

  const restartGame = useCallback(async () => {
    if (!currentGameId) return;

    setIsLoading(true);
    try {
      const response = await trpc.restartGame.mutate({
        game_id: currentGameId,
      });
      setGameState(response);
      setStartTime(new Date());
      setGameTime(0);
      setIsTimerActive(true);
    } catch (error) {
      console.error('Failed to restart game:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentGameId]);

  const startNewGame = useCallback(() => {
    setGameState(null);
    setCurrentGameId(null);
    setStartTime(null);
    setGameTime(0);
    setIsTimerActive(false);
    setShowSettings(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 transition-colors">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💣</div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Minesweeper
            </h1>
          </div>
          <ThemeToggle />
        </div>

        {/* Game Settings */}
        {showSettings && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚙️</span>
                Game Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GameSettings
                playerName={playerName}
                onPlayerNameChange={setPlayerName}
                onStartGame={createNewGame}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Game Interface */}
        {gameState && (
          <div className="space-y-6">
            {/* Game Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/70 dark:bg-slate-800/70 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    <span className="mr-1">🎯</span>
                    {gameState.game.difficulty.charAt(0).toUpperCase() + gameState.game.difficulty.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {gameState.game.rows}×{gameState.game.columns}
                  </span>
                </div>
                {gameState.game.player_name && (
                  <Badge variant="secondary">
                    <span className="mr-1">👤</span>
                    {gameState.game.player_name}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4">
                <MineCounter remaining={gameState.remaining_mines} />
                <Timer seconds={gameTime} isActive={isTimerActive} />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={restartGame}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                >
                  <span className="mr-1">🔄</span>
                  Restart
                </Button>
                <Button
                  onClick={startNewGame}
                  size="sm"
                  variant="outline"
                >
                  <span className="mr-1">🆕</span>
                  New Game
                </Button>
              </div>
            </div>

            {/* Game Status */}
            <GameStatus
              isGameOver={gameState.is_game_over}
              isVictory={gameState.is_victory}
              gameTime={gameTime}
              onRestart={restartGame}
              onNewGame={startNewGame}
            />

            {/* Game Board */}
            <div className="flex justify-center">
              <GameBoard
                grid={gameState.grid}
                onCellClick={makeMove}
                isGameOver={gameState.is_game_over}
                isVictory={gameState.is_victory}
              />
            </div>

            {/* Game Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Game Statistics</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {gameState.game.cells_revealed}
                    </div>
                    <div className="text-muted-foreground">Cells Revealed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {gameState.game.flags_placed}
                    </div>
                    <div className="text-muted-foreground">Flags Placed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {gameState.game.mines}
                    </div>
                    <div className="text-muted-foreground">Total Mines</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {gameState.game.rows * gameState.game.columns - gameState.game.mines}
                    </div>
                    <div className="text-muted-foreground">Safe Cells</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructions */}
        {!gameState && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>❓</span>
                How to Play
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">🖱️ Controls</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• <strong>Left click</strong>: Reveal a cell</li>
                    <li>• <strong>Right click</strong>: Place/remove flag</li>
                    <li>• <strong>Numbers</strong>: Adjacent mine count</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🎯 Objective</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Reveal all safe cells</li>
                    <li>• Avoid clicking mines</li>
                    <li>• Use flags to mark mines</li>
                    <li>• Beat your best time!</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;