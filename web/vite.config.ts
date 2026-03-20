/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    base: '/CubeWebapp/',
    plugins: [basicSsl()],
    server: {
        host: true,
        proxy: {
            '/matrix-ws': {
                target: 'ws://127.0.0.1:1337',
                ws: true,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/matrix-ws/, '')
            }
        }
    },
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
