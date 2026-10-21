import { cpSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../dist/src/storage/migrations/', import.meta.url), { recursive: true });
cpSync(new URL('../src/storage/migrations/', import.meta.url), new URL('../dist/src/storage/migrations/', import.meta.url), { recursive: true });
