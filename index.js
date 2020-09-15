#!/usr/bin/env node

import { cli } from './build/cli.js';
import { api } from './build/api.js';

if (process.argv.length === 2) {
  api().catch(console.log);
} else {
  cli(process.argv.slice(2)).then(console.log, console.error);
}
