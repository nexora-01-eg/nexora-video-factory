#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateOrExit } from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));
validateOrExit(videos);
