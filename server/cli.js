import { Services } from './services.js';

export async function cli(args) {
  const command = args.shift();

  switch (command) {
    case 'build':
      return await Services.rebuildRepository(...args);

    case 'create':
      return await Services.createServiceKey(...args);

    case 'list':
    case 'ls':
      return (await Services.getAllServices())
        .map(service => {
          return `${service.id} -- ${service.type} -- ${service.ports.join(', ')} -- ${service.repository} -- ${service.domains.map(x => `https://${x}`).join(', ')}`;
        })
        .join('\n');

    default:
      throw new Error('Invalid command!');
  }
}
