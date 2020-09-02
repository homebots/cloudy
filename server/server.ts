import { Log } from './log.js';
import { Shell } from './shell.js';
import { Services } from './service.js';

const logger = Log.create('server');

class ServerManager {
  updateRepository() {
    try {
      Shell.execAndLog('git', ['pull', '--rebase']);
      Shell.execAndLog('npm', ['ci']);
      Shell.execAndLog('npm', ['run', 'build']);
    } catch (error) {
      logger.error(error.message);
    }
  }

  reloadAfterBuild() {
    const exit = () => Services.building || this.reload();
    exit();
    setInterval(exit, 1000);
  }

  reload() {
    Shell.execSync('pm2', ['reload', 'cloudy']);
  }
}

export const Server = new ServerManager();
