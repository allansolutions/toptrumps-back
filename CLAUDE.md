# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time multiplayer Top Trumps game backend built with NestJS, TypeORM, SQLite, and Socket.IO. The game supports 2-player matches where players compare card attributes in turn-based rounds.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Run development server (with hot reload)
pnpm run start:dev

# Seed database with 25 predefined cards
pnpm run seed

# Build for production
pnpm run build

# Run production build
pnpm run start:prod
```

### Testing
```bash
# Run unit tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run e2e tests
pnpm run test:e2e

# Generate coverage report
pnpm run test:cov

# Debug tests
pnpm run test:debug
```

### Code Quality
```bash
# Lint and auto-fix
pnpm run lint

# Format code with Prettier
pnpm run format
```

## Architecture Overview

### Module Structure

The application follows NestJS modular architecture with three core modules:

1. **CardsModule** (`src/cards/`)
   - Manages card entities (25 predefined cards with attributes: power, speed, intelligence, defense, agility)
   - Provides REST endpoints for CRUD operations
   - Handles random card selection for game distribution

2. **GameModule** (`src/game/`)
   - Controls game lifecycle (waiting → in_progress → finished)
   - Manages game rounds and turn logic
   - Implements WebSocket gateway for real-time communication
   - Coordinates between players and cards services

3. **PlayersModule** (`src/players/`)
   - Manages player entities and their state
   - Tracks player cards, scores, and ready status
   - Handles socket connections for real-time updates

### Key Game Flow

The game logic follows this critical sequence (src/game/game.service.ts):

1. **Game Creation**: A player creates a game (max 2 players)
2. **Player Join**: Second player joins via gameId
3. **Ready State**: Both players mark themselves ready
4. **Auto-Start**: When all ready, system distributes 10 random cards to each player (game.service.ts:57-80)
5. **Round Play**: Current player selects card + attribute; opponent plays random card (game.service.ts:83-165)
6. **Card Comparison**: Attributes are compared, winner gets +1 score, both cards discarded
7. **Game End**: When either player runs out of cards, highest score wins

### WebSocket Events Architecture

The GameGateway (src/game/game.gateway.ts) implements bidirectional communication:

**Client → Server Events:**
- `createGame`: Initialize new game
- `joinGame`: Join existing game with nickname
- `playerReady`: Mark player as ready to start
- `playCard`: Submit card and attribute selection
- `getGameState`: Request current game state
- `leaveGame`: Exit game session

**Server → Client Events:**
- `gameCreated`: Game initialized with ID
- `playerJoined`: Player successfully joined
- `playerReady`: Ready status update
- `gameStarted`: Game begins with distributed cards
- `roundResult`: Round outcome with winner and cards
- `gameFinished`: Game ended with final winner
- `playerDisconnected`: Player left or disconnected
- `error`: Operation failure

All game events are broadcast to room `game-${gameId}` for real-time sync.

### Database Layer

**TypeORM with SQLite** (better-sqlite3 driver)
- **Auto-sync enabled** (`synchronize: true`) - ONLY for development
- Entities use decorators for schema definition
- Relations: Game → Players (OneToMany), Game → GameRounds (OneToMany)

**Critical Entities:**
- `Game`: Tracks status, winnerId, currentTurnPlayerId
- `Player`: Stores cards as number array, score, socketId, isReady
- `GameRound`: Historical record of each round played
- `Card`: Predefined cards with 5 numeric attributes (0-100) + rarity

### State Management

Player cards are stored as JSON arrays of card IDs in Player entity. When cards are played:
1. Card IDs are validated against player's card array
2. After round, both cards are removed from respective arrays
3. Arrays are persisted back to database (game.service.ts:146-149)

Game state transitions are enforced:
- Only WAITING games accept joins
- Only IN_PROGRESS games accept card plays
- Status changes trigger WebSocket broadcasts

## Configuration

Environment variables (.env):
- `PORT`: Server port (default: 3000)
- `CORS_ORIGIN`: Frontend URL (default: http://localhost:5173)
- `DB_SYNCHRONIZE`: Auto-sync schema (true for dev only)
- `DB_LOGGING`: Enable TypeORM query logging

## Important Implementation Notes

- **Opponent AI**: Currently plays random cards (game.service.ts:108-109) - can be enhanced
- **Turn System**: First player to join gets first turn; alternates after each round
- **Win Condition**: Player with most points when either runs out of cards
- **Socket Cleanup**: Disconnected players are marked as not ready; game continues if opponent remains
- **Card Distribution**: 10 cards per player from random selection of available cards (game.service.ts:66-76)
- **TypeScript Config**: Uses `nodenext` module resolution, decorators enabled
- **Attribute Validation**: Five valid attributes - power, speed, intelligence, defense, agility
