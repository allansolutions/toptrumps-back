# 🎴 Top Trumps Backend

Backend en tiempo real para un juego de Top Trumps multijugador construido con NestJS, TypeORM, SQLite y WebSockets (Socket.io).

## 🚀 Características

- ⚡ **API REST** completa con NestJS
- 🔌 **WebSockets en tiempo real** con Socket.io
- 💾 **Base de datos SQLite** con TypeORM
- 🎮 **Sistema de juego completo** con turnos y comparación de atributos
- 🃏 **25 cartas predefinidas** con diferentes rarezas
- 🏆 **Sistema de puntuación** y determinación de ganador
- 📊 **Historial de rondas** por partida
- 🎯 **Listo para pair programming**

## 📋 Requisitos

- Node.js 18+
- pnpm 8+

## 🛠️ Instalación

```bash
# Instalar dependencias
pnpm install

# Poblar la base de datos con cartas de ejemplo
pnpm run seed
```

## ▶️ Ejecución

```bash
# Modo desarrollo (con hot reload)
pnpm run start:dev

# Modo producción
pnpm run build
pnpm run start:prod
```

El servidor se ejecutará en `http://localhost:3000`

## 🎮 Cómo funciona el juego

### 1. Crear una partida
Un jugador crea una nueva partida (máximo 2 jugadores por partida).

### 2. Unirse a la partida
Otro jugador se une usando el ID de la partida.

### 3. Prepararse
Ambos jugadores marcan que están listos.

### 4. Inicio automático
Una vez ambos listos, el sistema distribuye 10 cartas aleatorias a cada jugador.

### 5. Jugar rondas
- El jugador en turno selecciona una carta y un atributo (power, speed, intelligence, defense, agility)
- El oponente juega una carta aleatoria
- Se comparan los valores del atributo seleccionado
- El ganador obtiene un punto
- Las cartas jugadas se descartan

### 6. Victoria
El juego termina cuando un jugador se queda sin cartas. Gana quien tenga más puntos.

## 🌐 API REST Endpoints

### Cards
- `GET /cards` - Obtener todas las cartas
- `GET /cards/:id` - Obtener una carta específica
- `GET /cards/random?count=10` - Obtener cartas aleatorias
- `POST /cards` - Crear una nueva carta
- `PATCH /cards/:id` - Actualizar una carta
- `DELETE /cards/:id` - Eliminar una carta

### Games
- `GET /games` - Listar todas las partidas
- `GET /games/waiting` - Listar partidas esperando jugadores
- `GET /games/:id` - Obtener detalles de una partida
- `POST /games` - Crear una nueva partida
- `PATCH /games/:id/start` - Iniciar partida (manual)
- `DELETE /games/:id` - Eliminar partida

## 🔌 WebSocket Events

### Cliente → Servidor

#### `createGame`
Crear una nueva partida.
```typescript
socket.emit('createGame', { maxPlayers: 2 });
```

#### `joinGame`
Unirse a una partida existente.
```typescript
socket.emit('joinGame', {
  gameId: 1,
  nickname: 'Player1'
});
```

#### `playerReady`
Marcar que el jugador está listo.
```typescript
socket.emit('playerReady', {
  gameId: 1,
  playerId: 1
});
```

#### `playCard`
Jugar una carta.
```typescript
socket.emit('playCard', {
  gameId: 1,
  playerId: 1,
  cardId: 5,
  selectedAttribute: 'power' // power, speed, intelligence, defense, agility
});
```

#### `getGameState`
Obtener el estado actual del juego.
```typescript
socket.emit('getGameState', { gameId: 1 });
```

#### `leaveGame`
Salir de la partida.
```typescript
socket.emit('leaveGame', {
  gameId: 1,
  playerId: 1
});
```

### Servidor → Cliente

#### `gameCreated`
Partida creada exitosamente.
```typescript
{
  event: 'gameCreated',
  data: { id, status, maxPlayers, ... }
}
```

#### `playerJoined`
Un jugador se unió a la partida.
```typescript
{
  player: { id, nickname, ... },
  totalPlayers: 2,
  maxPlayers: 2
}
```

#### `playerReady`
Un jugador está listo.
```typescript
{
  playerId: 1,
  allReady: true
}
```

#### `gameStarted`
La partida ha comenzado.
```typescript
{
  game: { ... },
  players: [
    { id: 1, cards: [1,2,3,...], score: 0 },
    { id: 2, cards: [11,12,13,...], score: 0 }
  ]
}
```

#### `roundResult`
Resultado de una ronda.
```typescript
{
  round: { ... },
  winner: 1, // 0 para empate
  card1: { id, name, power, ... },
  card2: { id, name, power, ... },
  selectedAttribute: 'power'
}
```

#### `gameFinished`
La partida ha terminado.
```typescript
{
  winnerId: 1,
  game: { ... }
}
```

#### `playerDisconnected`
Un jugador se desconectó.
```typescript
{
  playerId: 1,
  nickname: 'Player1'
}
```

#### `error`
Error en la operación.
```typescript
{
  event: 'error',
  data: { message: 'Error message' }
}
```

## 📊 Base de Datos

### Entidades

#### Card
```typescript
{
  id: number
  name: string
  image?: string
  power: number (0-100)
  speed: number (0-100)
  intelligence: number (0-100)
  defense: number (0-100)
  agility: number (0-100)
  description?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  createdAt: Date
}
```

#### Game
```typescript
{
  id: number
  status: 'waiting' | 'in_progress' | 'finished'
  winnerId?: number
  maxPlayers: number
  currentTurnPlayerId?: number
  players: Player[]
  rounds: GameRound[]
  createdAt: Date
  updatedAt: Date
}
```

#### Player
```typescript
{
  id: number
  nickname: string
  socketId?: string
  cards: number[] // IDs de cartas
  score: number
  isReady: boolean
  gameId: number
  joinedAt: Date
}
```

#### GameRound
```typescript
{
  id: number
  gameId: number
  player1Id: number
  player2Id: number
  cardId1: number
  cardId2: number
  selectedAttribute: string
  card1Value: number
  card2Value: number
  winnerId: number
  playedAt: Date
}
```

## 🎨 Ejemplo de Cliente (HTML + JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Top Trumps</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <div id="game"></div>

  <script>
    const socket = io('http://localhost:3000');

    // Crear partida
    socket.emit('createGame', { maxPlayers: 2 });

    // Escuchar cuando se crea
    socket.on('gameCreated', (data) => {
      console.log('Game created:', data.data.id);
      // Unirse a la partida
      socket.emit('joinGame', {
        gameId: data.data.id,
        nickname: 'Player1'
      });
    });

    // Cuando se une exitosamente
    socket.on('joinedGame', (data) => {
      console.log('Joined game:', data.data);
      // Marcar como listo
      socket.emit('playerReady', {
        gameId: data.data.game.id,
        playerId: data.data.player.id
      });
    });

    // Cuando inicia la partida
    socket.on('gameStarted', (data) => {
      console.log('Game started!', data);
      // Jugar primera carta
      const myCards = data.players[0].cards;
      socket.emit('playCard', {
        gameId: data.game.id,
        playerId: data.players[0].id,
        cardId: myCards[0],
        selectedAttribute: 'power'
      });
    });

    // Resultado de la ronda
    socket.on('roundResult', (result) => {
      console.log('Round result:', result);
    });

    // Partida terminada
    socket.on('gameFinished', (data) => {
      console.log('Game finished! Winner:', data.winnerId);
    });
  </script>
</body>
</html>
```

## 🧪 Testing

```bash
# Tests unitarios
pnpm run test

# Tests e2e
pnpm run test:e2e

# Cobertura
pnpm run test:cov
```

## 🔧 Scripts disponibles

```bash
pnpm run start:dev    # Iniciar en modo desarrollo
pnpm run build        # Compilar proyecto
pnpm run start:prod   # Iniciar en producción
pnpm run seed         # Poblar DB con cartas
pnpm run lint         # Ejecutar linter
pnpm run format       # Formatear código
```

## 🗂️ Estructura del Proyecto

```
src/
├── cards/              # Módulo de cartas
│   ├── entities/
│   │   └── card.entity.ts
│   ├── dto/
│   │   ├── create-card.dto.ts
│   │   └── update-card.dto.ts
│   ├── cards.controller.ts
│   ├── cards.service.ts
│   └── cards.module.ts
├── game/               # Módulo de juego
│   ├── entities/
│   │   ├── game.entity.ts
│   │   └── game-round.entity.ts
│   ├── dto/
│   │   ├── create-game.dto.ts
│   │   ├── join-game.dto.ts
│   │   └── play-card.dto.ts
│   ├── game.controller.ts
│   ├── game.service.ts
│   ├── game.gateway.ts  # WebSocket Gateway
│   └── game.module.ts
├── players/            # Módulo de jugadores
│   ├── entities/
│   │   └── player.entity.ts
│   ├── dto/
│   │   └── create-player.dto.ts
│   ├── players.service.ts
│   └── players.module.ts
├── database/           # Seeds y utilidades DB
│   ├── seeds/
│   │   └── cards.seed.ts
│   └── seed.ts
├── app.module.ts
└── main.ts
```

## 🌍 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Database Configuration
DB_TYPE=sqlite
DB_DATABASE=toptrumps.db
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Application
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 📝 Notas de Desarrollo

- **SQLite** es perfecto para desarrollo pero considera PostgreSQL para producción
- **DB_SYNCHRONIZE=true** sincroniza el schema automáticamente (solo desarrollo)
- Las **cartas se distribuyen aleatoriamente** al iniciar cada partida
- El **oponente juega cartas aleatorias** (puedes implementar IA más adelante)
- Los **WebSockets** se desconectan automáticamente al cerrar el navegador

## 🎯 Próximas Mejoras

- [ ] Autenticación JWT para usuarios persistentes
- [ ] Sistema de rankings y estadísticas
- [ ] Modo de juego con más de 2 jugadores
- [ ] IA para oponente en modo single player
- [ ] Chat en partida
- [ ] Animaciones y efectos especiales
- [ ] Sistema de mazos personalizados
- [ ] Torneos y ligas

## 📄 Licencia

UNLICENSED - Proyecto privado

## 👥 Contribución

Este proyecto está configurado para pair programming. ¡Comparte el código y programa en equipo!

---

**Desarrollado con ❤️ usando NestJS, TypeORM y Socket.io**
