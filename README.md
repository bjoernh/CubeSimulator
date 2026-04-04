# LEDCube Simulator

Browser-based 3D LED Cube Simulator. Connects to a running [matrixserver](https://github.com/bjoernh/matrixserver) via WebSocket and renders the LED state in real time using Three.js.

![LEDCube Simulator Screenshot](LEDCubeSim.jpg)

## 🌐 Try it live

Open in your browser — no installation required:
**https://bjoernh.github.io/CubeSimulator/**

Enter the WebSocket address of your matrixserver (`ws://localhost:1337`) and click **Connect**.

## Architecture

```
Example App (C++) ──TCP :2017──► matrixserver (C++)
                                      │
                                 WebSocketSimulatorRenderer
                                      │ WebSocket :1337
                                      ▼
                              Browser (this app)
                           ThreeJS 3D LED Cube Renderer
```

## Development

```bash
cd web
npm install
npm run dev      # dev server at http://localhost:5173/CubeSimulator/
npm test         # run Vitest unit tests
npm run build    # production build → web/dist/
```

## matrixserver Setup

Build and run `matrix_server_simulator` from the [matrixserver](https://github.com/bjoernh/matrixserver) repo:

```bash
mkdir build && cd build && cmake .. && make
./server_simulator/matrix_server_simulator
```

Configure the simulator address in `matrixServerConfig.json`:
```json
{
  "simulatorAddress": "0.0.0.0",
  "simulatorPort": "1337"
}
```

## Deploy

Push to `feature/browser-websocket` or `master` — GitHub Actions builds and deploys automatically to GitHub Pages.

> **Note**: For the browser to connect, the matrixserver WebSocket port must be reachable from the client. If running locally, use `ws://localhost:1337`. For remote servers, consider a reverse proxy with TLS (`wss://`).
