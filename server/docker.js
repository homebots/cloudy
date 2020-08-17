import { Shell } from './shell.js';
import { Log } from './log.js';
import { GitHub } from './github.js';
import { join, readDirectory } from './io.js';

const logger = Log.create('docker');
const prefixArgs = (prefix, args) => args.map(arg => `${prefix} ${arg}`);
const getBuildArgs = (args = []) => prefixArgs('--build-arg', ['CACHEBUSTER=' + new Date().getTime(), ...args]);
const getDockerTag = (service) => 'cloudy/' + service.id;
const getContainerPort = (host, container) => `127.0.0.1:${Number(host)}:${Number(container)}`;
const pathByType = {};
const dataDir = '/opt/data';

class DockerManager {
  constructor() {
    this.init();
  }

  async init() {
    const images = await readDirectory('images');
    this.availableServiceTypes = images;
    this.defaultServiceType = 'node';

    images.forEach(image => pathByType[image] = join('images', image));
  }

  getRunningContainers() {
    return Shell.exec('docker', ['ps', '--format', '"{{.Names}}"']).trim().split('\n');
  }

  async createImage(service) {
    const cloneUrl = GitHub.getCloneUrl(service.repository);

    try {
      const buildArgs = getBuildArgs(['GIT_URL=' + cloneUrl, 'GIT_BRANCH=' + service.branch]);
      const folder = pathByType[service.type];

      if (!folder) {
        throw new Error(`Invalid service type: ${service.type}`);
      }

      return Shell.execAndLog('docker', ['build', '--quiet', ...buildArgs, '-t', getDockerTag(service), folder]);
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to create image for ' + cloneUrl + ':\n' + error.message);
    }
  }

  async runService(service) {
    const volumes = [
      join('data', service.id) + ':' + dataDir,
    ];

    const ports = service.ports.map(port => getContainerPort(port, port));

    const args = [
      ...prefixArgs('-p', ports),
      ...prefixArgs('-v', volumes),
      '--name', service.id,
    ];

    const env = Object.entries(service.env).concat([
      ['DATA_DIR', dataDir],
    ]);

    env.forEach(variablePair => {
      args.push('-e');
      args.push(`'${variablePair.join('=').replace(/'/g, '')}'`);
    });

    const maxMemory = process.env.CLOUDY_MAX_MEMORY || '32mb';
    args.push(`--memory=${maxMemory}`, '--cpus=1');

    Shell.execAndLog('docker', ['run', '--rm', '-d', ...args, getDockerTag(service)]);
  }

  async stopService(service) {
    const runningContainers = this.getRunningContainers();

    if (runningContainers.includes(service.id)) {
      Shell.execAndLog('docker', ['stop', '--time', '2', service.id]);
    }
  }
}

export const Docker = new DockerManager();
