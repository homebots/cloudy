import { Log } from './log.js';
import { Shell } from './shell.js';
import { Services } from './services.js';

const logger = Log.create('server');

class ServerManager {
  updateRepository() {
    try {
      Shell.exec('git', ['pull', '--rebase']);
    } catch (error) {
      logger.error(error.message);
    }
  }

  reload() {
    const exit = () => (Services.building || Shell.exec('pm2', ['reload', 'cloudy']));
    exit();
    setInterval(exit, 1000);
  }
}

export const Server = new ServerManager();