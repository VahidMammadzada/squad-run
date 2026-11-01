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
        // Phaser alone minifies to ~1.2 MB; the split chunks below are expected to be large.
        chunkSizeWarningLimit: 1300,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                    three: ['three']
                }
            }
        }
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
