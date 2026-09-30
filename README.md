# js_lotus_threejs

## Play it now: https://pemmyz.github.io/js_lotus_threejs/


# AMIGA TURBO RACER

A browser-based retro arcade racing game inspired by the look and feel of classic Amiga-era racing games. Built with HTML, CSS, JavaScript and Three.js, it features low-poly 3D racing, configurable circuits and environments, AI opponents, split-screen multiplayer, turbo, fuel, pit stops, mobile touch controls and a CRT-style presentation.

## Features

- Low-poly 3D arcade racing
- Amiga-inspired retro visual style
- Three.js r128 rendering
- Single-player racing
- Two-player horizontal split-screen racing
- Configurable AI opponents:
  - 0 — Solo
  - 1 AI
  - 3 AI
  - 5 AI
  - 9 AI
  - 19 AI — Full Grid
  - 50 AI — Developer Chaos
- Multiple circuits:
  - Original Grand Prix
  - Serpentine Twists — Forest
  - Canyon Dunes — Desert
  - Devil's Peak — Mountain
  - Frozen Fjord — Snow
  - Cyber Vale — Night
- Environment selection for the original circuit:
  - Forest Green
  - Desert Sun
  - Alpine Peak
  - Snow Ridge
  - Midnight Run
- Clockwise / counter-clockwise racing option
- Procedurally/randomized track support with visible track seed
- Practice Mode
- Rematch and new-track options
- Fuel management
- Turbo boost
- Pit refueling
- Race position, lap, time and speed HUD
- Minimap
- Race countdown
- Camera shake option
- Adjustable sound volume
- High / Medium / Low quality settings
- Fullscreen / mobile mode
- Touch steering and driving controls
- Keyboard controls
- CRT scanline overlay
- Retro arcade menus and HUD
- Developer menu with AI and car testing controls

## Controls

### Player 1

| Action | Keyboard / Touch |
|---|---|
| Steer left | Left Arrow / Touch ◀ |
| Steer right | Right Arrow / Touch ▶ |
| Accelerate | Up Arrow / Touch ▲ |
| Brake / reverse | Down Arrow / Touch ▼ |
| Turbo | Right Shift / Touch ⚡ |

### Player 2

| Action | Keyboard |
|---|---|
| Steer left | A |
| Steer right | D |
| Accelerate | W |
| Brake / reverse | S |
| Turbo | Space |

The game also includes a mobile mode with large touch controls designed for phones and tablets.

## Game Modes

### Single Player

Race against the configured number of AI opponents. The default configuration uses 3 AI cars.

### Two Player Split Screen

Two local players can race simultaneously using a horizontal split-screen layout. Player 1 occupies the upper half and Player 2 the lower half.

### Practice Mode

Practice without the normal competitive race setup.

## Race Configuration

The main menu provides configuration for:

- Circuit / map
- Environment
- Racing direction
- AI opponent count
- Track seed

The Options screen provides:

- Graphics quality
- Environment
- Number of laps
- Sound volume
- Camera shake

The default race length is 3 laps, with 2 and 5 lap options also available.

## Developer Tools

The `DEV` menu provides testing controls including:

- Disable AI vs Cars
- Disable AI vs Environment
- Infinite Turbo
- Set 50 Cars
- Add +5 Cars

These options are intended for development and stress testing.

## Project Structure

The game is divided into separate JavaScript modules:

```text
AMIGA-TURBO-RACER/
├── index.html
├── style.css
├── audio.js
├── track.js
├── cars.js
└── main.js
```

### `index.html`

Defines the game interface, menus, HUD, split-screen layout, minimap, countdown, touch controls and script loading order.

The HTML loads Three.js r128 from the CDN and then loads the game modules in this order:

```text
audio.js
track.js
cars.js
main.js
```

### `style.css`

Contains the complete visual presentation, including:

- Retro arcade UI
- HUD
- Menus
- CRT effect
- Split-screen divider
- Mobile controls
- Responsive scaling
- Touch interaction styling
- Neon/arcade typography

The interface uses **Press Start 2P** and **Chakra Petch** from Google Fonts.

### `audio.js`

Audio system for the game.

### `track.js`

Track and circuit generation/configuration.

### `cars.js`

Car and opponent-related game logic.

### `main.js`

Main game logic, rendering, game states, input handling and overall coordination.

## Technology

- HTML5
- CSS3
- JavaScript
- Three.js r128
- WebGL
- Google Fonts

Three.js is loaded directly from cdnjs:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

## Running Locally

No build system is required for the basic project.

Because the project uses JavaScript modules/files and external resources, a local HTTP server is recommended instead of opening `index.html` directly.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Browser Support

The game is intended for modern browsers with WebGL support.

Recommended:

- Chromium / Chrome
- Firefox
- Microsoft Edge
- Other modern WebGL-capable browsers

Performance can vary depending on GPU, browser, resolution, number of AI cars and selected quality level.

## Mobile

The interface includes a dedicated mobile mode.

Mobile features include:

- Fullscreen/mobile toggle
- Touch steering
- Touch acceleration
- Touch braking
- Touch turbo
- Large touch buttons
- Responsive HUD
- Responsive minimap
- Mobile-friendly menu scaling

The stylesheet explicitly locks the viewport and disables normal touch scrolling while mobile mode is active.

## Visual Style

The presentation deliberately combines modern WebGL 3D rendering with a retro arcade aesthetic:

- Low-poly scenery
- Neon cyan, yellow, red and blue UI elements
- Press Start 2P pixel-style typography
- CRT scanlines
- Glowing HUD elements
- Arcade-style menus
- Split-screen race divider
- Retro motorsport presentation


## License

This project is licensed under the **MIT License** — free to use, modify, and redistribute.
