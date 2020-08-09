import { Get, Post, Http } from './server/http.js';
import { readFile } from './server/io.js';
import { Services } from './server/services.js';
import { Server } from './server/server.js';
import { Github } from './server/github.js';

async function main() {
  const httpSecret = await readFile('.key');

  Http.when(Get, '/services', (_, response) => response.send(Services.getAllServices()));
  Http.when(Post, '/deploy', async (request, response) => {
    const service = await Github.getServiceFromWebhook(request.body);
    const serviceKey = Services.getServiceKey(service.repository);

    if (!Http.checkProtectedRoute(request, serviceKey)) {
      response.send(401);
      return;
    }

    const configuration = await Github.fetchServiceConfiguration(service.configurationUrl);

    response.send(Services.createService({
      ...configuration,
      ...service,
    }));
  });

  Http.when(Post, '/create', async(request, response) => {
    const repository = String(request.body || '');

    if (!repository) {
      response.send(400, 'Invalid repository');
      return;
    }

    const serviceKey = Services.getServiceKey(repository);

    if (serviceKey) {
      response.send(422, '');
      return;
    }

    const key = Services.createServiceKey(repository);
    response.send(201, key);
  });

  Http.when(Post, '/reload', (request, response) => {
    if (!Http.checkProtectedRoute(request, httpSecret)) {
      response.send(401);
      return;
    }

    response.send('');

    setTimeout(() => {
      Server.updateRepository();
      Server.reload();
    }, 10);
  });

  Http.listen(process.env.PORT || 9999, '127.0.0.1');
}

main();