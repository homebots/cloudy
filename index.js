import { Services } from './server/services.js';
import { cli } from './server/cli.js';
import { api } from './server/api.js';

if (process.argv.length === 2) {
  api().catch(console.log);
} else {
  cli(process.argv.slice(2)).then(console.log, console.error);
}

let exitTimeout = 30_000;
function exit() {
  if (!Services.building || exitTimeout === 0) {
    process.exit(0);
  }

  exitTimeout -= 1000;
}

process.on('SIGINT', function() {
  exit();
  setInterval(exit, 1000);
});
