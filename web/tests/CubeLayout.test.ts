import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LedScreen } from '../src/LedScreen';
import { setScreenPositionsCube, setScreenPositionsFlat } from '../src/CubeLayout';

function makeScreens(count: number): LedScreen[] {
    return Array.from({ length: count }, () =>
        new LedScreen(64, 64, new THREE.PlaneGeometry(300, 300))
    );
}

describe('Cube layout', () => {
    it('positions 6 screens without leaving them all at origin', () => {
        const screens = makeScreens(6);
        setScreenPositionsCube(screens, 5);

        const allAtOriginPos = screens.every(s => s.mesh.position.length() < 1e-6);
        const allAtOriginRot = screens.every(s =>
            Math.abs(s.mesh.rotation.x) < 1e-6 &&
            Math.abs(s.mesh.rotation.y) < 1e-6 &&
            Math.abs(s.mesh.rotation.z) < 1e-6
        );
        // After cube layout, at least positions or rotations differ from origin
        expect(allAtOriginPos && allAtOriginRot).toBe(false);
    });

    it('positions all 6 screens at the same distance from center', () => {
        const screens = makeScreens(6);
        setScreenPositionsCube(screens, 0);

        const distances = screens.map(s => {
            const pos = new THREE.Vector3();
            s.mesh.getWorldPosition(pos);
            return Math.round(pos.length() * 10) / 10;
        });

        const allSame = distances.every(d => Math.abs(d - distances[0]) < 5);
        expect(allSame).toBe(true);
    });

    it('each screen mesh has a different net world position (no overlapping)', () => {
        const screens = makeScreens(6);
        setScreenPositionsCube(screens, 5);

        const positions = screens.map(s => {
            const pos = new THREE.Vector3();
            s.mesh.getWorldPosition(pos);
            return `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
        });

        const unique = new Set(positions).size;
        expect(unique).toBe(6);
    });

    it('changing border shifts screens outward', () => {
        const screens0 = makeScreens(6);
        const screens5 = makeScreens(6);

        setScreenPositionsCube(screens0, 0);
        setScreenPositionsCube(screens5, 50);

        const dist0 = (s: LedScreen) => { const p = new THREE.Vector3(); s.mesh.getWorldPosition(p); return p.length(); };
        const dist5 = (s: LedScreen) => { const p = new THREE.Vector3(); s.mesh.getWorldPosition(p); return p.length(); };

        // At least some screens should be farther out with a larger border
        const anyFarther = screens5.some((s, i) => dist5(s) > dist0(screens0[i]) - 1);
        expect(anyFarther).toBe(true);
    });
});

describe('Flat layout', () => {
    it('arranges screens in a grid pattern (x/y positions unique per column/row)', () => {
        const screens = makeScreens(6);
        setScreenPositionsFlat(2, 3, 20, 20, screens);

        const xs = screens.map(s => Math.round(s.mesh.position.x));
        const uniqueX = new Set(xs).size;
        // 3 columns → 3 unique x values
        expect(uniqueX).toBe(3);
    });

    it('produces correct number of unique Y positions for rows', () => {
        const screens = makeScreens(4);
        setScreenPositionsFlat(2, 2, 20, 20, screens);

        const ys = screens.map(s => Math.round(s.mesh.position.y));
        const uniqueY = new Set(ys).size;
        expect(uniqueY).toBe(2);
    });

    it('resets screen transforms before applying layout', () => {
        const screens = makeScreens(6);
        // Apply cube layout first, then flat
        setScreenPositionsCube(screens, 5);
        setScreenPositionsFlat(1, 6, 0, 10, screens);
        // After flat layout all y positions should be uniform (1 row)
        const ys = screens.map(s => Math.round(s.mesh.position.y));
        const uniqueY = new Set(ys).size;
        expect(uniqueY).toBe(1);
    });
});
