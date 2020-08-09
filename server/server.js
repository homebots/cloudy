import { Log } from './log.js';
import { Shell } from './shell.js';

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
    Shell.exec('pm2 reload cloudy');
  }
}

export const Server = new ServerManager();