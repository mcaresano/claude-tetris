# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris implementado en JavaScript vanilla (ES6+) con HTML5 Canvas y CSS. Sin dependencias, sin `package.json`, sin build step ni transpilador.

## Running

No hay build ni tests. Para jugar/probar cambios, abrir `index.html` directamente en el navegador o servir el directorio con cualquier servidor estático:

```bash
python3 -m http.server 8000   # o: npx serve .
```

Luego abrir `http://localhost:8000`.

## Architecture

Todo el código vive en tres archivos planos que se cargan directamente (sin módulos ES):

- **`index.html`** — DOM: `<canvas id="board">` (300×600, tablero 10×20 a 30px/celda), `<canvas id="next-canvas">` (preview de la siguiente pieza), panel de score/lines/level, overlay de pausa/game-over.
- **`style.css`** — tema dark/retro arcade.
- **`game.js`** — toda la lógica de juego, en un único scope global (sin clases, funciones + variables globales `board, current, next, score, lines, level, paused, gameOver, ...`).

Puntos clave del modelo (`game.js`):

- **Tablero**: matriz `ROWS × COLS`, cada celda es `0` (vacía) o índice de color `1–7`.
- **Piezas** (`PIECES`): matrices cuadradas fijas (I, O, T, S, Z, J, L). Rotación vía `rotateCW` (transposición + reverso de filas) — no hay tabla SRS, es una rotación simple.
- **Colisiones** (`collide`): límites del tablero + solape con bloques fijados.
- **Wall kicks** (`tryRotate`): tras rotar, prueba offsets `[0, -1, 1, -2, 2]` hasta encontrar uno sin colisión.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula `dt` y baja la pieza al superar `dropInterval`; si no puede bajar, llama a `lockPiece()`.
- **`lockPiece()`**: `merge()` (fija la pieza al tablero) → `clearLines()` → `spawn()` (siguiente pieza pasa a actual, se genera una nueva `next`; si la nueva pieza colisiona al aparecer, `endGame()`).
- **Puntuación**: `LINE_SCORES = [0, 100, 300, 500, 800]` × `level`; hard drop suma 2 pts/celda, soft drop 1 pt/fila.
- **Nivel/velocidad**: sube cada 10 líneas; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece** (`ghostY`): proyecta la caída y se dibuja con `globalAlpha = 0.2`.

Todo el dibujado pasa por `drawBlock()` (compartida entre tablero y preview), `drawGrid()`, `draw()` y `drawNext()`.

## Tuning

Constantes ajustables en la cabecera de `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` inicial. Si se cambia `COLS`/`ROWS`/`BLOCK`, hay que actualizar también `width`/`height` de `<canvas id="board">` en `index.html` (`COLS × BLOCK` × `ROWS × BLOCK`).
