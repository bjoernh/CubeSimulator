# AI Agent Documentation for CubeSimulator

This repository contains the browser-based 3D LED Cube Simulator, built to replace the legacy Electron app. It connects to the `matrixserver` application via WebSockets and visualizes LED matrix rendering in real-time.

## Tech Stack Overview
- **Vite:** Build tool and fast development server (downgraded to Vite 5 for Node.js 18 compatibility, if applicable, but fully modern).
- **TypeScript:** Strict type checking across the entire frontend.
- **Three.js:** Used for 3D rendering (Cameras, Geometries, Textures). Important: Uses modern `THREE.DataTexture` with `THREE.RGBAFormat` (4 bytes/pixel) because `RGBFormat` was removed in Three.js r152+.
- **Protobuf.js:** Native browser decoding of binary Protocol Buffers coming from the MatrixServer.
- **Vitest:** Used for Test-Driven Development (TDD). 

## Architecture
- **`web/` Directory:** The root of the pure frontend browser application.
- **`web/src/LedScreen.ts`:** Manages the Three.js mesh and `DataTexture` corresponding to a single LED matrix screen. Expects RGB24 payloads but copies them into an internal RGBA buffer.
- **`web/src/WebSocketConnection.ts`:** Handles connecting to the C++ MatrixServer. Includes auto-reconnect backoff logic and handles parsing raw protobuf binary streams.
- **`web/src/CubeLayout.ts`:** Pure functional layout math for updating `THREE.Mesh` positions and rotations without needing a heavy DOM/WebGL context, making it highly testable.
- **`web/src/CustomCamera.ts`:** Wraps Three.js `OrbitControls` for Orthographic and Perspective camera control, including sensitivity parameters.
- **`web/src/main.ts`:** The main entry point that unites the rendering loop, UI (lil-gui), and WebSocket events.
- **`matrixserver` (C++):** A Boost.Beast WebSocket server (`WebSocketSimulatorRenderer`) is used on the matrixserver side. It sends binary `MatrixServerMessage` payloads without COBS overhead. 

## Important Concepts for Agents
1. **Testing First (TDD):** Any new structural logic within `web/src/` should be accompanied by Vitest unit tests in `web/tests/`. The project ensures high test coverage. Use `cd web && npm test` to verify logic.
2. **Three.js RGBA Requirement:** Keep in mind that modern Three.js `DataTexture` objects strictly expect `RGBAFormat`. Even if the incoming data from `matrixserver` is RGB (3 channels), the local `LedScreen` buffer translates it to 4 channels (`stride = i * 4`).
3. **Event-driven UI:** The `lil-gui` UI components are responsive. Sliders directly influence rendering without requiring a browser refresh. Changing Layout parameters instantly applies when in the proper display mode.
4. **Protobuf Files:** The `matrixserver.proto` file is located at `web/src/proto/matrixserver.proto` (and copied to `web/public/matrixserver.proto` during build so it can be dynamically loaded via `protobufjs` at runtime).

## Development Commands
```bash
cd web               # Move to the web application directory
npm install          # Install dependencies
npm run dev          # Launch the local development server (usually http://localhost:5173/CubeSimulator/)
npm test             # Run the full Vitest test suite
npm run build        # Compile production-ready assets to web/dist/ (used by GitHub Pages Action)
```

## MatrixServer Simulator
If testing the full stack, you must also be running the MatrixServer backend with the WebSocket simulator renderer locally:
```bash
cd matrixserver/build
./server_simulator --use-deprecated-tcp-connection  # Use this flag if falling back to the legacy TCP
./server_simulator                                  # Standard launch uses the new Boost.Beast WebSocket server on port 1337
```
