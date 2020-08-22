import { Services } from './services.js';
import { Server } from './server.js';
import { Docker } from './docker.js';

export async function cli(args) {
  const command = args.shift();
  let services;

  switch (command) {
    case 'build':
      await Services.createServiceFromRepository(...args);
      Server.reload();
      break;

    case 'build-all':
      services = Services.getAllServices();
      for (const service of services) {
        await Services.createServiceFromRepository(service.repository, service.branch);
      }
      Server.reload();
      break;

    case 'deploy-all':
      services = Services.getAllServices();
      for (const service of services) {
        Services.restartService(service.repository, service.branch);
      }
      break;

    case 'update-nginx':
      await Services.reconfigureNginx();
      break;

    case 'create':
      await Services.createServiceKey(...args);
      Server.reload();
      break;

    case 'stop':
      await Services.stopService(...args);
      break;

    case 'start':
      await Services.startService(...args);
      break;

    case 'restart':
      await Services.restartService(...args);
      break;

    case 'del':
    case 'delete':
      await Services.deleteService(...args);
      Server.reload();
      break;

    case 'get-key':
      await Services.getServiceKey(...args);
      break;

    case 'delete-key':
      await Services.deleteServiceKey(...args);
      break;

    case 'list':
    case 'ls':
      const field = args[0];
      services = Services.getAllServices().map((service) => ({
        id: `${service.id} ${Docker.getContainerNameForService(service)}`,
        type: service.type,
        online: `[${service.online ? 'v' : '!'}]`,
        origin: service.repository + ' ' + service.branch,
        ports: service.ports.join(','),
        domains: service.domains.map((x) => `https://${x}`).join(', '),
        key: Services.getServiceKey(service.repository),
      }));

      if (field) {
        return services.map((service) => service[field]).join('\n');
      }

      return formatList(
        [['---', 'Id/Container', 'Type', 'Ports', 'Origin', 'Domains', 'Key'], Array(6).fill('')].concat(
          services.map((_) => [_.online, _.id, _.type, _.ports, _.origin, _.domains, _.key]),
        ),
      );

    default:
      throw new Error('Invalid command!');
  }
}

function formatList(rows) {
  const sizes = {};
  const spaces = (size) => Array(size).fill(' ').join('');
  const rightPad = (string, size) => (string.length < size ? string + spaces(size - string.length) : string);

  rows.forEach((row) => {
    row.forEach((column, index) => (sizes[index] = Math.max(sizes[index] | 0, String(column).length)));
  });

  const formattedList = rows.map((row) =>
    row.map((column, index) => rightPad(String(column), sizes[index])).join(' | '),
  );
  return formattedList.join('\n');
}
