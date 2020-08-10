import { Shell } from './shell.js';
import { readFile, writeFile, deleteFile } from './io.js';
import { Log } from './log.js';

const replaceVars = (text, vars) => text.replace(/\{\{\s*(\w+)\s*}\}/g, (_, variable) => (vars[variable] || ''));
const logger = Log.create('nginx');
class NginxManager {
  async createServiceConfig(service) {
    const vars = {
      port: service.env.PORT,
      webSocketPort: service.env.WEBSOCKET_PORT,
      domains: service.domains.join(' '),
    };

    const template = await readFile('server', 'service.conf');
    const templateWithWebSockets = template
      .replace('%webSocket%', this.getWebSocketConfig(service))
      .replace('%secureWebSocket%', this.getWebSocketConfig(service, true));
    const content = replaceVars(templateWithWebSockets, vars);

    try {
      await writeFile(`nginx-sites/${service.id}.conf`, content);
    } catch (error) {
      logger.error('Failed to create Nginx configuration!')
      logger.debug(error);
    }
  }

  async deleteServiceConfig(service) {
    return await deleteFile(`nginx-sites/${service.id}.conf`);
  }

  reload() {
    try {
      Shell.exec('nginx', ['-t']);
      Shell.exec('service', ['nginx', 'reload']);
    } catch (error) {
      logger.error('Failed to reload Nginx configuration!')
      logger.debug(error);
    }
  }

  getWebSocketConfig(service, isSecure = false) {
    if (!service.webSocket) {
      return '';
    }

    return  `
    location /${service.webSocket.path} {
      proxy_set_header Host $http_host;
      ${isSecure ? 'proxy_ssl_server_name on;' : ''}
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_pass http://localhost:{{webSocketPort}};
    }
    `;
  }
}

export const Nginx = new NginxManager();