import * as THREE from 'three';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import { LedScreen } from './LedScreen';
import { CustomCamera } from './CustomCamera';
import { WebSocketConnection, ScreenFrameData } from './WebSocketConnection';
import { setScreenPositionsCube, setScreenPositionsFlat } from './CubeLayout';
export { setScreenPositionsCube, setScreenPositionsFlat } from './CubeLayout';

// --- Config ---
const SCREEN_PIXELS_WIDTH = 64;
const SCREEN_PIXELS_HEIGHT = 64;
const SCREEN_WIDTH = 300;
const SCREEN_HEIGHT = 300;
const SCREEN_COUNT = 6;

// --- State ---
let scene: THREE.Scene;
let camera: CustomCamera;
let camera2: CustomCamera;
let renderer: THREE.WebGLRenderer;
let stats: Stats;
let screens: LedScreen[];
let gui: GUI;
let displayStyle: 'Single' | 'Splitscreen' | 'Backdrop' = 'Single';

const cubeOptions = { cubeBorder: 5 };
const flatOptions = { flatGapCol: 20, flatGapRow: 20, flatColCount: 3, flatRowCount: 2 };

const wsConnection = new WebSocketConnection();

// --- Init ---
init();
animate();

async function init() {
  setupStats();
  setupScene();
  setupRenderer();
  camera = new CustomCamera(renderer, false);
  camera2 = new CustomCamera(renderer, true);
  setupGUI();
  setupConnectionUI();
  window.addEventListener('resize', onWindowResize);

  // Load proto and wire up receiving frames
  await wsConnection.loadProto(import.meta.env.BASE_URL + 'matrixserver.proto');
  wsConnection.onFrame((screenData: ScreenFrameData[]) => {
    screenData.forEach(({ screenId, frameData }) => {
      if (screenId < screens.length) {
        screens[screenId].setFrameData(frameData);
      }
    });
  });
}

// --- Scene ---
function setupStats() {
  stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20252f);
  screens = [];
  for (let i = 0; i < SCREEN_COUNT; i++) {
    screens.push(new LedScreen(
      SCREEN_PIXELS_HEIGHT,
      SCREEN_PIXELS_WIDTH,
      new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT, 1, 1)
    ));
  }
  setScreenPositionsCube(screens, cubeOptions.cubeBorder);
  screens.forEach(screen => {
    screen.fillTextureRandom(0, 150, 255);
    scene.add(screen.mesh);
  });

  // Inner cube (fills centre so screens form a solid cube)
  const innerGeo = new THREE.BoxGeometry(1, 1, 1);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const innerCube = new THREE.Mesh(innerGeo, innerMat);
  innerCube.scale.setScalar(SCREEN_WIDTH + cubeOptions.cubeBorder * 2 - 0.1);
  scene.add(innerCube);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
}

// Layout helpers imported from CubeLayout.ts

// --- GUI ---
function setupGUI() {
  gui = new GUI();
  const param = {
    'Screen display type': 0,
    Camera: 0,
    Displaystyle: 0,
    'Reset Camera': () => { camera.reset(); camera2.reset(); },
    ...cubeOptions,
    ...flatOptions,
  };

  gui.add(param, 'Screen display type', { Cube: 0, 'Single Screens': 1 }).onChange((val: string) => {
    if (val === '0') setScreenPositionsCube(screens, cubeOptions.cubeBorder);
    else setScreenPositionsFlat(flatOptions.flatRowCount, flatOptions.flatColCount, flatOptions.flatGapRow, flatOptions.flatGapCol, screens);
  });

  const folderCube = gui.addFolder('Cube Options');
  folderCube.add(param, 'cubeBorder', 0, 50, 1).onChange((val: number) => {
    cubeOptions.cubeBorder = val;
    setScreenPositionsCube(screens, cubeOptions.cubeBorder);
  });

  const folderFlat = gui.addFolder('Flat Options');
  folderFlat.add(param, 'flatRowCount', 1, 10, 1).onChange((val: number) => {
    flatOptions.flatRowCount = val;
  });
  folderFlat.add(param, 'flatColCount', 1, 10, 1).onChange((val: number) => {
    flatOptions.flatColCount = val;
  });

  gui.add(param, 'Camera', { Perspective: 0, Orthogonal: 1 }).onChange((val: string) => {
    if (val === '0') { camera.switchToPerspective(); camera2.switchToPerspective(); }
    else { camera.switchToOrtho(); camera2.switchToOrtho(); }
    resetWindowSizes();
  });

  gui.add(param, 'Displaystyle', { Single: 0, Splitscreen: 1, Backdrop: 2 }).onChange((val: string) => {
    displayStyle = (['Single', 'Splitscreen', 'Backdrop'] as const)[parseInt(val)];
    resetWindowSizes();
  });

  gui.add(param, 'Reset Camera');
}

// --- Connection UI ---
function setupConnectionUI() {
  const urlInput = document.getElementById('ws-url') as HTMLInputElement;
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('connection-status')!;

  wsConnection.onStateChange((state) => {
    statusEl.textContent = state.toUpperCase();
    statusEl.className = 'status ' + state;
    connectBtn.textContent = (state === 'connected' || state === 'connecting') ? 'Disconnect' : 'Connect';
  });

  connectBtn.addEventListener('click', () => {
    if (wsConnection.getState() === 'connected' || wsConnection.getState() === 'connecting') {
      wsConnection.disconnect();
    } else {
      wsConnection.connect(urlInput.value.trim());
    }
  });
}

// --- Render loop ---
function getCameraDisplaySettings() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return {
    Single: {
      Camera1: { resetSize: [W, H], viewport: [0, 0, W, H], scissor: [0, 0, W, H] },
      Camera2: { resetSize: [W, H], viewport: [0, 0, W, H], scissor: [0, 0, W, H] },
    },
    Splitscreen: {
      Camera1: { resetSize: [W / 2, H], viewport: [0, 0, W / 2, H], scissor: [0, 0, W / 2, H] },
      Camera2: { resetSize: [W / 2, H], viewport: [W / 2, 0, W / 2, H], scissor: [W / 2, 0, W / 2, H] },
    },
    Backdrop: {
      Camera1: { resetSize: [W, H], viewport: [0, 0, W, H], scissor: [0, 0, W, H] },
      Camera2: { resetSize: [W / 3, H / 3], viewport: [0, 0, W / 3, H / 3], scissor: [0, 0, W / 3, H / 3] },
    },
  };
}

function resetWindowSizes() {
  const settings = getCameraDisplaySettings()[displayStyle];
  camera.resetWindowSize(settings.Camera1.resetSize[0], settings.Camera1.resetSize[1]);
  camera2.resetWindowSize(settings.Camera2.resetSize[0], settings.Camera2.resetSize[1]);
}

function onWindowResize() {
  camera.doWindowResize(renderer);
  camera2.doWindowResize(renderer);
  resetWindowSizes();
}

function animate() {
  stats.begin();
  requestAnimationFrame(animate);

  const settings = getCameraDisplaySettings()[displayStyle];

  camera.update();
  renderer.setViewport(...(settings.Camera1.viewport as [number, number, number, number]));
  renderer.setScissor(...(settings.Camera1.scissor as [number, number, number, number]));
  renderer.setScissorTest(true);
  renderer.render(scene, camera.getCurrentCamera());

  if (displayStyle === 'Splitscreen' || displayStyle === 'Backdrop') {
    camera2.update();
    renderer.setViewport(...(settings.Camera2.viewport as [number, number, number, number]));
    renderer.setScissor(...(settings.Camera2.scissor as [number, number, number, number]));
    renderer.setScissorTest(true);
    renderer.render(scene, camera2.getCurrentCamera());
  }

  stats.end();
}
