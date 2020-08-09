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
        Docker.createImage(cloudyServiceConfig);
        Docker.stopService(cloudyServiceConfig);
        Docker.runService(cloudyServiceConfig);
        await Nginx.configureService(cloudyServiceConfig);
        Nginx.reload();

        this.services.set(cloudyServiceConfig.id, cloudyServiceConfig);
      });

      return cloudyServiceConfig.id;
    } catch (error) {
      logger.error('Failed to process service');
      logger.debug(error);
      throw new Error('Service creation failed: ' + error.message);
    }
  }

  createServiceConfiguration(service) {
    const serviceId = this.getServiceId(service);
    const serviceType = this.getServiceType(service);
    const httpPort = 3000 + Math.round(Math.random() * 999);
    const domains = [service.domain, serviceId.slice(0, 7) + '.' + cloudyDomain].filter(Boolean);

    const env = {
      ...(service.env || {}),
      PORT: httpPort,
    };

    const ports = (service.ports || []).concat([httpPort]);

    return {
      id: serviceId,
      type: serviceType,
      url: service.url,
      cloneUrl: service.cloneUrl,
      branch: service.head,
      repository: service.repository,
      webSocket: service.webSocket,
      domains,
      ports,
      env,
    };
  }

  getServiceId(service) {
    return sha256(service.repository + service.head);
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
}

export const Services = new ServiceManager();