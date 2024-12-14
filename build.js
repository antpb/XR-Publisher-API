import esbuild from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const distPath = path.join(__dirname, 'dist');

// Clean dist directory
fs.rm(distPath, { recursive: true }, (err) => {
    if (err) throw err;
    fs.mkdir(distPath, (err) => {
        if (err) throw err;
    });
});

dotenv.config({ path: path.join(__dirname, '.env') });

esbuild.build({
    entryPoints: ['src/worker.js'],
    bundle: true,
    outfile: 'dist/worker.js',
    format: 'esm',
    platform: 'browser', // Changed from 'node' to 'browser'
    allowOverwrite: true,
    target: 'ES2020',
    plugins: [
        polyfillNode({
            polyfills: {
                fs: true,
                path: true,
                buffer: true,
                // Explicitly disable worker_threads polyfill
                worker_threads: false,
                crypto: true,
            },
        }),
        sentryEsbuildPlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            include: './dist',
            authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
    ],
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
    },
    external: [
        '@langchain/core/documents',
        '@langchain/core/utils/tiktoken',
        '@langchain/textsplitters',
        'fastembed',
        '@fal-ai/client',
        'unique-names-generator',
        'tough-cookie',
        'set-cookie-parser',
        // Add node-specific modules to external
        'worker_threads',
        'node-domexception'
    ]
}).catch(() => process.exit(1));