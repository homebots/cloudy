import { createHash } from 'crypto';
import { Docker } from './docker.js';
import { FileStorage } from './storage.js';
import { Log } from './log.js';
import { Nginx } from './nginx.js';
import { randomBytes } from 'crypto';

const logger = Log.create('services');
const cloudyDomain = process.env.CLOUDY_DOMAIN || 'local';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

class ServiceManager {
  constructor() {
    this.services = FileStorage.for('services');
    this.serviceKeys = FileStorage.for('serviceKeys');
  }

  async getAllServices() {
    const allServices = this.services.getAll();
    const runningServices = Docker.getRunningContainers();
    const status = allServices.reduce((map, service) => (map[service.id] = service, map), {});

    runningServices
      .filter(name => !!status[name])
      .forEach(name => (status[name].online = true));

    return Object.values(status);
  }

  async createService(service) {
    try {
      const cloudyServiceConfig = this.createServiceConfiguration(service);

      setTimeout(async () => {
        this.services.set(cloudyServiceConfig.id, cloudyServiceConfig);
        this.rebuildService(cloudyServiceConfig);
      });

      return cloudyServiceConfig.id;
    } catch (error) {
      logger.error('Failed to process service');
      logger.debug(error);
      throw new Error('Service creation failed: ' + error.message);
    }
  }

  async rebuildRepository(repository, head = 'master') {
    const serviceId = Services.getServiceId(repository, head);
    const serviceConfiguration = this.services.get(serviceId);

    if (!serviceConfiguration) {
      logger.error(`Service configuration for ${repository}:${head} not found!`);
      return;
    }

    return await this.rebuildService(serviceConfiguration);
  }

  async rebuildService(cloudyServiceConfig) {
    Docker.createImage(cloudyServiceConfig);
    Docker.stopService(cloudyServiceConfig);
    Docker.runService(cloudyServiceConfig);
    await Nginx.configureService(cloudyServiceConfig);
    Nginx.reload();
  }

  createServiceConfiguration(service) {
    const serviceId = this.getServiceId(service.repository, service.head);
    const serviceType = this.getServiceType(service);
    const httpPort = this.getRandomPort();
    const domains = [service.domain, serviceId.slice(0, 7) + '.' + cloudyDomain].filter(Boolean);
    const hasWebSocket = !!service.webSocket;
    const webSocket = hasWebSocket ? { path: service.webSocket.path } : null;
    const ports = [httpPort];
    const env = {
      ...(service.env || {}),
      PORT: httpPort,
    };

    if (hasWebSocket) {
      env.WEBSOCKET_PORT = getRandomPort();
      ports.push(env.WEBSOCKET_PORT);
    }

    return {
      id: serviceId,
      type: serviceType,
      url: service.url,
      cloneUrl: service.cloneUrl,
      branch: service.head,
      repository: service.repository,
      webSocket,
      domains,
      ports,
      env,
    };
  }

  getServiceId(repository, head) {
    return sha256(repository + head);
  }

  getServiceKey(repository) {
    const serviceId = sha256(repository);
    return this.serviceKeys.get(serviceId);
  }

  createServiceKey(repository) {
    const serviceId = sha256(repository);
    const serviceKey = sha256(randomBytes(256).toString('hex'));

    this.serviceKeys.set(serviceId, serviceKey);
    return serviceKey;
  }

  getServiceType(service) {
    return service.type && Docker.availableServiceTypes.includes(service.type) ? service.type : Docker.defaultServiceType;
  }

  getRandomPort() {
    const newRandomPort = () => 3000 + Math.round(Math.random() * 60000);
    const portsInUse = this.getAllServices().reduce((ports, service) => ports.concat(service.ports), []);
    let port;

    while (port = newRandomPort()) {
      if (portsInUse.includes(port) === false) {
        return port;
      }
    }
  }
}

export const Services = new ServiceManager();