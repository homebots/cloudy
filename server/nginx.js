import { Shell } from './shell.js';
import { readFile, writeFile } from './io.js';
import { Log } from './log.js';

const replaceVars = (text, vars) => text.replace(/\{\{\s*(\w+)\s*}\}/g, (_, variable) => vars[variable]);
const logger = Log.create('nginx');
class NginxManager {
  async configureService(service) {
    const vars = {
      port: service.env.PORT,
      domains: service.domains.join(' '),
    };

    const template = await readFile('server', 'service.conf');
    const templateWithWebSockets = template.replace('%webSocket%', this.getWebSocketConfig(service));
    const content = replaceVars(templateWithWebSockets, vars);

    try {
      await writeFile(`nginx-sites/${service.id}.conf`, content);
    } catch (error) {
      logger.error('Failed to create Nginx configuration!')
      logger.debug(error);
    }
  }

  reload() {
    try {
      Shell.execAndLog('nginx', ['-t']);
      Shell.execAndLog('service', ['nginx', 'reload']);
    } catch (error) {
      logger.error('Failed to reload Nginx configuration!')
      logger.debug(error);
    }
  }

  getWebSocketConfig(service) {
    if (!service.webSockets) {
      return '';
    }

    return  `
    location /${service.webSockets.path} {
      proxy_set_header Host $http_host;
      proxy_ssl_server_name on;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_pass http://localhost:${service.webSockets.port};
    }
    `;
  }
}

export const Nginx = new NginxManager();