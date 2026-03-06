# LEDCube Simulator

Browser-based 3D LED Cube Simulator. Connects to a running [matrixserver](https://github.com/gambiz/matrixserver) via WebSocket and renders the LED state in real time using Three.js.

## 🌐 Try it live

Open in your browser — no installation required:
**https://&lt;your-github-username&gt;.github.io/CubeSimulator/**

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

Build `server_simulator` from the [matrixserver](https://github.com/gambiz/matrixserver) repo with the `feature/websocket-renderer` branch.

```bash
./server_simulator                              # WebSocket mode (default, port 1337)
./server_simulator --use-deprecated-tcp-connection  # legacy TCP mode
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
