import { Get, Post, Http } from './http.js';
import { readFile } from './io.js';
import { Services } from './services.js';
import { Server } from './server.js';
import { GitHub } from './github.js';

export async function api() {
  const httpSecret = await readFile('.key');

  Http.when(Get, '/services', (_, response) => response.send(Services.getAllServices()));
  Http.when(Post, '/deploy', async (request, response) => {
    const service = GitHub.getServiceFromWebhook(request.body);
    const serviceKey = Services.getServiceKey(service.repository);

    if (!Http.checkProtectedRoute(request, serviceKey)) {
      response.send(401);
      return;
    }

    response.send(Services.deployService(service));
  });

  Http.when(Post, '/create', async (request, response) => {
    const repository = String(request.body || '').trim();

    try {
      const key = Services.createServiceKey(repository);
      response.send(201, key);
    } catch (error) {
      response.send(400, error);
    }
  });

  Http.when(Post, '/reload', (request, response) => {
    if (!Http.checkProtectedRoute(request, httpSecret)) {
      response.send(401);
      return;
    }

    response.send('');

    setTimeout(() => {
      Server.updateRepository();
      Server.reloadAfterBuild();
    }, 10);
  });

  Http.listen(process.env.PORT || 9999, '127.0.0.1');
}
