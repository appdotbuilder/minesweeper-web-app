import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createGameInputSchema,
  gameMoveInputSchema,
  restartGameInputSchema,
  getLeaderboardInputSchema,
} from './schema';

// Import handlers
import { createGame } from './handlers/create_game';
import { makeMove } from './handlers/make_move';
import { getGameState } from './handlers/get_game_state';
import { restartGame } from './handlers/restart_game';
import { getLeaderboard } from './handlers/get_leaderboard';
import { saveHighScore } from './handlers/save_high_score';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Create a new Minesweeper game
  createGame: publicProcedure
    .input(createGameInputSchema)
    .mutation(({ input }) => createGame(input)),

  // Make a move in an existing game (reveal, flag, unflag)
  makeMove: publicProcedure
    .input(gameMoveInputSchema)
    .mutation(({ input }) => makeMove(input)),

  // Get current state of a game
  getGameState: publicProcedure
    .input(z.object({ gameId: z.number() }))
    .query(({ input }) => getGameState(input.gameId)),

  // Restart an existing game with same configuration
  restartGame: publicProcedure
    .input(restartGameInputSchema)
    .mutation(({ input }) => restartGame(input)),

  // Get leaderboard/high scores
  getLeaderboard: publicProcedure
    .input(getLeaderboardInputSchema)
    .query(({ input }) => getLeaderboard(input)),

  // Save a high score after winning a game
  saveHighScore: publicProcedure
    .input(z.object({ 
      game_id: z.number(), 
      player_name: z.string() 
    }))
    .mutation(({ input }) => saveHighScore(input)),

  // Get game difficulty presets for UI
  getDifficultyPresets: publicProcedure.query(() => {
    return {
      beginner: { rows: 8, columns: 8, mines: 10 },
      intermediate: { rows: 16, columns: 16, mines: 40 },
      expert: { rows: 16, columns: 30, mines: 99 },
    };
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Minesweeper TRPC server listening at port: ${port}`);
}

start();