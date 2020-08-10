import { cli } from './server/cli.js';
import { api } from './server/api.js';

if (process.argv.length === 2) {
  api().catch(console.log);
} else {
  cli(process.argv.slice(2)).then(console.log, console.error);
}
