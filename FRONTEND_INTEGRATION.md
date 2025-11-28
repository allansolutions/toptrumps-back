# Frontend Integration Guide - Top Trumps Multiplayer

Esta guía muestra cómo integrar el backend de Top Trumps con cualquier frontend (React, Vue, Angular, etc.) usando Socket.IO.

---

## 📦 Instalación

```bash
npm install socket.io-client
# o
yarn add socket.io-client
# o
pnpm add socket.io-client
```

---

## 🔌 Conexión Inicial

### TypeScript/JavaScript

```typescript
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3000';
const socket: Socket = io(BACKEND_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Escuchar conexión
socket.on('connect', () => {
  console.log('✅ Conectado al servidor:', socket.id);
});

// Escuchar desconexión
socket.on('disconnect', () => {
  console.log('❌ Desconectado del servidor');
});

// Escuchar errores
socket.on('error', (error) => {
  console.error('Error:', error.message);
  alert(`Error: ${error.message}`);
});
```

---

## 🎮 Flujo Completo del Juego

### 1. Crear Partida

```typescript
// Estado del juego
interface Game {
  id: number;
  status: 'waiting' | 'in_progress' | 'finished';
  maxPlayers: number;
  currentTurnPlayerId: number;
  currentRound: number;
  winnerId?: number;
}

// Crear partida
function createGame(maxPlayers: number = 4) {
  socket.emit('createGame', { maxPlayers });
}

// Escuchar confirmación
socket.on('gameCreated', (data: { data: Game }) => {
  const game = data.data;
  console.log('Partida creada:', game.id);

  // Guardar gameId en estado
  setGameId(game.id);

  // Redirigir a sala de espera
  navigateToLobby(game.id);
});
```

---

### 2. Unirse a Partida

```typescript
interface Player {
  id: number;
  nickname: string;
  socketId: string;
  cards: number[];
  score: number;
  isReady: boolean;
  gameId: number;
}

// Unirse a partida existente
function joinGame(gameId: number, nickname: string) {
  socket.emit('joinGame', { gameId, nickname });
}

// Confirmación de entrada
socket.on('joinedGame', (data: { data: { game: Game; player: Player } }) => {
  const { game, player } = data.data;
  console.log('Te uniste a la partida:', game.id);
  console.log('Tu ID de jugador:', player.id);

  // Guardar datos locales
  setCurrentPlayer(player);
  setGame(game);
});

// Notificación cuando otro jugador se une
socket.on('playerJoined', (data: { player: Player; totalPlayers: number; maxPlayers: number }) => {
  console.log(`${data.player.nickname} se unió (${data.totalPlayers}/${data.maxPlayers})`);

  // Actualizar lista de jugadores en UI
  addPlayerToList(data.player);
  updatePlayerCount(data.totalPlayers, data.maxPlayers);
});
```

---

### 3. Marcar como Listo (Ready)

```typescript
function markPlayerReady(gameId: number, playerId: number) {
  socket.emit('playerReady', { gameId, playerId });
}

// Confirmación personal
socket.on('readyConfirmed', (data: { data: { allReady: boolean } }) => {
  console.log('Marcado como listo');

  if (data.data.allReady) {
    console.log('Todos listos - La partida comenzará pronto...');
    showMessage('¡Todos listos! Iniciando partida...');
  }
});

// Notificación de otros jugadores
socket.on('playerReady', (data: { playerId: number; allReady: boolean }) => {
  console.log(`Jugador ${data.playerId} está listo`);

  // Actualizar UI
  markPlayerAsReady(data.playerId);

  if (data.allReady) {
    showCountdown(3); // Countdown de 3 segundos
  }
});
```

---

### 4. Inicio de Partida (Auto-Start)

```typescript
interface Card {
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
}

// Auto-inicio cuando todos están ready
socket.on('gameStarted', (data: { game: Game; players: Player[] }) => {
  const { game, players } = data;
  console.log('¡La partida ha comenzado!');
  console.log('Jugadores:', players.length);
  console.log('Turno actual:', game.currentTurnPlayerId);

  // Guardar datos
  setGame(game);
  setPlayers(players);

  // Encontrar mi jugador
  const me = players.find(p => p.id === currentPlayer.id);
  if (me) {
    setMyCards(me.cards);
    console.log('Mis cartas:', me.cards);
  }

  // Verificar si es mi turno
  const isMyTurn = game.currentTurnPlayerId === currentPlayer.id;
  setIsMyTurn(isMyTurn);

  if (isMyTurn) {
    showMessage('¡Es tu turno! Selecciona una carta');
  }

  // Redirigir a tablero de juego
  navigateToGameBoard();
});
```

---

### 5. Obtener Detalles de Cartas

```typescript
// Fetch de cartas desde REST API
async function fetchCards(cardIds: number[]): Promise<Card[]> {
  const promises = cardIds.map(id =>
    fetch(`${BACKEND_URL}/cards/${id}`).then(r => r.json())
  );
  return Promise.all(promises);
}

// Uso
const myCards = await fetchCards(currentPlayer.cards);
console.log('Mis cartas completas:', myCards);

// O fetch de todas las cartas
async function fetchAllCards(): Promise<Card[]> {
  const response = await fetch(`${BACKEND_URL}/cards`);
  return response.json();
}
```

---

### 6. Jugar Carta (Play Card)

```typescript
type Attribute = 'power' | 'speed' | 'intelligence' | 'defense' | 'agility';

function playCard(
  gameId: number,
  playerId: number,
  cardId: number,
  selectedAttribute: Attribute
) {
  socket.emit('playCard', {
    gameId,
    playerId,
    cardId,
    selectedAttribute,
  });
}

// Ejemplo de UI
function handleCardSelection(card: Card, attribute: Attribute) {
  if (!isMyTurn) {
    alert('¡No es tu turno!');
    return;
  }

  // Confirmación
  const confirmed = confirm(
    `¿Jugar "${card.name}" con atributo "${attribute}"?\n` +
    `Valor: ${card[attribute]}`
  );

  if (confirmed) {
    playCard(game.id, currentPlayer.id, card.id, attribute);
    setIsMyTurn(false); // Deshabilitar UI
  }
}

// Confirmación personal
socket.on('cardPlayed', () => {
  console.log('Carta jugada exitosamente');
});
```

---

### 7. Resultado de Ronda (Round Result)

```typescript
interface PlayedCard {
  playerId: number;
  nickname: string;
  cardId: number;
  cardName: string;
  value: number;
}

socket.on('roundResult', async (data: {
  playedCards: PlayedCard[];
  winnerId: number;
  nextTurnPlayerId: number;
  selectedAttribute: Attribute;
}) => {
  console.log('Resultado de la ronda:');
  console.log('Atributo:', data.selectedAttribute);
  console.log('Cartas jugadas:', data.playedCards);
  console.log('Ganador:', data.winnerId);
  console.log('Próximo turno:', data.nextTurnPlayerId);

  // Mostrar animación de resultado
  showRoundResultAnimation({
    cards: data.playedCards,
    attribute: data.selectedAttribute,
    winnerId: data.winnerId,
  });

  // Actualizar scores
  data.playedCards.forEach(card => {
    if (card.playerId === data.winnerId) {
      incrementPlayerScore(card.playerId);
    }
  });

  // Eliminar cartas jugadas de los mazos
  data.playedCards.forEach(card => {
    removeCardFromPlayer(card.playerId, card.cardId);
  });

  // Actualizar turno
  setIsMyTurn(data.nextTurnPlayerId === currentPlayer.id);

  if (data.nextTurnPlayerId === currentPlayer.id) {
    setTimeout(() => {
      showMessage('¡Es tu turno!');
    }, 3000); // Esperar animación
  }
});
```

---

### 8. Fin de Partida

```typescript
socket.on('gameFinished', async (data: { winnerId: number; reason?: string }) => {
  console.log('¡Partida terminada!');
  console.log('Ganador:', data.winnerId);

  // Obtener jugadores finales
  const finalPlayers = await getPlayers(game.id);
  const winner = finalPlayers.find(p => p.id === data.winnerId);

  // Mostrar pantalla de victoria
  if (data.winnerId === currentPlayer.id) {
    showVictoryScreen({
      title: '🎉 ¡GANASTE!',
      message: `Felicidades ${winner?.nickname}`,
      score: winner?.score,
      players: finalPlayers,
    });
  } else {
    showDefeatScreen({
      title: '😢 Partida Terminada',
      message: `${winner?.nickname} ganó con ${winner?.score} puntos`,
      yourScore: currentPlayer.score,
      players: finalPlayers,
    });
  }

  // Opciones
  showButtons([
    { label: 'Jugar de Nuevo', action: () => createGame(game.maxPlayers) },
    { label: 'Volver al Lobby', action: () => navigateToHome() },
  ]);
});
```

---

### 9. Desconexiones

```typescript
socket.on('playerDisconnected', (data: {
  playerId: number;
  nickname: string;
  nextTurnPlayerId?: number;
}) => {
  console.log(`${data.nickname} se desconectó`);

  // Mostrar notificación
  showNotification(`${data.nickname} abandonó la partida`, 'warning');

  // Eliminar de lista
  removePlayerFromList(data.playerId);

  // Si era mi turno y ahora es de otro
  if (data.nextTurnPlayerId) {
    setIsMyTurn(data.nextTurnPlayerId === currentPlayer.id);
  }
});
```

---

### 10. Estado del Juego (Query State)

```typescript
// Obtener estado actual
function getGameState(gameId: number) {
  socket.emit('getGameState', { gameId });
}

socket.on('gameState', (data: { data: { game: Game; players: Player[] } }) => {
  const { game, players } = data.data;
  console.log('Estado actual:', game);
  console.log('Jugadores:', players);

  // Sincronizar UI
  setGame(game);
  setPlayers(players);
});
```

---

## 🎨 Ejemplo Completo - React Component

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface GameState {
  socket: Socket | null;
  game: Game | null;
  players: Player[];
  currentPlayer: Player | null;
  myCards: Card[];
  isMyTurn: boolean;
}

export function TopTrumpsGame() {
  const [state, setState] = useState<GameState>({
    socket: null,
    game: null,
    players: [],
    currentPlayer: null,
    myCards: [],
    isMyTurn: false,
  });

  useEffect(() => {
    // Conectar socket
    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      console.log('Conectado');
    });

    socket.on('gameCreated', (data) => {
      setState(prev => ({ ...prev, game: data.data }));
    });

    socket.on('joinedGame', (data) => {
      setState(prev => ({
        ...prev,
        game: data.data.game,
        currentPlayer: data.data.player,
      }));
    });

    socket.on('gameStarted', async (data) => {
      const me = data.players.find(p => p.id === state.currentPlayer?.id);
      const cards = await fetchCards(me.cards);

      setState(prev => ({
        ...prev,
        game: data.game,
        players: data.players,
        myCards: cards,
        isMyTurn: data.game.currentTurnPlayerId === me.id,
      }));
    });

    socket.on('roundResult', (data) => {
      // Actualizar cartas
      const updatedCards = state.myCards.filter(
        card => !data.playedCards.some(pc => pc.cardId === card.id)
      );

      setState(prev => ({
        ...prev,
        myCards: updatedCards,
        isMyTurn: data.nextTurnPlayerId === state.currentPlayer?.id,
      }));
    });

    socket.on('gameFinished', (data) => {
      alert(`Ganador: ${data.winnerId}`);
    });

    setState(prev => ({ ...prev, socket }));

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreateGame = () => {
    state.socket?.emit('createGame', { maxPlayers: 4 });
  };

  const handleJoinGame = (gameId: number, nickname: string) => {
    state.socket?.emit('joinGame', { gameId, nickname });
  };

  const handleReady = () => {
    state.socket?.emit('playerReady', {
      gameId: state.game?.id,
      playerId: state.currentPlayer?.id,
    });
  };

  const handlePlayCard = (card: Card, attribute: Attribute) => {
    if (!state.isMyTurn) return;

    state.socket?.emit('playCard', {
      gameId: state.game?.id,
      playerId: state.currentPlayer?.id,
      cardId: card.id,
      selectedAttribute: attribute,
    });
  };

  return (
    <div>
      <h1>Top Trumps Multiplayer</h1>

      {!state.game && (
        <button onClick={handleCreateGame}>Crear Partida</button>
      )}

      {state.game?.status === 'waiting' && (
        <button onClick={handleReady}>Listo</button>
      )}

      {state.isMyTurn && (
        <div>
          <h2>¡Tu turno!</h2>
          {state.myCards.map(card => (
            <CardComponent
              key={card.id}
              card={card}
              onPlay={handlePlayCard}
            />
          ))}
        </div>
      )}

      <PlayersList players={state.players} />
    </div>
  );
}

async function fetchCards(ids: number[]): Promise<Card[]> {
  const promises = ids.map(id =>
    fetch(`http://localhost:3000/cards/${id}`).then(r => r.json())
  );
  return Promise.all(promises);
}
```

---

## 📊 REST API Endpoints

Además de WebSocket, puedes usar estos endpoints REST:

### **Cartas**
```typescript
// Obtener todas las cartas
GET /cards
Response: Card[]

// Obtener carta específica
GET /cards/:id
Response: Card

// Obtener cartas random (para preview)
GET /cards/random?count=10
Response: Card[]
```

### **Juegos**
```typescript
// Listar partidas
GET /games
Response: Game[]

// Obtener partida específica
GET /games/:id
Response: Game

// Partidas en espera
GET /games/waiting
Response: Game[]

// Crear partida (alternativa a WebSocket)
POST /games
Body: { maxPlayers: number }
Response: Game
```

---

## 🎯 Buenas Prácticas

### 1. **Manejo de Errores**
```typescript
socket.on('error', (error) => {
  console.error('Error del servidor:', error.message);

  // Mostrar en UI
  showToast(error.message, 'error');

  // Casos especiales
  if (error.message.includes('not your turn')) {
    disableCardSelection();
  }
});
```

### 2. **Reconexión Automática**
```typescript
socket.on('disconnect', () => {
  console.log('Desconectado - Intentando reconectar...');
  showReconnectingOverlay();
});

socket.on('connect', () => {
  console.log('Reconectado');
  hideReconnectingOverlay();

  // Re-sincronizar estado
  if (gameId) {
    socket.emit('getGameState', { gameId });
  }
});
```

### 3. **Validación Client-Side**
```typescript
function playCard(card: Card, attribute: Attribute) {
  // Validar que es mi turno
  if (!isMyTurn) {
    alert('No es tu turno');
    return;
  }

  // Validar que tengo la carta
  if (!myCards.some(c => c.id === card.id)) {
    alert('No tienes esta carta');
    return;
  }

  // Enviar
  socket.emit('playCard', {
    gameId,
    playerId,
    cardId: card.id,
    selectedAttribute: attribute,
  });
}
```

### 4. **Optimistic Updates**
```typescript
function playCardOptimistic(card: Card, attribute: Attribute) {
  // 1. Actualizar UI inmediatamente
  setMyCards(prev => prev.filter(c => c.id !== card.id));
  setIsMyTurn(false);
  showWaitingMessage('Esperando resultado...');

  // 2. Enviar al servidor
  socket.emit('playCard', { gameId, playerId, cardId: card.id, selectedAttribute: attribute });

  // 3. El servidor confirmará o revertirá en roundResult
}
```

---

## 🔐 Seguridad

```typescript
// NUNCA confiar solo en validaciones client-side
// El servidor SIEMPRE valida:
// - Que sea tu turno
// - Que tengas la carta
// - Que el juego esté en progreso
// - Que el atributo sea válido

// Ejemplo de validación doble
function canPlayCard(card: Card): boolean {
  // Client-side (UI feedback rápido)
  if (!isMyTurn) return false;
  if (!myCards.includes(card)) return false;
  if (game?.status !== 'in_progress') return false;

  return true; // Server-side validará de nuevo
}
```

---

## 🎨 UI/UX Recommendations

### Estado de Turno
```typescript
{isMyTurn ? (
  <div className="your-turn">
    <h2>¡Es tu turno!</h2>
    <div className="cards-selectable">
      {myCards.map(card => <Card key={card.id} card={card} onClick={handleCardClick} />)}
    </div>
  </div>
) : (
  <div className="waiting-turn">
    <h2>Esperando a {currentPlayerName}...</h2>
    <Spinner />
  </div>
)}
```

### Animación de Resultado
```typescript
// Mostrar todas las cartas jugadas
<div className="round-result">
  <h3>Resultado - Atributo: {selectedAttribute}</h3>
  <div className="played-cards">
    {playedCards.map(pc => (
      <div key={pc.playerId} className={pc.playerId === winnerId ? 'winner' : ''}>
        <img src={getCardImage(pc.cardId)} />
        <p>{pc.nickname}</p>
        <p>{pc.cardName}</p>
        <p className="value">{pc.value}</p>
      </div>
    ))}
  </div>
</div>
```

---

## 📱 Responsive Design

```typescript
// Adaptar UI según número de jugadores
const gridColumns = players.length <= 3 ? players.length : 3;

<div style={{
  display: 'grid',
  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
  gap: '1rem'
}}>
  {players.map(player => <PlayerCard key={player.id} player={player} />)}
</div>
```

---

## 🚀 Deploy

### Variables de Entorno
```bash
# Frontend .env
VITE_BACKEND_URL=https://api.toptrumps.com
# o
REACT_APP_BACKEND_URL=https://api.toptrumps.com
```

### CORS Production
```typescript
// Backend debe permitir tu dominio
const socket = io(process.env.VITE_BACKEND_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
});
```

---

¿Necesitas ejemplos específicos para Vue, Angular, Svelte u otro framework?
