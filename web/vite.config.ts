/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/CubeSimulator/',
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.ts'],
    },
});
