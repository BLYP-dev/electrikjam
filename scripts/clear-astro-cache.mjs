#!/usr/bin/env node
import { rm } from 'node:fs/promises';
import { projectPath } from './lib.mjs';

await rm(projectPath('.astro'), { recursive: true, force: true });
