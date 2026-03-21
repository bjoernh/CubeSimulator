import * as THREE from 'three';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import { LedScreen } from './LedScreen';
import { CustomCamera } from './CustomCamera';
import { WebSocketConnection, ScreenFrameData } from './WebSocketConnection';
import { ParamConfigPanel } from './ParamConfigPanel';
import { PresetManager } from './PresetManager';
import { setScreenPositionsCube, setScreenPositionsFlat } from './CubeLayout';
import { AudioCapture } from './AudioCapture';
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
let innerCube: THREE.Mesh;
let gui: GUI;
let displayStyle: 'Single' | 'Splitscreen' | 'Backdrop' = 'Single';
let paramPanel: ParamConfigPanel;

const cubeOptions = { cubeBorder: 5 };
const flatOptions = { flatGapCol: 20, flatGapRow: 20, flatColCount: 3, flatRowCount: 2 };

// --- IMU State ---
let isImuActive = false;
let lastImuSendTime = 0;
const IMU_SEND_INTERVAL = 100; // ~10Hz

// --- Audio State ---
let audioCapture: AudioCapture;
let lastAudioSendTime = 0;
const AUDIO_SEND_INTERVAL = 33; // ~30Hz

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
  camera.setRotateSpeed(1.0);
  camera2.setRotateSpeed(1.0);
  setupGUI();
  setupConnectionUI();
  setupImuListeners();
  window.addEventListener('resize', onWindowResize);

  paramPanel = new ParamConfigPanel(wsConnection);
  new PresetManager(paramPanel);

  audioCapture = new AudioCapture();

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
  stats.dom.style.position = 'absolute';
  stats.dom.style.left = 'auto';
  stats.dom.style.right = '0px';
  stats.dom.style.top = 'auto';
  stats.dom.style.bottom = '0px';
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
  innerCube = new THREE.Mesh(innerGeo, innerMat);
  innerCube.scale.setScalar(SCREEN_WIDTH + cubeOptions.cubeBorder * 2 - 0.1);
  scene.add(innerCube);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = 'scene-canvas';
  document.body.appendChild(renderer.domElement);
}

// Layout helpers imported from CubeLayout.ts

// --- GUI ---
function setupGUI() {
  gui = new GUI();
  const param = {
    'Screen display type': 0,
    Camera: 0,
    cameraRotateSpeed: 1.0,
    Displaystyle: 0,
    'Reset Camera': () => { camera.reset(); camera2.reset(); },
    ...cubeOptions,
    ...flatOptions,
  };

  gui.add(param, 'Screen display type', { Cube: 0, 'Single Screens': 1 }).onChange((val: number | string) => {
    // lil-gui passes the exact value type from the mapping object, so it will be the number 0 or 1
    if (val === 0 || val === '0') {
      setScreenPositionsCube(screens, cubeOptions.cubeBorder);
      if (innerCube) innerCube.visible = true;
    } else {
      setScreenPositionsFlat(flatOptions.flatRowCount, flatOptions.flatColCount, flatOptions.flatGapRow, flatOptions.flatGapCol, screens);
      if (innerCube) innerCube.visible = false;
    }
  });

  const folderCube = gui.addFolder('Cube Options');
  folderCube.add(param, 'cubeBorder', 0, 50, 1).onChange((val: number) => {
    cubeOptions.cubeBorder = val;
    setScreenPositionsCube(screens, cubeOptions.cubeBorder);
    if (innerCube) innerCube.scale.setScalar(SCREEN_WIDTH + cubeOptions.cubeBorder * 2 - 0.1);
  });

  const folderFlat = gui.addFolder('Flat Options');
  folderFlat.add(param, 'flatRowCount', 1, 10, 1).onChange((val: number) => {
    flatOptions.flatRowCount = val;
    if (param['Screen display type'] === 1) {
      setScreenPositionsFlat(flatOptions.flatRowCount, flatOptions.flatColCount, flatOptions.flatGapRow, flatOptions.flatGapCol, screens);
    }
  });
  folderFlat.add(param, 'flatColCount', 1, 10, 1).onChange((val: number) => {
    flatOptions.flatColCount = val;
    if (param['Screen display type'] === 1) {
      setScreenPositionsFlat(flatOptions.flatRowCount, flatOptions.flatColCount, flatOptions.flatGapRow, flatOptions.flatGapCol, screens);
    }
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

  gui.add(param, 'cameraRotateSpeed', 0.1, 5.0, 0.1).name('Camera Sensitivy').onChange((val: number) => {
    camera.setRotateSpeed(val);
    camera2.setRotateSpeed(val);
  });

  gui.add(param, 'Reset Camera');

  const folderSensors = gui.addFolder('Sensors (Smartphone)');
  folderSensors.add({
    'Request Permissions': () => {
      // @ts-ignore (DeviceOrientationEvent.requestPermission is an iOS specific non-standard API)
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // @ts-ignore
        DeviceMotionEvent.requestPermission()
          .then((permissionState: string) => {
            if (permissionState === 'granted') {
              console.log('IMU Permission granted');
              alert('IMU Permission granted');
              isImuActive = true;
            } else {
              alert('IMU Permission denied: ' + permissionState);
            }
          })
          .catch((error: any) => {
            console.error(error);
            alert('Error requesting IMU permission: ' + error);
          });
      } else {
        // Non iOS 13+ devices
        isImuActive = true;
        console.log('IMU tracking enabled (No explicit permission required on this browser)');
        alert('IMU tracking enabled (No explicit permission required on this browser)');
      }
    }
  }, 'Request Permissions');
  folderSensors.add({ 'Send IMU Stream': false }, 'Send IMU Stream').onChange((val: boolean) => {
    isImuActive = val;
  }).listen().name('Send IMU Data');

  folderSensors.add({ 'Mic Capture': false }, 'Mic Capture').onChange(async (val: boolean) => {
    if (val) {
      try {
        await audioCapture.start();
        console.log('Audio capture started');
      } catch (e) {
        alert('Could not start audio capture. Please allow microphone permissions.');
      }
    } else {
      audioCapture.stop();
    }
  }).listen().name('Microphone Capture');
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

// --- IMU Listeners ---
function setupImuListeners() {
  window.addEventListener('devicemotion', (event) => {
    if (!isImuActive || wsConnection.getState() !== 'connected') return;

    const now = Date.now();
    if (now - lastImuSendTime > IMU_SEND_INTERVAL) {
      lastImuSendTime = now;

      // Extract raw acceleration including gravity (which is what MPU6050 expects)
      const ax = event.accelerationIncludingGravity?.x || 0;
      const ay = event.accelerationIncludingGravity?.y || 0;
      const az = event.accelerationIncludingGravity?.z || 0;

      // Only send if we actually have data (prevents sending 0,0,0 continuously from desktops)
      if (ax !== 0 || ay !== 0 || az !== 0) {
        wsConnection.sendImuData(ax, ay, az);
      }
    }
  }, true);
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

  if (audioCapture && audioCapture.isRunning && wsConnection.getState() === 'connected') {
    const now = Date.now();
    if (now - lastAudioSendTime > AUDIO_SEND_INTERVAL) {
      lastAudioSendTime = now;
      const audioData = audioCapture.getAudioData();
      if (audioData) {
        wsConnection.sendAudioData(audioData.volume, audioData.frequencyBands);
      }
    }
  }

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
