import { Services } from './service.js';
import { Server } from './server.js';
import { Service } from './models.js';
import { GitHub } from './github.js';
import { KeyManager } from './keys.js';

export async function cli(args: string[]) {
  const command = args.shift();
  const [repository, branch] = args;
  const service: Service = { repository, branch: branch || 'master' };

  let services;

  switch (command) {
    case 'build':
      const configuration = await GitHub.fetchServiceConfiguration(service);
      await Services.create(service, configuration);
      await Services.build(service, configuration);
      await Services.runInBackground(service, configuration);
      Server.reload();
      break;

    case 'run':
      await Services.runAndExit(service);
      break;

    case 'destroy':
      await Services.destroy(service);
      Server.reload();
      break;

    case 'create-key':
      const repositoryExists = await GitHub.exists(repository);
      if (!repositoryExists) {
        throw new Error('Repository not found');
      }

      const key = await KeyManager.createServiceKey(service);
      Server.reload();
      return key;

    case 'get-key':
      return await KeyManager.getServiceKey(service);

    case 'delete-key':
      await KeyManager.deleteServiceKey(service);
      break;

    case 'stop':
      await Services.stop(service);
      break;

    case 'start':
      await Services.runInBackground(service);
      break;

    case 'restart':
      await Services.stop(service);
      await Services.runInBackground(service);
      break;

    case 'restart-all':
      for (const service of Services.getStatus()) {
        await Services.stop(service);
        await Services.runInBackground(service);
      }
      Server.reload();
      break;

    case 'build-all':
      for (const service of Services.getStatus()) {
        await Services.build(service);
        await Services.runInBackground(service);
      }
      Server.reload();
      break;

    case 'list':
    case 'ls':
      services = Services.getStatus().map((service) => ({
        id: `${service.name}`,
        type: service.type,
        online: `[${service.online ? 'v' : '!'}]`,
        origin: (service.repository + ' ' + ((service.branch !== 'master' && service.branch) || '')).trim(),
        key: KeyManager.getServiceKey(service),
      }));

      const field = args[0];

      if (field) {
        return services.map((service: any) => service[field]).join('\n');
      }

      return formatList(
        [['---', 'Id/Container', 'Type', 'Origin', 'Key'], Array(5).fill('')].concat(
          services.map((_) => [_.online, _.id, _.type, _.origin, _.key]),
        ),
      );

    case 'status':
      return JSON.stringify(Services.getStatusOf(service), null, 2);

    default:
      throw new Error('Invalid command!');
  }

  return '';
}

function formatList(rows: any[]) {
  const sizes: Record<number, number> = {};
  const spaces = (size: number) => Array(size).fill(' ').join('');
  const rightPad = (string: string | any[], size: number) =>
    string.length < size ? string + spaces(size - string.length) : string;

  rows.forEach((row) => {
    row.forEach((column: any, index: number) => (sizes[index] = Math.max(sizes[index] | 0, String(column).length)));
  });

  const formattedList = rows.map((row) =>
    row.map((column: any, index: number) => rightPad(String(column), sizes[index])).join(' | '),
  );
  return formattedList.join('\n');
}
