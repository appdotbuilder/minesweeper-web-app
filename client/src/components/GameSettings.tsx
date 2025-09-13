import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { trpc } from '@/utils/trpc';
import type { GameDifficulty, CreateGameInput } from '../../../server/src/schema';

interface GameSettingsProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onStartGame: (config: CreateGameInput) => void;
  isLoading: boolean;
}

export function GameSettings({ playerName, onPlayerNameChange, onStartGame, isLoading }: GameSettingsProps) {
  const [difficulty, setDifficulty] = useState<GameDifficulty>('beginner');
  const [customRows, setCustomRows] = useState<number>(8);
  const [customColumns, setCustomColumns] = useState<number>(8);
  const [customMines, setCustomMines] = useState<number>(10);
  const [difficultyPresets, setDifficultyPresets] = useState<Record<string, { rows: number; columns: number; mines: number }> | null>(null);

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const presets = await trpc.getDifficultyPresets.query();
        setDifficultyPresets(presets);
      } catch (error) {
        console.error('Failed to load difficulty presets:', error);
      }
    };
    loadPresets();
  }, []);

  const handleDifficultyChange = (value: GameDifficulty) => {
    setDifficulty(value);
    if (value !== 'custom' && difficultyPresets) {
      const preset = difficultyPresets[value];
      setCustomRows(preset.rows);
      setCustomColumns(preset.columns);
      setCustomMines(preset.mines);
    }
  };

  const handleStartGame = () => {
    const config: CreateGameInput = {
      player_name: playerName || null,
      difficulty,
    };

    if (difficulty === 'custom') {
      config.rows = customRows;
      config.columns = customColumns;
      config.mines = customMines;
    }

    onStartGame(config);
  };

  const maxMines = Math.floor((customRows * customColumns) * 0.8); // Max 80% of cells can be mines

  return (
    <div className="space-y-6">
      {/* Player Name */}
      <div className="space-y-2">
        <Label htmlFor="player-name">Player Name (Optional)</Label>
        <Input
          id="player-name"
          placeholder="Enter your name..."
          value={playerName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPlayerNameChange(e.target.value)}
          maxLength={50}
        />
      </div>

      {/* Difficulty Selection */}
      <div className="space-y-4">
        <Label>Difficulty Level</Label>
        <Select value={difficulty} onValueChange={handleDifficultyChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">
              <div className="flex items-center gap-2">
                <span>🟢</span>
                <div>
                  <div className="font-medium">Beginner</div>
                  <div className="text-sm text-muted-foreground">8×8, 10 mines</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="intermediate">
              <div className="flex items-center gap-2">
                <span>🟡</span>
                <div>
                  <div className="font-medium">Intermediate</div>
                  <div className="text-sm text-muted-foreground">16×16, 40 mines</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="expert">
              <div className="flex items-center gap-2">
                <span>🔴</span>
                <div>
                  <div className="font-medium">Expert</div>
                  <div className="text-sm text-muted-foreground">30×16, 99 mines</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="custom">
              <div className="flex items-center gap-2">
                <span>⚙️</span>
                <div>
                  <div className="font-medium">Custom</div>
                  <div className="text-sm text-muted-foreground">Set your own parameters</div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Settings */}
      {difficulty === 'custom' && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-rows">Rows</Label>
                <Input
                  id="custom-rows"
                  type="number"
                  min="5"
                  max="50"
                  value={customRows}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setCustomRows(Math.max(5, Math.min(50, parseInt(e.target.value) || 5)))
                  }
                />
                <div className="text-xs text-muted-foreground">5-50</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-columns">Columns</Label>
                <Input
                  id="custom-columns"
                  type="number"
                  min="5"
                  max="50"
                  value={customColumns}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setCustomColumns(Math.max(5, Math.min(50, parseInt(e.target.value) || 5)))
                  }
                />
                <div className="text-xs text-muted-foreground">5-50</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-mines">Mines</Label>
                <Input
                  id="custom-mines"
                  type="number"
                  min="1"
                  max={maxMines}
                  value={customMines}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setCustomMines(Math.max(1, Math.min(maxMines, parseInt(e.target.value) || 1)))
                  }
                />
                <div className="text-xs text-muted-foreground">1-{maxMines}</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <div className="text-sm">
                <strong>Preview:</strong> {customRows}×{customColumns} grid with {customMines} mines
                <br />
                <span className="text-muted-foreground">
                  Mine density: {((customMines / (customRows * customColumns)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Difficulty Preview Cards */}
      {difficulty !== 'custom' && difficultyPresets && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(difficultyPresets).map(([key, preset]) => (
            <Card 
              key={key}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                difficulty === key ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950" : ""
              )}
              onClick={() => handleDifficultyChange(key as GameDifficulty)}
            >
              <CardContent className="p-4 text-center">
                <div className="text-lg mb-2">
                  {key === 'beginner' && '🟢'}
                  {key === 'intermediate' && '🟡'}
                  {key === 'expert' && '🔴'}
                </div>
                <div className="font-medium capitalize">{key}</div>
                <div className="text-sm text-muted-foreground">
                  {preset.rows}×{preset.columns}
                </div>
                <div className="text-sm text-muted-foreground">
                  {preset.mines} mines
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Start Game Button */}
      <Button 
        onClick={handleStartGame}
        disabled={isLoading}
        size="lg"
        className="w-full"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Creating Game...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>🚀</span>
            Start Game
          </div>
        )}
      </Button>
    </div>
  );
}

