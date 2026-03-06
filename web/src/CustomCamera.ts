import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CustomCamera {
    cameraControlsPerspective: OrbitControls;
    cameraControlsOrtho: OrbitControls;
    orthoCamera: THREE.OrthographicCamera;
    perspectiveCamera: THREE.PerspectiveCamera;
    isBackCamera: boolean;
    currentCamera: THREE.Camera;

    constructor(renderer: THREE.WebGLRenderer, isBackCamera: boolean) {
        this.isBackCamera = isBackCamera;

        if (!isBackCamera) {
            this.orthoCamera = new THREE.OrthographicCamera(
                window.innerWidth / -2, window.innerWidth / 2,
                window.innerHeight / 2, window.innerHeight / -2, 1, 100000);
            this.orthoCamera.position.z = 1000;

            this.perspectiveCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 100000);
            this.perspectiveCamera.position.z = 1000;
        } else {
            this.orthoCamera = new THREE.OrthographicCamera(
                window.innerWidth / -2, window.innerWidth / 2,
                window.innerHeight / 2, window.innerHeight / -2, 1, 100000);
            this.orthoCamera.position.z = -1000;
            this.orthoCamera.lookAt(0, 0, 1);

            this.perspectiveCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 100000);
            this.perspectiveCamera.position.z = -1000;
            this.perspectiveCamera.lookAt(0, 0, -1);
        }

        this.cameraControlsOrtho = new OrbitControls(this.orthoCamera, renderer.domElement);
        this.cameraControlsOrtho.enableDamping = true;
        this.cameraControlsOrtho.dampingFactor = 0.07;
        this.cameraControlsOrtho.rotateSpeed = 0.1;

        this.cameraControlsPerspective = new OrbitControls(this.perspectiveCamera, renderer.domElement);
        this.cameraControlsPerspective.enableDamping = true;
        this.cameraControlsPerspective.dampingFactor = 0.07;
        this.cameraControlsPerspective.rotateSpeed = 0.1;

        this.currentCamera = this.perspectiveCamera;
    }

    reset(): void {
        this.cameraControlsOrtho.reset();
        this.cameraControlsPerspective.reset();
    }

    getCurrentCamera(): THREE.Camera {
        return this.currentCamera;
    }

    update(): void {
        this.cameraControlsOrtho.update();
        this.cameraControlsPerspective.update();
    }

    doWindowResize(renderer: THREE.WebGLRenderer): void {
        if (this.currentCamera instanceof THREE.PerspectiveCamera) {
            this.currentCamera.aspect = window.innerWidth / window.innerHeight;
            this.currentCamera.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    resetWindowSize(width: number, height: number): void {
        if (this.currentCamera instanceof THREE.OrthographicCamera) {
            this.currentCamera.left = width / -2;
            this.currentCamera.right = width / 2;
            this.currentCamera.top = height / 2;
            this.currentCamera.bottom = height / -2;
            this.currentCamera.updateProjectionMatrix();
        } else if (this.currentCamera instanceof THREE.PerspectiveCamera) {
            this.currentCamera.aspect = width / height;
            this.currentCamera.updateProjectionMatrix();
        }
    }

    switchToOrtho(): void {
        this.currentCamera = this.orthoCamera;
    }

    switchToPerspective(): void {
        this.currentCamera = this.perspectiveCamera;
    }

    setRotateSpeed(speed: number): void {
        this.cameraControlsOrtho.rotateSpeed = speed;
        this.cameraControlsPerspective.rotateSpeed = speed;
    }
}
