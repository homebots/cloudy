import { Services } from './services.js';

export async function cli(args) {
  const command = args.shift();

  switch (command) {
    case 'build':
      return await Services.rebuildRepository(...args);

    case 'create':
      return await Services.createServiceKey(...args);

    default:
      throw new Error('Invalid command!');
  }
}
