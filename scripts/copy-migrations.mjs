import { cpSync, mkdirSync } from "node:fs";

const source = new URL("../src/storage/migrations/", import.meta.url);
const destination = new URL("../dist/src/storage/migrations/", import.meta.url);

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });