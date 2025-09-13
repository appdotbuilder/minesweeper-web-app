import { serial, text, pgTable, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for PostgreSQL
export const gameDifficultyEnum = pgEnum('game_difficulty', ['beginner', 'intermediate', 'expert', 'custom']);
export const gameStatusEnum = pgEnum('game_status', ['in_progress', 'won', 'lost', 'paused']);

// Games table - stores main game information
export const gamesTable = pgTable('games', {
  id: serial('id').primaryKey(),
  player_name: text('player_name'), // Nullable - anonymous games allowed
  difficulty: gameDifficultyEnum('difficulty').notNull(),
  rows: integer('rows').notNull(),
  columns: integer('columns').notNull(),
  mines: integer('mines').notNull(),
  status: gameStatusEnum('status').notNull().default('in_progress'),
  start_time: timestamp('start_time').defaultNow().notNull(),
  end_time: timestamp('end_time'), // Nullable - only set when game ends
  duration_seconds: integer('duration_seconds'), // Nullable - calculated when game ends
  cells_revealed: integer('cells_revealed').notNull().default(0),
  flags_placed: integer('flags_placed').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Game cells table - stores individual cell states for each game
export const gameCellsTable = pgTable('game_cells', {
  id: serial('id').primaryKey(),
  game_id: integer('game_id').notNull(),
  row: integer('row').notNull(),
  column: integer('column').notNull(),
  is_mine: boolean('is_mine').notNull().default(false),
  is_revealed: boolean('is_revealed').notNull().default(false),
  is_flagged: boolean('is_flagged').notNull().default(false),
  adjacent_mines: integer('adjacent_mines').notNull().default(0),
});

// High scores table - for leaderboard functionality
export const highScoresTable = pgTable('high_scores', {
  id: serial('id').primaryKey(),
  player_name: text('player_name').notNull(),
  difficulty: gameDifficultyEnum('difficulty').notNull(),
  duration_seconds: integer('duration_seconds').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const gamesRelations = relations(gamesTable, ({ many }) => ({
  cells: many(gameCellsTable),
}));

export const gameCellsRelations = relations(gameCellsTable, ({ one }) => ({
  game: one(gamesTable, {
    fields: [gameCellsTable.game_id],
    references: [gamesTable.id],
  }),
}));

// TypeScript types inferred from tables
export type Game = typeof gamesTable.$inferSelect;
export type NewGame = typeof gamesTable.$inferInsert;
export type GameCell = typeof gameCellsTable.$inferSelect;
export type NewGameCell = typeof gameCellsTable.$inferInsert;
export type HighScore = typeof highScoresTable.$inferSelect;
export type NewHighScore = typeof highScoresTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  games: gamesTable,
  gameCells: gameCellsTable,
  highScores: highScoresTable,
};