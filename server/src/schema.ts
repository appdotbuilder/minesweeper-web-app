import { z } from 'zod';

// Enums for game difficulty levels
export const gameDifficultySchema = z.enum(['beginner', 'intermediate', 'expert', 'custom']);
export type GameDifficulty = z.infer<typeof gameDifficultySchema>;

// Enums for game status
export const gameStatusSchema = z.enum(['in_progress', 'won', 'lost', 'paused']);
export type GameStatus = z.infer<typeof gameStatusSchema>;

// Enums for cell status
export const cellStatusSchema = z.enum(['hidden', 'revealed', 'flagged']);
export type CellStatus = z.infer<typeof cellStatusSchema>;

// Game configuration schema
export const gameConfigSchema = z.object({
  rows: z.number().int().min(5).max(50),
  columns: z.number().int().min(5).max(50),
  mines: z.number().int().min(1),
  difficulty: gameDifficultySchema,
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

// Cell schema for individual cells in the game grid
export const cellSchema = z.object({
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  is_mine: z.boolean(),
  is_revealed: z.boolean(),
  is_flagged: z.boolean(),
  adjacent_mines: z.number().int().min(0).max(8),
});
export type Cell = z.infer<typeof cellSchema>;

// Game schema with complete game state
export const gameSchema = z.object({
  id: z.number(),
  player_name: z.string().nullable(),
  difficulty: gameDifficultySchema,
  rows: z.number().int(),
  columns: z.number().int(),
  mines: z.number().int(),
  status: gameStatusSchema,
  start_time: z.coerce.date(),
  end_time: z.coerce.date().nullable(),
  duration_seconds: z.number().int().nullable(),
  cells_revealed: z.number().int().nonnegative(),
  flags_placed: z.number().int().nonnegative(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});
export type Game = z.infer<typeof gameSchema>;

// Game cell relationship schema (for storing individual cell states)
export const gameCellSchema = z.object({
  id: z.number(),
  game_id: z.number(),
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  is_mine: z.boolean(),
  is_revealed: z.boolean(),
  is_flagged: z.boolean(),
  adjacent_mines: z.number().int().min(0).max(8),
});
export type GameCell = z.infer<typeof gameCellSchema>;

// Input schemas for creating games
export const createGameInputSchema = z.object({
  player_name: z.string().nullable(),
  difficulty: gameDifficultySchema,
  rows: z.number().int().min(5).max(50).optional(),
  columns: z.number().int().min(5).max(50).optional(),
  mines: z.number().int().min(1).optional(),
});
export type CreateGameInput = z.infer<typeof createGameInputSchema>;

// Input schema for game moves (revealing cells, flagging)
export const gameMoveInputSchema = z.object({
  game_id: z.number(),
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  action: z.enum(['reveal', 'flag', 'unflag']),
});
export type GameMoveInput = z.infer<typeof gameMoveInputSchema>;

// Input schema for restarting a game
export const restartGameInputSchema = z.object({
  game_id: z.number(),
});
export type RestartGameInput = z.infer<typeof restartGameInputSchema>;

// Response schema for game state with grid
export const gameStateResponseSchema = z.object({
  game: gameSchema,
  grid: z.array(z.array(cellSchema)),
  remaining_mines: z.number().int(),
  is_game_over: z.boolean(),
  is_victory: z.boolean(),
});
export type GameStateResponse = z.infer<typeof gameStateResponseSchema>;

// High scores/leaderboard schema
export const highScoreSchema = z.object({
  id: z.number(),
  player_name: z.string(),
  difficulty: gameDifficultySchema,
  duration_seconds: z.number().int(),
  created_at: z.coerce.date(),
});
export type HighScore = z.infer<typeof highScoreSchema>;

// Input schema for getting leaderboard
export const getLeaderboardInputSchema = z.object({
  difficulty: gameDifficultySchema.optional(),
  limit: z.number().int().min(1).max(100).default(10),
});
export type GetLeaderboardInput = z.infer<typeof getLeaderboardInputSchema>;