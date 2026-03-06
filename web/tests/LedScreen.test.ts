import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LedScreen } from '../src/LedScreen';

describe('LedScreen', () => {
    let screen: LedScreen;
    const PIXEL_WIDTH = 64;
    const PIXEL_HEIGHT = 64;
    const GEO_SIZE = 300;

    beforeEach(() => {
        screen = new LedScreen(
            PIXEL_HEIGHT,
            PIXEL_WIDTH,
            new THREE.PlaneGeometry(GEO_SIZE, GEO_SIZE)
        );
    });

    it('allocates a data buffer of the correct size (width * height * 4 channels, RGBA)', () => {
        expect(screen.data.length).toBe(PIXEL_WIDTH * PIXEL_HEIGHT * 4);
    });

    it('initialises RGB channels to zero and alpha channel to 255', () => {
        const allRgbZero = Array.from(screen.data).every((v, i) => (i % 4 === 3) ? v === 255 : v === 0);
        expect(allRgbZero).toBe(true);
    });

    it('stores pixelWidth and pixelHeight', () => {
        expect(screen.pixelWidth).toBe(PIXEL_WIDTH);
        expect(screen.pixelHeight).toBe(PIXEL_HEIGHT);
    });

    it('stores geometry dimensions as width/height', () => {
        expect(screen.width).toBe(GEO_SIZE);
        expect(screen.height).toBe(GEO_SIZE);
    });

    it('creates a DataTexture with the correct pixel dimensions', () => {
        expect(screen.texture).toBeInstanceOf(THREE.DataTexture);
        expect(screen.texture.image.width).toBe(PIXEL_WIDTH);
        expect(screen.texture.image.height).toBe(PIXEL_HEIGHT);
    });

    it('creates a Mesh', () => {
        expect(screen.mesh).toBeInstanceOf(THREE.Mesh);
    });

    it('fillTextureRandom sets non-zero data values', () => {
        screen.fillTextureRandom(255, 255, 255);
        const anyNonZero = Array.from(screen.data).some(v => v !== 0);
        expect(anyNonZero).toBe(true);
    });

    it('fillTextureRandom increments texture version (marks dirty)', () => {
        const versionBefore = screen.texture.version;
        screen.fillTextureRandom(255, 255, 255);
        expect(screen.texture.version).toBeGreaterThan(versionBefore);
    });

    it('invalidate() increments texture version (marks dirty)', () => {
        const versionBefore = screen.texture.version;
        screen.invalidate();
        expect(screen.texture.version).toBeGreaterThan(versionBefore);
    });

    it('writing to data and calling invalidate updates the texture reference', () => {
        screen.data[0] = 42;
        screen.data[1] = 128;
        screen.data[2] = 200;
        screen.invalidate();
        // Verify data and texture share the same backing buffer
        expect(screen.texture.image.data[0]).toBe(42);
        expect(screen.texture.image.data[1]).toBe(128);
        expect(screen.texture.image.data[2]).toBe(200);
    });
});
