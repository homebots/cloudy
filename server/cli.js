import { Services } from './services.js';

export async function cli(args) {
  const command = args.shift();

  switch (command) {
    case 'build':
      return await Services.createServiceFromRepository(...args);

    case 'build-local':
      return await Services.buildServiceFromStoredSettings(...args);

    case 'create':
      return await Services.createServiceKey(...args);

    case 'stop':
      return await Services.stopService(...args);

    case 'start':
      return await Services.startService(...args);

    case 'del':
    case 'delete':
      return await Services.deleteService(...args);

    case 'getkey':
      return await Services.getServiceKey(...args);

    case 'list':
    case 'ls':
      return Services.getAllServices()
        .map(service => {
          return `[ ${service.online ? 'v' : '!'} ] ${service.id} -- ${service.type} -- ${service.ports.join(', ')} -- ${service.repository} ${service.branch} -- ${service.domains.map(x => `https://${x}`).join(', ')}`;
        })
        .join('\n');

    default:
      throw new Error('Invalid command!');
  }
}
