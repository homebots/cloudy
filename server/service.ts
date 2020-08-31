import { createHash } from 'crypto';
import { GitHub } from './github.js';
import { FileStorage } from './storage.js';
import { Log } from './log.js';
import { Nginx } from './nginx.js';
import { ServiceConfiguration, PublicServiceConfiguration, Service } from './models.js';
import { DockerService, PortSpecification } from './docker.js';
import { join } from './io.js';

const logger = Log.create('services');
const cloudyDomain = process.env.CLOUDY_DOMAIN || 'local';
const sha256 = (value: import('crypto').BinaryLike) => createHash('sha256').update(value).digest('hex');
const CONTAINER_DATA_DIR = '/opt/data';

const Docker = new DockerService('images');

interface StoredService {
  type: string;
  repository: string;
  branch: string;
}

class ServiceManager {
  services: FileStorage<StoredService>;
  building: boolean = false;

  private defaultServiceType = String(process.env.CLOUDY_DEFAULT_IMAGE);

  constructor() {
    this.services = FileStorage.for('services');
  }

  getStatus() {
    const runningContainers = Docker.getRunningContainers();

    return this.services.getAll().map((service) => ({
      ...service,
      id: this.getServiceId(service),
      name: this.getContainerNameForService(service),
      online: this.isOnline(service, runningContainers),
    }));
  }

  isOnline(service: Service, containers?: string[]) {
    containers = containers || Docker.getRunningContainers();
    return containers.includes(this.getContainerNameForService(service));
  }

  async create(service: Service, configuration?: PublicServiceConfiguration) {
    logger.debug('create', service, configuration);
    const id = this.getServiceId(service);

    if (this.services.has(id)) return;

    const publicConfiguration = await this.resolveConfiguration(service, configuration);
    const { repository, branch } = service;
    const storedService: StoredService = {
      repository,
      branch,
      type: publicConfiguration.type || this.defaultServiceType,
    };

    this.services.set(id, storedService);
  }

  async build(service: Service, configuration?: PublicServiceConfiguration) {
    logger.debug('build', service, configuration);
    const publicConfiguration = await this.resolveConfiguration(service, configuration);
    const serviceConfiguration = this.getServiceConfiguration({ ...service, ...publicConfiguration });
    const serviceType = this.resolveServiceType(publicConfiguration.type);
    const image = this.getImageFromServiceType(serviceType);
    const gitUrl = GitHub.getCloneUrl(service.repository);

    const buildArgs = {
      GIT_URL: gitUrl,
      GIT_BRANCH: service.branch,
    };

    image.build({
      imageName: this.getImageNameForService(serviceConfiguration),
      buildArguments: buildArgs,
    });
  }

  async runInBackground(service: Service, configuration?: PublicServiceConfiguration) {
    logger.debug('run in background', service, configuration);
    const publicConfiguration = await this.resolveConfiguration(service, configuration);
    const serviceConfiguration = this.getServiceConfiguration({ ...service, ...publicConfiguration });
    const image = this.getImageFromServiceType(serviceConfiguration.type);
    const envVars = Object.assign({}, serviceConfiguration.env, {
      DATA_DIR: CONTAINER_DATA_DIR,
      GA_TRACKING_ID: '',
    });

    const imageName = this.getImageNameForService(service);
    const containerName = this.getContainerNameForService(service);
    const volumes = [{ host: join('data', serviceConfiguration.id), container: CONTAINER_DATA_DIR }];
    const ports = serviceConfiguration.ports;

    this.stop(service);
    image.run({
      detached: true,
      imageName,
      containerName,
      envVars,
      volumes,
      ports,
    });

    Nginx.registerService(serviceConfiguration);
    Nginx.reload();
  }

  async runAndExit(service: Service, configuration?: PublicServiceConfiguration) {
    logger.debug('run and exit', service, configuration);
    const publicConfiguration = await this.resolveConfiguration(service, configuration);
    const { type } = publicConfiguration;
    const serviceConfiguration = this.getServiceConfiguration({ ...service, type });
    const image = this.getImageFromServiceType(serviceConfiguration.type);
    const envVars = Object.assign({}, serviceConfiguration.env, { GA_TRACKING_ID: '' });

    image.run({
      imageName: this.getImageNameForService(service),
      envVars,
    });
  }

  async destroy(service: Service) {
    logger.debug('destroy', service);
    const configuration = this.getServiceConfiguration(service);
    const imageName = this.getImageNameForService(configuration);

    this.stop(service);
    Docker.deleteImage(imageName);
    Nginx.unregisterService(configuration);
    Nginx.reload();
    this.services.delete(configuration.id);
  }

  stop(service: Service) {
    logger.debug('stop', service);
    Docker.stopContainer(this.getContainerNameForService(service));
  }

  private async resolveConfiguration(service: Service, configuration?: PublicServiceConfiguration) {
    return configuration || (await GitHub.fetchServiceConfiguration(service));
  }

  private getContainerNameForService(service: Service) {
    const id = this.getServiceId(service);
    return id.slice(0, 7);
  }

  private getImageNameForService(service: Service) {
    const id = this.getServiceId(service);
    return 'cloudy/' + id;
  }

  private getServiceId(service: Service) {
    const { repository, branch } = service;
    return sha256(repository + branch);
  }

  private getImageFromServiceType(serviceType?: string) {
    const image = serviceType && Docker.getBaseImage(serviceType);
    if (!image) {
      throw new Error('Invalid service type');
    }

    return image;
  }

  private getServiceConfiguration(service: Service & PublicServiceConfiguration): ServiceConfiguration {
    const serviceId = this.getServiceId(service);
    const name = this.getContainerNameForService(service);
    const serviceType = this.resolveServiceType(service.type);
    const hostPort = this.getRandomPort();
    const containerPort = Number(service.port) || hostPort;
    const domains = [service.domain || name + '.' + cloudyDomain];
    const hasWebSocket = Boolean(service.webSocket && service.webSocket.path);
    const webSocket = hasWebSocket ? { path: service.webSocket!.path } : undefined;

    const env: Record<string, string | number> = {
      ...(service.env || {}),
      PORT: containerPort,
    };

    const ports: PortSpecification[] = [hostPort !== containerPort ? [hostPort, containerPort] : [hostPort]];
    if (hasWebSocket) {
      env.WEBSOCKET_PORT = this.getRandomPort();
      ports.push([env.WEBSOCKET_PORT]);
    }

    return {
      id: serviceId,
      name: name,
      type: serviceType,
      branch: service.branch,
      repository: service.repository,
      memory: service.memory,
      webSocket,
      domains,
      ports,
      env,
    };
  }

  private resolveServiceType(type?: string) {
    return type && Docker.hasBaseImage(type) ? type : this.defaultServiceType;
  }

  private getRandomPort(): number {
    const newRandomPort = () => 3000 + Math.round(Math.random() * 60000);
    const portsInUse = Docker.getStatus().reduce(
      (ports, service) => ports.concat(service.ports.map((port) => port[0])),
      [] as number[],
    );

    let port = 0;

    while ((port = newRandomPort())) {
      if (portsInUse.includes(port) === false) break;
    }

    return port;
  }
}

export const Services = new ServiceManager();
