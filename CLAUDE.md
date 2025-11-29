# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time multiplayer Top Trumps game backend built with NestJS, TypeORM, SQLite, and Socket.IO. Follows **official Top Trumps rules**: players compare card attributes, the winner collects all played cards, and victory goes to whoever collects all cards in the game.

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
   - Tracks player cards and ready status
   - Handles socket connections for real-time updates

### Key Game Flow (Official Top Trumps Rules)

The game logic follows this critical sequence (src/game/game.service.ts):

1. **Game Creation**: A player creates a game (supports 2-6 players)
2. **Player Join**: Additional players join via gameId
3. **Ready State**: All players mark themselves ready
4. **Auto-Start**: When all ready, system distributes cards EQUITABLY with limits:
   - 2 players: 12 cards each (24 total)
   - 3 players: 8 cards each (24 total)
   - 4 players: 6 cards each (24 total)
   - 5 players: 5 cards each (25 total - uses full deck)
   - 6+ players: 4 cards each
   - Remaining cards stay out of play (game.service.ts:85-134)
5. **Round Play**: Current player selects card + attribute; other players play random cards (game.service.ts:230-448)
6. **Card Comparison**:
   - Winner (highest value) collects ALL played cards
   - In case of tie: cards go to "stake" pile, same player chooses next attribute
   - Winner of next round gets stake + new cards
7. **Turn System**: Winner of each round chooses the next attribute (not rotation)
8. **Game End**: When only one player has cards remaining, or one player has collected all cards
9. **Victory**: The last player with cards wins

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
- `roundResult`: Round outcome with winner and cards (normal round)
- `roundTied`: Round ended in a tie, cards added to stake
- `gameFinished`: Game ended with final winner (includes reason: 'collected_all_cards' or 'last_standing')
- `playerDisconnected`: Player left or disconnected
- `error`: Operation failure

All game events are broadcast to room `game-${gameId}` for real-time sync.

### Database Layer

**TypeORM with SQLite** (better-sqlite3 driver)
- **Auto-sync enabled** (`synchronize: true`) - ONLY for development
- Entities use decorators for schema definition
- Relations: Game → Players (OneToMany), Game → GameRounds (OneToMany)

**Critical Entities:**
- `Game`: Tracks status, winnerId, currentTurnPlayerId, stakeCards (cards in tie)
- `Player`: Stores cards as number array, socketId, isReady
- `GameRound`: Historical record of each round played (winnerId=0 indicates tie)
- `Card`: Predefined cards with 5 numeric attributes (0-100) + rarity

### State Management

Player cards are stored as JSON arrays of card IDs in Player entity. Card transfers work as follows:

**Normal Round (Winner Determined):**
1. Card IDs are validated against player's card array
2. Winner receives ALL played cards + any staked cards
3. Losers lose only their played card
4. Winner's array updated with new cards (game.service.ts:369-378)
5. Turn passes to winner (game.service.ts:391-396)

**Tie Round:**
1. ALL played cards go to game's stakeCards array
2. Cards removed from all players
3. Turn remains with same player (game.service.ts:292-312)
4. Next winner gets stake + new cards

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

- **Official Rules**: Implements authentic Top Trumps gameplay - winner collects cards, no points system
- **Opponent AI**: Non-active players play random cards (game.service.ts:270-273) - can be enhanced
- **Turn System**: First player to join gets first turn; then winner of each round chooses next attribute
- **Win Condition**: Last player with cards, or player who collects all cards in the game
- **Tie Handling**: Multiple players with same value → cards go to stake, same player chooses again (game.service.ts:292-364)
- **Socket Cleanup**: Disconnected players are marked as not ready; if <2 players remain, game ends
- **Card Distribution**: Equitable distribution with limits based on player count (game.service.ts:85-134)
  - 2 players: 12 cards each, 3 players: 8 each, 4 players: 6 each, 5 players: 5 each, 6+: 4 each
  - All players receive EXACTLY the same number of cards (no +1 for some players)
  - Remaining cards stay out of play to ensure fairness
- **Stake System**: Tied cards accumulate in game.stakeCards, won by next round's winner
- **TypeScript Config**: Uses `nodenext` module resolution, decorators enabled
- **Attribute Validation**: Five valid attributes - power, speed, intelligence, defense, agility
