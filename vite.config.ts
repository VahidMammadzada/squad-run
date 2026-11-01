import { defineConfig } from 'vitest/config';

// Based on the official Phaser YouTube Playables template config.
export default defineConfig({
    // Playables must use relative paths only.
    base: './',
    server: {
        port: 8080
    },
    build: {
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
            compress: { passes: 2 },
            format: { comments: false }
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
