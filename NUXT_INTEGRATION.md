# Nuxt 3 Integration Guide - Top Trumps Multiplayer

Guía completa para integrar el backend de Top Trumps con **Nuxt 3** usando Socket.IO, Composables, y las mejores prácticas de Vue 3.

---

## 📦 Instalación

```bash
# Instalar Socket.IO client
pnpm add socket.io-client

# Tipos de TypeScript (opcional pero recomendado)
pnpm add -D @types/socket.io-client
```

---

## 🏗️ Estructura del Proyecto Nuxt

```
nuxt-toptrumps/
├── composables/
│   ├── useSocket.ts          # Socket.IO connection
│   ├── useGame.ts             # Game state management
│   └── useCards.ts            # Cards data fetching
├── types/
│   └── game.ts                # TypeScript interfaces
├── pages/
│   ├── index.vue              # Home / Create game
│   ├── lobby/[id].vue         # Waiting room
│   └── game/[id].vue          # Game board
├── components/
│   ├── Card.vue               # Card component
│   ├── PlayerList.vue         # Players sidebar
│   ├── RoundResult.vue        # Round result modal
│   └── GameBoard.vue          # Main game UI
└── nuxt.config.ts
```

---

## 🔧 Configuración Nuxt

### `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      backendUrl: process.env.NUXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
    },
  },

  // Importante para Socket.IO
  vite: {
    optimizeDeps: {
      exclude: ['socket.io-client'],
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },
});
```

### `.env`

```bash
NUXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

---

## 📝 TypeScript Types

### `types/game.ts`

```typescript
export interface Card {
  id: number;
  name: string;
  power: number;
  speed: number;
  intelligence: number;
  defense: number;
  agility: number;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image?: string;
  createdAt?: Date;
}

export type Attribute = 'power' | 'speed' | 'intelligence' | 'defense' | 'agility';

export interface Player {
  id: number;
  nickname: string;
  socketId: string;
  cards: number[];
  score: number;
  isReady: boolean;
  gameId: number;
  joinedAt: Date;
}

export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

export interface Game {
  id: number;
  status: GameStatus;
  winnerId?: number;
  maxPlayers: number;
  currentTurnPlayerId?: number;
  currentRound: number;
  players: Player[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayedCard {
  playerId: number;
  nickname: string;
  cardId: number;
  cardName: string;
  value: number;
}

export interface RoundResult {
  playedCards: PlayedCard[];
  winnerId: number;
  nextTurnPlayerId?: number;
  selectedAttribute: Attribute;
}

export interface GameFinished {
  winnerId: number;
  reason?: 'normal' | 'insufficient_players';
}
```

---

## 📡 Tipos de Eventos WebSocket

El backend emite dos tipos de eventos WebSocket con diferentes patrones de comunicación:

### **Eventos de Respuesta Directa** (Point-to-Point)

Estos eventos se envían **solo al cliente que realizó la acción**, no a todos los jugadores en la sala:

| Evento | Trigger | Descripción |
|--------|---------|-------------|
| `gameCreated` | `createGame` | Confirmación de creación de partida con ID |
| `joinedGame` | `joinGame` | Confirmación de unión con datos de game y player |
| `readyConfirmed` | `playerReady` | Confirmación de estado "listo" |
| `cardPlayed` | `playCard` | Confirmación de carta jugada |
| `leftGame` | `leaveGame` | Confirmación de salida de partida |
| `gameState` | `getGameState` | Respuesta con estado actual del juego |
| `error` | Cualquier acción | Error específico de la operación |

**Uso:** Feedback inmediato y confirmación de acciones del usuario.

### **Eventos de Broadcast** (Room-Wide)

Estos eventos se envían a **todos los jugadores** en la sala del juego (`game-${gameId}`):

| Evento | Trigger | Descripción |
|--------|---------|-------------|
| `playerJoined` | Jugador se une | Notifica a todos que un nuevo jugador entró |
| `playerReady` | Jugador marca listo | Notifica estado de ready + si todos están listos |
| `gameStarted` | Todos listos | Inicia partida y distribuye cartas |
| `roundResult` | Ronda finaliza | Resultado de la ronda con cartas jugadas y ganador |
| `gameFinished` | Partida termina | Ganador final de la partida |
| `playerDisconnected` | Desconexión | Notifica desconexión accidental de jugador |
| `playerLeft` | Salida manual | Notifica salida intencional de jugador |

**Uso:** Sincronización de estado entre todos los clientes conectados.

### **Diferencia Clave: `playerDisconnected` vs `playerLeft`**

- **`playerDisconnected`**: Se emite cuando un jugador **pierde conexión accidentalmente** (cierra navegador, pierde internet, etc.)
- **`playerLeft`**: Se emite cuando un jugador **presiona el botón "Abandonar"** intencionalmente

Ambos eventos tienen el mismo efecto en el juego (remover jugador), pero permiten mostrar mensajes diferentes en la UI.

---

## ⚠️ Manejo de Errores

### **Estructura del Evento Error**

El backend emite un evento `error` cuando una operación falla:

```typescript
{
  event: 'error',
  data: {
    message: string  // Descripción del error
  }
}
```

### **Mensajes de Error Comunes**

| Mensaje | Causa | Acción Recomendada |
|---------|-------|-------------------|
| `"Game is full"` | Intentar unirse a partida llena | Mostrar mensaje y sugerir otra partida |
| `"Game not found"` | ID de partida inválido o partida eliminada | Redirigir a home |
| `"Player not found"` | Player ID inválido | Re-sincronizar estado o redirigir a home |
| `"It's not your turn"` | Intentar jugar fuera de turno | Bloquear UI hasta que sea tu turno |
| `"Invalid card"` | Carta no está en tu mano | Re-sincronizar cartas con backend |
| `"Invalid attribute"` | Atributo no válido | Validar atributos permitidos |
| `"Game already started"` | Intentar unirse a partida en progreso | Mostrar mensaje y buscar otra partida |
| `"Unknown error occurred"` | Error genérico del servidor | Mostrar mensaje genérico y sugerir reintentar |

### **Implementación de Error Handler**

En `composables/useSocket.ts`, el error handler ya está implementado:

```typescript
socket.value.on('error', (error: { message: string }) => {
  console.error('❌ Error:', error.message);
  useNuxtApp().$toast?.error(error.message);
});
```

### **Manejo de Errores por Página**

#### **En `index.vue` (Home)**
```typescript
// Al intentar unirse a partida que no existe
if (error.message.includes('Game not found')) {
  useNuxtApp().$toast?.error('Partida no encontrada. Verifica el ID.');
  gameIdToJoin.value = null;
}

// Al intentar unirse a partida llena
if (error.message.includes('Game is full')) {
  useNuxtApp().$toast?.error('Partida llena. Busca otra partida.');
  loadWaitingGames(); // Refresh lista
}
```

#### **En `game/[id].vue` (Tablero)**
```typescript
// Si intentas jugar fuera de turno
if (error.message.includes("not your turn")) {
  useNuxtApp().$toast?.warning('¡Espera tu turno!');
  selectedCard.value = null;
}

// Si carta inválida (no está en tu mano)
if (error.message.includes('Invalid card')) {
  useNuxtApp().$toast?.error('Carta inválida. Recargando...');
  getGameState(gameId.value); // Re-sincronizar
}
```

### **Validación del Lado del Cliente**

Para evitar errores, valida **antes** de emitir eventos:

```typescript
// Validar antes de playCard
const handlePlayCard = (attribute: Attribute) => {
  if (!selectedCard.value) {
    console.warn('No hay carta seleccionada');
    return;
  }

  if (!isMyTurn.value) {
    useNuxtApp().$toast?.warning('¡No es tu turno!');
    return;
  }

  // Validar que la carta está en tu mano
  if (!myCards.value.find(c => c.id === selectedCard.value!.id)) {
    useNuxtApp().$toast?.error('Carta no válida');
    selectedCard.value = null;
    return;
  }

  // Validar atributo
  const validAttributes: Attribute[] = ['power', 'speed', 'intelligence', 'defense', 'agility'];
  if (!validAttributes.includes(attribute)) {
    console.error('Atributo inválido:', attribute);
    return;
  }

  playCard(selectedCard.value.id, attribute);
  selectedCard.value = null;
};
```

### **Debugging de Errores**

Para debugging avanzado, puedes extender el error handler:

```typescript
socket.value.on('error', (error: { message: string }) => {
  console.error('❌ Error:', error.message);

  // Log adicional en desarrollo
  if (process.dev) {
    console.error('Error details:', {
      timestamp: new Date().toISOString(),
      gameId: game.value?.id,
      playerId: currentPlayer.value?.id,
      socketId: socket.value?.id,
      error: error.message
    });
  }

  useNuxtApp().$toast?.error(error.message);
});
```

---

## 🔌 Composables

### `composables/useSocket.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import type { Game, Player, RoundResult, GameFinished } from '~/types/game';

export const useSocket = () => {
  const config = useRuntimeConfig();
  const socket = useState<Socket | null>('socket', () => null);
  const isConnected = useState<boolean>('socketConnected', () => false);

  const connect = () => {
    if (socket.value?.connected) return;

    socket.value = io(config.public.backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.value.on('connect', () => {
      console.log('✅ Conectado al servidor:', socket.value?.id);
      isConnected.value = true;
    });

    socket.value.on('disconnect', () => {
      console.log('❌ Desconectado del servidor');
      isConnected.value = false;
    });

    socket.value.on('error', (error: { message: string }) => {
      console.error('❌ Error:', error.message);
      useNuxtApp().$toast?.error(error.message);
    });
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
      isConnected.value = false;
    }
  };

  // Eventos del servidor
  const on = <T = any>(event: string, callback: (data: T) => void) => {
    socket.value?.on(event, callback);
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    socket.value?.off(event, callback);
  };

  // Eventos al servidor
  const emit = (event: string, data?: any) => {
    if (!socket.value?.connected) {
      console.error('Socket no conectado');
      return;
    }
    socket.value.emit(event, data);
  };

  // Auto-conectar en client-side
  if (process.client && !socket.value) {
    connect();
  }

  // Cleanup en unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    on,
    off,
    emit,
  };
};
```

---

### `composables/useGame.ts`

```typescript
import type { Game, Player, Card, RoundResult, GameFinished, Attribute } from '~/types/game';

export const useGame = () => {
  const { emit, on, off } = useSocket();

  // Estado global del juego
  const game = useState<Game | null>('game', () => null);
  const players = useState<Player[]>('players', () => []);
  const currentPlayer = useState<Player | null>('currentPlayer', () => null);
  const myCards = useState<Card[]>('myCards', () => []);
  const isMyTurn = useState<boolean>('isMyTurn', () => false);
  const roundResult = useState<RoundResult | null>('roundResult', () => null);

  // === ACCIONES ===

  const createGame = (maxPlayers: number = 2) => {
    emit('createGame', { maxPlayers });
  };

  const joinGame = (gameId: number, nickname: string) => {
    emit('joinGame', { gameId, nickname });
  };

  const markReady = () => {
    if (!game.value || !currentPlayer.value) return;
    emit('playerReady', {
      gameId: game.value.id,
      playerId: currentPlayer.value.id,
    });
  };

  const playCard = (cardId: number, selectedAttribute: Attribute) => {
    if (!game.value || !currentPlayer.value || !isMyTurn.value) return;

    emit('playCard', {
      gameId: game.value.id,
      playerId: currentPlayer.value.id,
      cardId,
      selectedAttribute,
    });

    // Optimistic update
    isMyTurn.value = false;
  };

  const getGameState = (gameId: number) => {
    emit('getGameState', { gameId });
  };

  const leaveGame = () => {
    if (!game.value || !currentPlayer.value) return;
    emit('leaveGame', {
      gameId: game.value.id,
      playerId: currentPlayer.value.id,
    });
  };

  // === LISTENERS ===

  const setupListeners = () => {
    // Game Created
    on<{ data: Game }>('gameCreated', (data) => {
      console.log('Partida creada:', data.data);
      game.value = data.data;
      navigateTo(`/lobby/${data.data.id}`);
    });

    // Joined Game
    on<{ data: { game: Game; player: Player } }>('joinedGame', (data) => {
      console.log('Te uniste a la partida');
      game.value = data.data.game;
      currentPlayer.value = data.data.player;
    });

    // Player Joined
    on<{ player: Player; totalPlayers: number; maxPlayers: number }>('playerJoined', (data) => {
      console.log(`${data.player.nickname} se unió (${data.totalPlayers}/${data.maxPlayers})`);

      // Actualizar lista si no está
      if (!players.value.find(p => p.id === data.player.id)) {
        players.value.push(data.player);
      }
    });

    // Player Ready
    on<{ playerId: number; allReady: boolean }>('playerReady', (data) => {
      console.log(`Jugador ${data.playerId} listo`);

      const player = players.value.find(p => p.id === data.playerId);
      if (player) {
        player.isReady = true;
      }

      if (data.allReady) {
        useNuxtApp().$toast?.success('¡Todos listos! Iniciando partida...');
      }
    });

    // Ready Confirmed
    on<{ data: { allReady: boolean } }>('readyConfirmed', (data) => {
      if (currentPlayer.value) {
        currentPlayer.value.isReady = true;
      }
    });

    // Game Started
    on<{ game: Game; players: Player[] }>('gameStarted', async (data) => {
      console.log('¡Partida iniciada!');
      game.value = data.game;
      players.value = data.players;

      // Encontrar mi jugador actualizado
      const me = data.players.find(p => p.id === currentPlayer.value?.id);
      if (me) {
        currentPlayer.value = me;

        // Fetch cartas completas
        const { fetchCardsByIds } = useCards();
        myCards.value = await fetchCardsByIds(me.cards);
      }

      isMyTurn.value = data.game.currentTurnPlayerId === currentPlayer.value?.id;

      // Navegar al tablero
      navigateTo(`/game/${data.game.id}`);
    });

    // Round Result
    on<RoundResult>('roundResult', async (data) => {
      console.log('Resultado de ronda:', data);
      roundResult.value = data;

      // Actualizar cartas (remover las jugadas)
      const myPlayedCard = data.playedCards.find(pc => pc.playerId === currentPlayer.value?.id);
      if (myPlayedCard) {
        myCards.value = myCards.value.filter(c => c.id !== myPlayedCard.cardId);
      }

      // Actualizar scores de jugadores
      data.playedCards.forEach(pc => {
        const player = players.value.find(p => p.id === pc.playerId);
        if (player && pc.playerId === data.winnerId) {
          player.score++;
        }
      });

      // Actualizar turno
      isMyTurn.value = data.nextTurnPlayerId === currentPlayer.value?.id;

      // Mostrar resultado por 3 segundos
      setTimeout(() => {
        roundResult.value = null;
      }, 3000);
    });

    // Game Finished
    on<GameFinished>('gameFinished', (data) => {
      console.log('¡Partida terminada!');

      if (game.value) {
        game.value.status = 'finished' as any;
        game.value.winnerId = data.winnerId;
      }

      const winner = players.value.find(p => p.id === data.winnerId);

      if (data.winnerId === currentPlayer.value?.id) {
        useNuxtApp().$toast?.success('🎉 ¡GANASTE!');
      } else {
        useNuxtApp().$toast?.info(`${winner?.nickname} ganó la partida`);
      }
    });

    // Player Disconnected
    on<{ playerId: number; nickname: string; nextTurnPlayerId?: number }>('playerDisconnected', (data) => {
      console.log(`${data.nickname} se desconectó`);

      players.value = players.value.filter(p => p.id !== data.playerId);

      useNuxtApp().$toast?.warning(`${data.nickname} abandonó la partida`);

      if (data.nextTurnPlayerId) {
        isMyTurn.value = data.nextTurnPlayerId === currentPlayer.value?.id;
      }
    });

    // Game State (response)
    on<{ data: { game: Game; players: Player[] } }>('gameState', (data) => {
      game.value = data.data.game;
      players.value = data.data.players;
    });

    // Player Left (manual leave - different from disconnect)
    on<{ playerId: number }>('playerLeft', (data) => {
      console.log(`Jugador ${data.playerId} abandonó la partida manualmente`);

      players.value = players.value.filter(p => p.id !== data.playerId);

      useNuxtApp().$toast?.info('Un jugador abandonó la partida');
    });

    // Card Played (confirmation)
    on<{ data: { success: boolean } }>('cardPlayed', (data) => {
      console.log('Carta jugada confirmada');
      // Opcional: mostrar feedback visual de confirmación
    });

    // Left Game (confirmation)
    on<{ data: { success: boolean } }>('leftGame', (data) => {
      console.log('Salida de partida confirmada');
      // El cleanup se hace en el handler del botón leaveGame
    });
  };

  const cleanupListeners = () => {
    off('gameCreated');
    off('joinedGame');
    off('playerJoined');
    off('playerReady');
    off('readyConfirmed');
    off('gameStarted');
    off('roundResult');
    off('gameFinished');
    off('playerDisconnected');
    off('playerLeft');
    off('cardPlayed');
    off('leftGame');
    off('gameState');
  };

  // Auto-setup listeners
  onMounted(() => {
    setupListeners();
  });

  onUnmounted(() => {
    cleanupListeners();
  });

  return {
    // Estado
    game,
    players,
    currentPlayer,
    myCards,
    isMyTurn,
    roundResult,

    // Acciones
    createGame,
    joinGame,
    markReady,
    playCard,
    getGameState,
    leaveGame,

    // Listeners
    setupListeners,
    cleanupListeners,
  };
};
```

---

### `composables/useCards.ts`

```typescript
import type { Card } from '~/types/game';

export const useCards = () => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.backendUrl;

  const fetchAllCards = async (): Promise<Card[]> => {
    try {
      const data = await $fetch<Card[]>(`${baseUrl}/cards`);
      return data;
    } catch (error) {
      console.error('Error fetching cards:', error);
      return [];
    }
  };

  const fetchCardById = async (id: number): Promise<Card | null> => {
    try {
      const data = await $fetch<Card>(`${baseUrl}/cards/${id}`);
      return data;
    } catch (error) {
      console.error(`Error fetching card ${id}:`, error);
      return null;
    }
  };

  const fetchCardsByIds = async (ids: number[]): Promise<Card[]> => {
    try {
      const promises = ids.map(id => fetchCardById(id));
      const results = await Promise.all(promises);
      return results.filter((card): card is Card => card !== null);
    } catch (error) {
      console.error('Error fetching cards:', error);
      return [];
    }
  };

  const fetchRandomCards = async (count: number = 10): Promise<Card[]> => {
    try {
      const data = await $fetch<Card[]>(`${baseUrl}/cards/random?count=${count}`);
      return data;
    } catch (error) {
      console.error('Error fetching random cards:', error);
      return [];
    }
  };

  return {
    fetchAllCards,
    fetchCardById,
    fetchCardsByIds,
    fetchRandomCards,
  };
};
```

---

## 📄 Pages

### `pages/index.vue` - Home / Create Game

```vue
<template>
  <div class="home">
    <h1>Top Trumps Multiplayer</h1>

    <div v-if="!isConnected" class="loading">
      <p>Conectando al servidor...</p>
    </div>

    <div v-else class="menu">
      <h2>Crear Nueva Partida</h2>

      <div class="form-group">
        <label>Número de Jugadores:</label>
        <select v-model="maxPlayers">
          <option :value="2">2 Jugadores</option>
          <option :value="3">3 Jugadores</option>
          <option :value="4">4 Jugadores</option>
          <option :value="5">5 Jugadores</option>
          <option :value="6">6 Jugadores</option>
        </select>
      </div>

      <button @click="handleCreateGame" class="btn-primary">
        Crear Partida
      </button>

      <hr>

      <h2>Unirse a Partida Existente</h2>

      <div class="form-group">
        <label>ID de Partida:</label>
        <input v-model.number="gameIdToJoin" type="number" placeholder="Ej: 123">
      </div>

      <div class="form-group">
        <label>Tu Nickname:</label>
        <input v-model="nickname" type="text" placeholder="Ej: Player1" maxlength="20">
      </div>

      <button
        @click="handleJoinGame"
        :disabled="!gameIdToJoin || !nickname"
        class="btn-secondary"
      >
        Unirse
      </button>

      <hr>

      <h3>Partidas Disponibles</h3>
      <button @click="loadWaitingGames" class="btn-link">
        Recargar
      </button>

      <div v-if="waitingGames.length === 0" class="empty">
        No hay partidas en espera
      </div>

      <div v-else class="games-list">
        <div
          v-for="game in waitingGames"
          :key="game.id"
          class="game-card"
          @click="quickJoin(game.id)"
        >
          <p><strong>Partida #{{ game.id }}</strong></p>
          <p>Jugadores: {{ game.players.length }} / {{ game.maxPlayers }}</p>
          <p class="created">{{ formatDate(game.createdAt) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Game } from '~/types/game';

definePageMeta({
  layout: 'default',
});

const { isConnected } = useSocket();
const { createGame, joinGame } = useGame();
const config = useRuntimeConfig();

const maxPlayers = ref<number>(2);
const gameIdToJoin = ref<number | null>(null);
const nickname = ref<string>('');
const waitingGames = ref<Game[]>([]);

const handleCreateGame = () => {
  createGame(maxPlayers.value);
};

const handleJoinGame = () => {
  if (!gameIdToJoin.value || !nickname.value) return;
  joinGame(gameIdToJoin.value, nickname.value);
};

const quickJoin = (gameId: number) => {
  if (!nickname.value) {
    nickname.value = `Player${Math.floor(Math.random() * 1000)}`;
  }
  joinGame(gameId, nickname.value);
};

const loadWaitingGames = async () => {
  try {
    const games = await $fetch<Game[]>(`${config.public.backendUrl}/games/waiting`);
    waitingGames.value = games;
  } catch (error) {
    console.error('Error loading waiting games:', error);
  }
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleTimeString();
};

onMounted(() => {
  loadWaitingGames();
});
</script>

<style scoped>
.home {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-primary,
.btn-secondary,
.btn-link {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 1rem;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-secondary {
  background: #2196F3;
  color: white;
}

.btn-link {
  background: transparent;
  color: #2196F3;
  text-decoration: underline;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-secondary:hover {
  background: #0b7dda;
}

.btn-secondary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.games-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.game-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.game-card:hover {
  border-color: #2196F3;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.created {
  font-size: 0.875rem;
  color: #666;
}

.empty {
  text-align: center;
  color: #999;
  padding: 2rem;
}

hr {
  margin: 2rem 0;
  border: none;
  border-top: 1px solid #ddd;
}
</style>
```

---

### `pages/lobby/[id].vue` - Waiting Room

```vue
<template>
  <div class="lobby">
    <h1>Sala de Espera</h1>

    <div v-if="!game" class="loading">
      <p>Cargando partida...</p>
    </div>

    <div v-else class="lobby-content">
      <div class="game-info">
        <h2>Partida #{{ game.id }}</h2>
        <p>Jugadores: {{ players.length }} / {{ game.maxPlayers }}</p>
        <p>Estado: <span class="status">{{ game.status }}</span></p>
      </div>

      <div class="players-grid">
        <div
          v-for="player in players"
          :key="player.id"
          class="player-card"
          :class="{
            'is-ready': player.isReady,
            'is-me': player.id === currentPlayer?.id
          }"
        >
          <div class="player-avatar">
            {{ player.nickname[0].toUpperCase() }}
          </div>
          <p class="player-name">{{ player.nickname }}</p>
          <span v-if="player.isReady" class="ready-badge">✓ Listo</span>
          <span v-else class="waiting-badge">Esperando...</span>
        </div>

        <!-- Slots vacíos -->
        <div
          v-for="i in (game.maxPlayers - players.length)"
          :key="`empty-${i}`"
          class="player-card empty"
        >
          <div class="player-avatar">?</div>
          <p class="player-name">Esperando...</p>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="!currentPlayer?.isReady"
          @click="handleMarkReady"
          class="btn-primary"
        >
          Marcar como Listo
        </button>

        <p v-else class="waiting-message">
          Esperando a los demás jugadores...
        </p>

        <button @click="handleLeave" class="btn-danger">
          Abandonar Partida
        </button>
      </div>

      <div class="share-section">
        <h3>Invitar Amigos</h3>
        <div class="share-code">
          <code>{{ shareUrl }}</code>
          <button @click="copyShareUrl" class="btn-copy">
            {{ copied ? '✓ Copiado' : 'Copiar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
});

const route = useRoute();
const { game, players, currentPlayer, markReady, leaveGame, getGameState } = useGame();

const gameId = computed(() => Number(route.params.id));
const shareUrl = computed(() => {
  if (process.client) {
    return `${window.location.origin}/lobby/${gameId.value}`;
  }
  return '';
});

const copied = ref(false);

const handleMarkReady = () => {
  markReady();
};

const handleLeave = () => {
  leaveGame();
  navigateTo('/');
};

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying:', error);
  }
};

onMounted(() => {
  // Si no tenemos datos de juego, pedirlos
  if (!game.value || game.value.id !== gameId.value) {
    getGameState(gameId.value);
  }
});
</script>

<style scoped>
.lobby {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.game-info {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.status {
  font-weight: 600;
  text-transform: uppercase;
  color: #FF9800;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.player-card {
  border: 2px solid #ddd;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s;
}

.player-card.is-ready {
  border-color: #4CAF50;
  background: #f1f8f1;
}

.player-card.is-me {
  border-color: #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.player-card.empty {
  border-style: dashed;
  opacity: 0.5;
}

.player-avatar {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.player-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.ready-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #4CAF50;
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
}

.waiting-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #FF9800;
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
}

.actions {
  text-align: center;
  margin-bottom: 2rem;
}

.btn-primary,
.btn-danger {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin: 0.5rem;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-danger:hover {
  background: #da190b;
}

.waiting-message {
  color: #666;
  font-style: italic;
  margin: 1rem 0;
}

.share-section {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
}

.share-section h3 {
  margin-bottom: 1rem;
}

.share-code {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.share-code code {
  flex: 1;
  padding: 0.75rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
}

.btn-copy {
  padding: 0.75rem 1.5rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-copy:hover {
  background: #0b7dda;
}
</style>
```

---

### `pages/game/[id].vue` - Game Board

```vue
<template>
  <div class="game-board">
    <div v-if="!game" class="loading">
      <p>Cargando partida...</p>
    </div>

    <div v-else class="game-container">
      <!-- Header -->
      <div class="game-header">
        <h1>Partida #{{ game.id }}</h1>
        <p>Ronda {{ game.currentRound }}</p>
      </div>

      <!-- Players Scores -->
      <div class="players-bar">
        <div
          v-for="player in players"
          :key="player.id"
          class="player-score"
          :class="{
            'active': game.currentTurnPlayerId === player.id,
            'me': player.id === currentPlayer?.id
          }"
        >
          <span class="player-name">{{ player.nickname }}</span>
          <span class="score">{{ player.score }} pts</span>
          <span class="cards-left">{{ player.cards.length }} cartas</span>
        </div>
      </div>

      <!-- Turn Indicator -->
      <div class="turn-indicator">
        <div v-if="isMyTurn" class="my-turn">
          🎯 ¡Es tu turno! Selecciona una carta y un atributo
        </div>
        <div v-else class="waiting-turn">
          ⏳ Esperando a {{ currentPlayerName }}...
        </div>
      </div>

      <!-- Round Result Modal -->
      <div v-if="roundResult" class="round-result-modal">
        <RoundResult :result="roundResult" @close="roundResult = null" />
      </div>

      <!-- Game Finished Modal -->
      <div v-if="game.status === 'finished'" class="game-finished-modal">
        <GameFinished :game="game" :players="players" />
      </div>

      <!-- My Cards -->
      <div class="my-cards">
        <h2>Tus Cartas ({{ myCards.length }})</h2>
        <div class="cards-grid">
          <Card
            v-for="card in myCards"
            :key="card.id"
            :card="card"
            :selectable="isMyTurn"
            :selected="selectedCard?.id === card.id"
            @click="handleCardSelect(card)"
          />
        </div>
      </div>

      <!-- Attribute Selector -->
      <div v-if="selectedCard && isMyTurn" class="attribute-selector">
        <h3>Selecciona un atributo para {{ selectedCard.name }}:</h3>
        <div class="attributes">
          <button
            v-for="attr in attributes"
            :key="attr"
            @click="handlePlayCard(attr)"
            class="attr-btn"
          >
            <span class="attr-name">{{ formatAttribute(attr) }}</span>
            <span class="attr-value">{{ selectedCard[attr] }}</span>
          </button>
        </div>
        <button @click="selectedCard = null" class="btn-cancel">
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardType, Attribute } from '~/types/game';

definePageMeta({
  layout: 'game',
});

const route = useRoute();
const {
  game,
  players,
  currentPlayer,
  myCards,
  isMyTurn,
  roundResult,
  playCard,
  getGameState
} = useGame();

const gameId = computed(() => Number(route.params.id));
const selectedCard = ref<CardType | null>(null);

const attributes: Attribute[] = ['power', 'speed', 'intelligence', 'defense', 'agility'];

const currentPlayerName = computed(() => {
  if (!game.value) return '';
  const player = players.value.find(p => p.id === game.value?.currentTurnPlayerId);
  return player?.nickname || '';
});

const handleCardSelect = (card: CardType) => {
  if (!isMyTurn.value) {
    useNuxtApp().$toast?.warning('¡No es tu turno!');
    return;
  }
  selectedCard.value = card;
};

const handlePlayCard = (attribute: Attribute) => {
  if (!selectedCard.value) return;

  playCard(selectedCard.value.id, attribute);
  selectedCard.value = null;
};

const formatAttribute = (attr: Attribute): string => {
  const labels: Record<Attribute, string> = {
    power: 'Poder',
    speed: 'Velocidad',
    intelligence: 'Inteligencia',
    defense: 'Defensa',
    agility: 'Agilidad',
  };
  return labels[attr];
};

onMounted(() => {
  if (!game.value || game.value.id !== gameId.value) {
    getGameState(gameId.value);
  }
});
</script>

<style scoped>
.game-board {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.game-container {
  max-width: 1400px;
  margin: 0 auto;
}

.game-header {
  text-align: center;
  color: white;
  margin-bottom: 2rem;
}

.players-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.player-score {
  flex: 1;
  min-width: 200px;
  background: rgba(255, 255, 255, 0.9);
  padding: 1rem;
  border-radius: 8px;
  border: 3px solid transparent;
  transition: all 0.3s;
}

.player-score.active {
  border-color: #4CAF50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
}

.player-score.me {
  background: rgba(33, 150, 243, 0.1);
  border-color: #2196F3;
}

.player-score .player-name {
  display: block;
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.player-score .score {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: #4CAF50;
}

.player-score .cards-left {
  display: block;
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.turn-indicator {
  margin-bottom: 2rem;
  text-align: center;
}

.my-turn,
.waiting-turn {
  display: inline-block;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.25rem;
  font-weight: 600;
}

.my-turn {
  background: #4CAF50;
  color: white;
  animation: pulse 2s infinite;
}

.waiting-turn {
  background: rgba(255, 255, 255, 0.9);
  color: #666;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.my-cards {
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.my-cards h2 {
  margin-bottom: 1.5rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.attribute-selector {
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
}

.attribute-selector h3 {
  margin-bottom: 1.5rem;
}

.attributes {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.attr-btn {
  padding: 1rem 2rem;
  border: 2px solid #2196F3;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  min-width: 120px;
}

.attr-btn:hover {
  background: #2196F3;
  color: white;
  transform: translateY(-2px);
}

.attr-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.attr-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.btn-cancel {
  padding: 0.75rem 2rem;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #da190b;
}

.round-result-modal,
.game-finished-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
</style>
```

---

## 🎴 Components

### `components/Card.vue`

```vue
<template>
  <div
    class="card"
    :class="{
      selectable,
      selected,
      [`rarity-${card.rarity}`]: true
    }"
    @click="handleClick"
  >
    <div class="card-header">
      <h3>{{ card.name }}</h3>
      <span class="rarity-badge">{{ card.rarity }}</span>
    </div>

    <div v-if="card.image" class="card-image">
      <img :src="card.image" :alt="card.name">
    </div>
    <div v-else class="card-image placeholder">
      <span>{{ card.name[0] }}</span>
    </div>

    <div class="card-stats">
      <div class="stat">
        <span class="label">⚡ Poder</span>
        <span class="value">{{ card.power }}</span>
      </div>
      <div class="stat">
        <span class="label">🏃 Velocidad</span>
        <span class="value">{{ card.speed }}</span>
      </div>
      <div class="stat">
        <span class="label">🧠 Inteligencia</span>
        <span class="value">{{ card.intelligence }}</span>
      </div>
      <div class="stat">
        <span class="label">🛡️ Defensa</span>
        <span class="value">{{ card.defense }}</span>
      </div>
      <div class="stat">
        <span class="label">🤸 Agilidad</span>
        <span class="value">{{ card.agility }}</span>
      </div>
    </div>

    <p class="card-description">{{ card.description }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~/types/game';

interface Props {
  card: CardType;
  selectable?: boolean;
  selected?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  click: [];
}>();

const handleClick = () => {
  if (props.selectable) {
    emit('click');
  }
};
</script>

<style scoped>
.card {
  border: 2px solid #ddd;
  border-radius: 12px;
  padding: 1rem;
  background: white;
  transition: all 0.3s;
}

.card.selectable {
  cursor: pointer;
}

.card.selectable:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.2);
}

.card.selected {
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.3);
}

.card.rarity-legendary {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #000;
}

.card.rarity-epic {
  background: linear-gradient(135deg, #9C27B0 0%, #673AB7 100%);
  color: white;
}

.card.rarity-rare {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  color: white;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 1rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.rarity-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0,0,0,0.2);
  border-radius: 4px;
  text-transform: uppercase;
}

.card-image {
  aspect-ratio: 1;
  margin-bottom: 1rem;
  border-radius: 8px;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-image.placeholder {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-image.placeholder span {
  font-size: 4rem;
  font-weight: bold;
  color: white;
}

.card-stats {
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.stat .label {
  font-weight: 600;
}

.stat .value {
  font-weight: bold;
  font-size: 1.1rem;
}

.card-description {
  font-size: 0.875rem;
  opacity: 0.8;
  margin: 0;
}
</style>
```

---

### `components/RoundResult.vue`

```vue
<template>
  <div class="round-result" @click.self="emit('close')">
    <div class="result-content">
      <h2>Resultado de la Ronda</h2>
      <p class="attribute">Atributo: <strong>{{ formatAttribute(result.selectedAttribute) }}</strong></p>

      <div class="played-cards">
        <div
          v-for="pc in result.playedCards"
          :key="pc.playerId"
          class="played-card"
          :class="{ winner: pc.playerId === result.winnerId }"
        >
          <div v-if="pc.playerId === result.winnerId" class="winner-badge">
            👑 GANADOR
          </div>
          <h3>{{ pc.nickname }}</h3>
          <p class="card-name">{{ pc.cardName }}</p>
          <p class="card-value">
            {{ formatAttribute(result.selectedAttribute) }}: <strong>{{ pc.value }}</strong>
          </p>
        </div>
      </div>

      <button @click="emit('close')" class="btn-close">
        Continuar
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RoundResult, Attribute } from '~/types/game';

interface Props {
  result: RoundResult;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const formatAttribute = (attr: Attribute): string => {
  const labels: Record<Attribute, string> = {
    power: 'Poder',
    speed: 'Velocidad',
    intelligence: 'Inteligencia',
    defense: 'Defensa',
    agility: 'Agilidad',
  };
  return labels[attr];
};
</script>

<style scoped>
.round-result {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.result-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 900px;
  width: 90%;
}

.result-content h2 {
  text-align: center;
  margin-bottom: 1rem;
}

.attribute {
  text-align: center;
  font-size: 1.25rem;
  margin-bottom: 2rem;
}

.played-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.played-card {
  border: 2px solid #ddd;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  position: relative;
  transition: all 0.3s;
}

.played-card.winner {
  border-color: #4CAF50;
  background: #f1f8f1;
  transform: scale(1.05);
}

.winner-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.875rem;
}

.played-card h3 {
  margin-bottom: 0.5rem;
}

.card-name {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2196F3;
}

.btn-close {
  display: block;
  width: 100%;
  padding: 1rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
}

.btn-close:hover {
  background: #0b7dda;
}
</style>
```

---

### `components/GameFinished.vue`

```vue
<template>
  <div class="game-finished">
    <div class="finished-content">
      <h1 v-if="isWinner">🎉 ¡GANASTE!</h1>
      <h1 v-else>Partida Terminada</h1>

      <div class="winner-info">
        <p class="winner-name">{{ winnerName }}</p>
        <p class="winner-score">{{ winnerScore }} puntos</p>
      </div>

      <h3>Clasificación Final</h3>
      <div class="rankings">
        <div
          v-for="(player, index) in rankedPlayers"
          :key="player.id"
          class="rank-item"
          :class="{ 'is-me': player.id === currentPlayer?.id }"
        >
          <span class="rank-position">{{ index + 1 }}º</span>
          <span class="rank-name">{{ player.nickname }}</span>
          <span class="rank-score">{{ player.score }} pts</span>
          <span class="rank-cards">{{ player.cards.length }} cartas restantes</span>
        </div>
      </div>

      <div class="actions">
        <button @click="handlePlayAgain" class="btn-primary">
          Jugar de Nuevo
        </button>
        <button @click="handleGoHome" class="btn-secondary">
          Volver al Inicio
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Game, Player } from '~/types/game';

interface Props {
  game: Game;
  players: Player[];
}

const props = defineProps<Props>();
const { currentPlayer, createGame } = useGame();

const rankedPlayers = computed(() => {
  return [...props.players].sort((a, b) => b.score - a.score);
});

const winner = computed(() => {
  return props.players.find(p => p.id === props.game.winnerId);
});

const winnerName = computed(() => winner.value?.nickname || 'Desconocido');
const winnerScore = computed(() => winner.value?.score || 0);
const isWinner = computed(() => props.game.winnerId === currentPlayer.value?.id);

const handlePlayAgain = () => {
  createGame(props.game.maxPlayers);
};

const handleGoHome = () => {
  navigateTo('/');
};
</script>

<style scoped>
.game-finished {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.5s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.finished-content {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  max-width: 600px;
  width: 90%;
  text-align: center;
}

.finished-content h1 {
  font-size: 3rem;
  margin-bottom: 2rem;
  animation: bounceIn 0.6s;
}

@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

.winner-info {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.winner-name {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.winner-score {
  font-size: 1.5rem;
}

.rankings {
  margin: 1.5rem 0 2rem;
}

.rank-item {
  display: grid;
  grid-template-columns: 50px 1fr auto auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
  align-items: center;
}

.rank-item.is-me {
  background: rgba(33, 150, 243, 0.1);
  border-left: 4px solid #2196F3;
}

.rank-position {
  font-size: 1.5rem;
  font-weight: bold;
  color: #FFD700;
}

.rank-name {
  text-align: left;
  font-weight: 600;
}

.rank-score {
  font-weight: bold;
  color: #4CAF50;
}

.rank-cards {
  font-size: 0.875rem;
  color: #666;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-primary,
.btn-secondary {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-secondary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
  transform: translateY(-2px);
}

.btn-secondary:hover {
  background: #0b7dda;
  transform: translateY(-2px);
}
</style>
```

---

## 🎨 Plugin de Toast (Opcional)

### `plugins/toast.client.ts`

```typescript
export default defineNuxtPlugin(() => {
  const toast = {
    success: (message: string) => {
      console.log('✅', message);
      // Implementar tu librería de toast favorita (vue-toastification, etc)
    },
    error: (message: string) => {
      console.error('❌', message);
    },
    warning: (message: string) => {
      console.warn('⚠️', message);
    },
    info: (message: string) => {
      console.info('ℹ️', message);
    },
  };

  return {
    provide: {
      toast,
    },
  };
});
```

---

## 🚀 Ejecutar el Proyecto

```bash
# Instalar dependencias
pnpm install

# Modo desarrollo
pnpm dev

# Build para producción
pnpm build

# Preview producción
pnpm preview
```

---

## 📱 Features Adicionales

### Auto-reconexión

El composable `useSocket` ya incluye **reconexión automática** con los siguientes parámetros:

```typescript
socket.value = io(config.public.backendUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,           // ✅ Habilitada por defecto
  reconnectionAttempts: 5,      // Máximo 5 intentos
  reconnectionDelay: 1000,      // 1 segundo entre intentos
});
```

#### **Comportamiento en Reconexión**

**Cuando se pierde la conexión:**
1. El cliente intenta reconectar automáticamente (hasta 5 veces)
2. Se emite evento `disconnect` localmente
3. El backend detecta la desconexión y emite `playerDisconnected` a la sala
4. Otros jugadores ven que te desconectaste

**Cuando se reconecta:**
1. Se emite evento `connect` localmente
2. **IMPORTANTE:** El `socketId` cambia (nuevo socket)
3. **PROBLEMA:** El backend no sabe que eres el mismo jugador
4. **SOLUCIÓN:** Debes **re-unirte** a la partida manualmente

#### **Implementación Completa de Reconexión**

```typescript
// composables/useSocket.ts

socket.value.on('disconnect', (reason) => {
  console.log('❌ Desconectado del servidor:', reason);
  isConnected.value = false;

  // Guardar estado antes de desconectar
  if (process.client && game.value && currentPlayer.value) {
    localStorage.setItem('reconnect_game', JSON.stringify({
      gameId: game.value.id,
      playerId: currentPlayer.value.id,
      nickname: currentPlayer.value.nickname,
    }));
  }

  useNuxtApp().$toast?.warning('Conexión perdida. Reconectando...');
});

socket.value.on('connect', () => {
  console.log('✅ Reconectado al servidor:', socket.value?.id);
  isConnected.value = true;

  useNuxtApp().$toast?.success('¡Reconectado!');

  // Intentar re-unirse si estabas en una partida
  if (process.client) {
    const saved = localStorage.getItem('reconnect_game');
    if (saved) {
      try {
        const { gameId, nickname } = JSON.parse(saved);

        // Re-unirse a la partida
        console.log('Intentando re-unirse a partida:', gameId);
        emit('joinGame', { gameId, nickname });

        // Limpiar después de intentar
        localStorage.removeItem('reconnect_game');
      } catch (error) {
        console.error('Error al re-unirse:', error);
        localStorage.removeItem('reconnect_game');
      }
    }
  }
});
```

#### **Manejo de Reconexión en `useGame.ts`**

```typescript
// composables/useGame.ts

const handleReconnection = () => {
  const { on } = useSocket();

  // Cuando te re-unes después de reconectar
  on<{ data: { game: Game; player: Player } }>('joinedGame', async (data) => {
    console.log('Re-unido exitosamente a la partida');

    game.value = data.data.game;
    currentPlayer.value = data.data.player;
    players.value = data.data.game.players || [];

    // Si la partida ya empezó, fetch cartas
    if (data.data.game.status === 'in_progress') {
      const { fetchCardsByIds } = useCards();
      myCards.value = await fetchCardsByIds(data.data.player.cards);
      isMyTurn.value = data.data.game.currentTurnPlayerId === data.data.player.id;

      // Navegar al tablero si no estás ahí
      if (route.path !== `/game/${data.data.game.id}`) {
        navigateTo(`/game/${data.data.game.id}`);
      }
    }
  });
};

// Llamar en onMounted
onMounted(() => {
  setupListeners();
  handleReconnection();
});
```

#### **Limitaciones y Consideraciones**

⚠️ **Limitaciones actuales:**
- El backend **NO persiste** el estado de desconexión temporal
- Al reconectar, necesitas **re-unirte** a la partida manualmente
- Si la partida finalizó mientras estabas desconectado, no podrás re-unirte
- Si todos los jugadores se desconectaron, la partida puede terminar

✅ **Mejores prácticas:**
1. **Guardar estado en localStorage** antes de desconectar
2. **Re-unirse automáticamente** al reconectar
3. **Mostrar indicador visual** de reconexión en la UI
4. **Sincronizar estado** con `getGameState()` después de re-unirse
5. **Manejar errores** si la partida ya no existe

#### **Indicador Visual de Reconexión**

Agregar en el layout o componente global:

```vue
<template>
  <div v-if="!isConnected" class="reconnecting-banner">
    ⚠️ Conexión perdida. Reconectando...
  </div>
</template>

<script setup>
const { isConnected } = useSocket();
</script>

<style scoped>
.reconnecting-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ff9800;
  color: white;
  padding: 1rem;
  text-align: center;
  z-index: 9999;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
```

### Persistencia con localStorage

```typescript
// composables/useGame.ts

// Guardar estado
watch(currentPlayer, (player) => {
  if (player && process.client) {
    localStorage.setItem('currentPlayer', JSON.stringify(player));
  }
});

// Restaurar al cargar
onMounted(() => {
  if (process.client) {
    const saved = localStorage.getItem('currentPlayer');
    if (saved) {
      currentPlayer.value = JSON.parse(saved);
    }
  }
});
```

---

## 🎯 Próximos Pasos

1. **Instalar Socket.IO:** `pnpm add socket.io-client`
2. **Copiar tipos:** Crear `types/game.ts`
3. **Copiar composables:** `useSocket`, `useGame`, `useCards`
4. **Crear páginas:** `index`, `lobby/[id]`, `game/[id]`
5. **Crear componentes:** `Card`, `RoundResult`, `GameFinished`
6. **Configurar:** `nuxt.config.ts` y `.env`
7. **Probar:** Correr `pnpm dev`

---

¿Necesitas ayuda con alguna parte específica de la integración con Nuxt?
