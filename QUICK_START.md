# 🚀 Inicio Rápido - Top Trumps Backend

## Instalación y Ejecución en 3 pasos

### 1️⃣ Instalar dependencias
```bash
pnpm install
```

### 2️⃣ Poblar la base de datos
```bash
pnpm run seed
```

### 3️⃣ Iniciar el servidor
```bash
pnpm run start:dev
```

✅ El servidor estará corriendo en **http://localhost:3000**

## 🧪 Prueba rápida

### Ver todas las cartas
```bash
curl http://localhost:3000/cards
```

### Crear una partida
```bash
curl -X POST http://localhost:3000/games -H "Content-Type: application/json" -d '{"maxPlayers": 2}'
```

### Ver partidas disponibles
```bash
curl http://localhost:3000/games/waiting
```

## 🔌 Conectar con WebSocket (JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Top Trumps Test</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <h1>Top Trumps - WebSocket Test</h1>
  <div id="output"></div>

  <script>
    const socket = io('http://localhost:3000');
    const output = document.getElementById('output');

    function log(message) {
      output.innerHTML += `<p>${JSON.stringify(message, null, 2)}</p>`;
    }

    // Crear partida
    socket.emit('createGame', { maxPlayers: 2 });

    // Escuchar eventos
    socket.on('gameCreated', (data) => {
      log({ event: 'gameCreated', data });

      // Unirse a la partida
      socket.emit('joinGame', {
        gameId: data.data.id,
        nickname: 'Player1'
      });
    });

    socket.on('joinedGame', (data) => {
      log({ event: 'joinedGame', data });

      // Marcar como listo
      socket.emit('playerReady', {
        gameId: data.data.game.id,
        playerId: data.data.player.id
      });
    });

    socket.on('gameStarted', (data) => {
      log({ event: 'gameStarted', data });
    });

    socket.on('error', (data) => {
      log({ event: 'error', data });
    });
  </script>
</body>
</html>
```

Guarda este HTML en un archivo y ábrelo en tu navegador para probar la conexión WebSocket.

## 📚 Endpoints Disponibles

### Cards
- `GET /cards` - Todas las cartas
- `GET /cards/:id` - Una carta específica
- `GET /cards/random?count=10` - Cartas aleatorias
- `POST /cards` - Crear carta
- `PATCH /cards/:id` - Actualizar carta
- `DELETE /cards/:id` - Eliminar carta

### Games
- `GET /games` - Todas las partidas
- `GET /games/waiting` - Partidas esperando jugadores
- `GET /games/:id` - Detalles de partida
- `POST /games` - Crear partida
- `PATCH /games/:id/start` - Iniciar partida
- `DELETE /games/:id` - Eliminar partida

### WebSocket Events
- `createGame` - Crear partida
- `joinGame` - Unirse a partida
- `playerReady` - Marcar listo
- `playCard` - Jugar carta
- `getGameState` - Ver estado
- `leaveGame` - Salir de partida

## 🎮 Flujo de Juego Completo

1. **Jugador 1**: Crea partida con `createGame`
2. **Jugador 2**: Se une con `joinGame`
3. **Ambos**: Marcan listo con `playerReady`
4. **Sistema**: Distribuye cartas automáticamente → evento `gameStarted`
5. **Jugadores**: Juegan cartas por turnos con `playCard`
6. **Sistema**: Emite `roundResult` después de cada ronda
7. **Fin**: Cuando un jugador se queda sin cartas → evento `gameFinished`

## 🛠️ Comandos Útiles

```bash
# Desarrollo
pnpm run start:dev        # Modo watch (hot reload)

# Producción
pnpm run build            # Compilar
pnpm run start:prod       # Ejecutar compilado

# Base de datos
pnpm run seed             # Repoblar cartas

# Calidad de código
pnpm run lint             # Linter
pnpm run format           # Formatear código

# Tests
pnpm run test             # Tests unitarios
pnpm run test:e2e         # Tests e2e
pnpm run test:cov         # Cobertura
```

## 🐛 Troubleshooting

### El servidor no inicia
1. Verifica que no haya otro proceso en el puerto 3000: `lsof -i :3000`
2. Reinstala dependencias: `rm -rf node_modules && pnpm install`

### No hay cartas en la base de datos
```bash
pnpm run seed
```

### WebSocket no conecta
1. Verifica CORS_ORIGIN en `.env`
2. Asegúrate de usar el puerto correcto (3000 por defecto)

## 📖 Documentación Completa

Para más detalles, consulta el **README.md** principal que incluye:
- Arquitectura completa del proyecto
- Documentación detallada de todos los eventos WebSocket
- Ejemplos de integración con frontend
- Estructura de la base de datos
- Guía de desarrollo avanzada

---

**¡Listo para empezar a programar! 🎉**
