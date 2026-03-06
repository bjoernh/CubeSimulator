import * as THREE from 'three';
import { LedScreen } from './LedScreen';

export function resetScreens(screens: LedScreen[]): void {
    screens.forEach(screen => {
        screen.mesh.rotation.set(0, 0, 0);
        screen.mesh.position.set(0, 0, 0);
    });
}

export function setScreenPositionsCube(screens: LedScreen[], border: number): void {
    resetScreens(screens);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);

    const rotations: Record<number, { rotAxis: THREE.Vector3; angle: number }> = {
        5: { rotAxis: xAxis, angle: Math.PI * 0.5 },
        0: { rotAxis: yAxis, angle: Math.PI * 0 },
        1: { rotAxis: yAxis, angle: Math.PI * 0.5 },
        3: { rotAxis: yAxis, angle: Math.PI * 1.5 },
        4: { rotAxis: xAxis, angle: Math.PI * 1.5 },
        2: { rotAxis: yAxis, angle: Math.PI * 1 },
    };

    for (let i = 0; i < 6 && i < screens.length; i++) {
        screens[i].mesh.rotateOnAxis(rotations[i].rotAxis, rotations[i].angle);
        screens[i].mesh.rotateOnAxis(zAxis, Math.PI * 1.5);
        screens[i].mesh.translateOnAxis(new THREE.Vector3(0, 0, 1), screens[i].width / 2 + border);
    }
}

export function setScreenPositionsFlat(
    rows: number,
    columns: number,
    gapRow: number,
    gapCol: number,
    screens: LedScreen[]
): void {
    resetScreens(screens);
    const sw = Math.max(...screens.map(s => s.width));
    const sh = Math.max(...screens.map(s => s.height));

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const idx = columns * row + col;
            if (idx >= screens.length) break;
            screens[idx].mesh.position.x = (sw + gapCol) * col;
            screens[idx].mesh.position.y = (sh + gapRow) * row;
            screens[idx].mesh.translateX(-(columns - 1) * (sw + gapCol) / 2.0);
            screens[idx].mesh.translateY(-(rows - 1) * (sh + gapRow) / 2.0);
            screens[idx].mesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI * 1.5);
        }
    }
}
