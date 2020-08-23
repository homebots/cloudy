import { createHash } from 'crypto';
import { Docker } from './docker.js';
import { GitHub } from './github.js';
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

  getAllServices() {
    const allServices = this.services.getAll();
    const runningServices = Docker.getRunningContainers();
    const isOnline = (service) => runningServices.includes(Docker.getContainerNameForService(service));
    const status = allServices.map((service) => ({ ...service, online: isOnline(service) }));

    return status;
  }

  async deployService(service) {
    try {
      const configuration = await GitHub.fetchServiceConfiguration(service.configurationUrl);
      const cloudyServiceConfig = this.createServiceConfiguration({
        ...service,
        ...configuration,
      });

      setTimeout(async () => {
        this.services.set(cloudyServiceConfig.id, cloudyServiceConfig);
        await this.buildServiceFromConfiguration(cloudyServiceConfig);
      }, 10);

      return cloudyServiceConfig.id;
    } catch (error) {
      logger.error('Failed to process service');
      logger.debug(error);
      throw new Error('Service creation failed: ' + error.message);
    }
  }

  getServiceConfiguration(repository, head) {
    const serviceId = this.getServiceId(repository, head);
    return this.services.get(serviceId);
  }

  async buildServiceFromConfiguration(cloudyServiceConfig) {
    try {
      this.building = true;
      await Docker.createImage(cloudyServiceConfig);
      await Docker.stopService(cloudyServiceConfig);
      await Docker.runService(cloudyServiceConfig);
      await Nginx.createServiceConfiguration(cloudyServiceConfig);
      Nginx.reload();
    } catch (error) {
      this.building = false;
      throw error;
    }
  }

  async reconfigureNginx() {
    const allServices = this.services.getAll();

    Nginx.resetConfiguration();
    await Promise.all(allServices.map((service) => Nginx.createServiceConfiguration(service)));
    Nginx.reload();
  }

  stopService(repository, head = 'master') {
    const serviceConfiguration = this.getServiceConfiguration(repository, head);
    Docker.stopService(serviceConfiguration);
  }

  startService(repository, head = 'master') {
    const serviceConfiguration = this.getServiceConfiguration(repository, head);
    Docker.runService(serviceConfiguration);
  }

  restartService(repository, head = 'master') {
    const serviceConfiguration = this.getServiceConfiguration(repository, head);
    Docker.stopService(serviceConfiguration);
    Docker.runService(serviceConfiguration);
  }

  async createServiceKey(repository) {
    if (!repository) {
      throw new Error('Invalid repository');
    }

    const repositoryExists = await GitHub.exists(repository);
    if (!repositoryExists) {
      throw new Error('Repository not found');
    }

    const serviceKeyExists = this.getServiceKey(repository);
    if (serviceKeyExists) {
      throw new Error('Service already exists, key is ' + serviceKeyExists);
    }

    const serviceKeyId = sha256(repository);
    const serviceKey = sha256(randomBytes(256).toString('hex'));

    this.serviceKeys.set(serviceKeyId, serviceKey);

    return serviceKey;
  }

  async createServiceFromRepository(repository, head = 'master') {
    const serviceKeyId = sha256(repository);

    if (!this.serviceKeys.has(serviceKeyId)) {
      await this.createServiceKey(repository);
    }

    const service = await GitHub.getServiceFromRepository(repository, head);
    return this.deployService(service);
  }

  async deleteService(repository, head = 'master') {
    const serviceId = this.getServiceId(repository, head);

    if (!this.services.has(serviceId)) {
      throw new Error(`Service for ${repository}:${head} not found`);
    }

    const service = this.services.get(serviceId);
    await Docker.stopService(service);
    await Nginx.deleteServiceConfig(service);

    Nginx.reload();
    this.services.delete(serviceId);
  }

  getServiceId(repository, head) {
    return sha256(repository + head);
  }

  getServiceKey(repository) {
    const serviceId = sha256(repository);
    return this.serviceKeys.get(serviceId);
  }

  deleteServiceKey(repository) {
    const serviceId = sha256(repository);
    return this.serviceKeys.delete(serviceId);
  }

  createServiceConfiguration(service) {
    const serviceId = this.getServiceId(service.repository, service.head);
    const serviceType = this.getServiceType(service);
    const hostPort = this.getRandomPort();
    const containerPort = Number(service.port) || hostPort;
    const domains = [service.domain || serviceId.slice(0, 7) + '.' + cloudyDomain];
    const hasWebSocket = !!service.webSocket && service.webSocket.path;
    const webSocket = hasWebSocket ? { path: service.webSocket.path } : null;

    const env = {
      ...(service.env || {}),
      PORT: containerPort,
    };

    const ports = [hostPort !== containerPort ? [hostPort, containerPort] : hostPort];
    if (hasWebSocket) {
      env.WEBSOCKET_PORT = this.getRandomPort();
      ports.push(env.WEBSOCKET_PORT);
    }

    return {
      id: serviceId,
      type: serviceType,
      url: service.url,
      branch: service.head,
      repository: service.repository,
      webSocket,
      domains,
      ports,
      env,
      memory: service.memory,
    };
  }

  getServiceType(service) {
    return service.type && Docker.availableServiceTypes.includes(service.type)
      ? service.type
      : Docker.defaultServiceType;
  }

  getRandomPort() {
    const newRandomPort = () => 3000 + Math.round(Math.random() * 60000);
    const portsInUse = this.getAllServices().reduce((ports, service) => ports.concat(service.ports), []);
    let port;

    while ((port = newRandomPort())) {
      if (portsInUse.includes(port) === false) {
        return port;
      }
    }
  }
}

export const Services = new ServiceManager();
