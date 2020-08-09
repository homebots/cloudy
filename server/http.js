import { get as getHttp, createServer } from 'http';
import { get as getHttps } from 'https';
import { createHmac } from 'crypto';
import { Log, serializeError } from './log.js';
import { randomBytes } from 'crypto';

const sha1 = (secret, payload) => createHmac('sha1', secret).update(payload).digest('hex');
const toJson = (x) => JSON.stringify(x, null, 2);
const logger = Log.create('http');

const tryToParseJson = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

class HttpServer {
  constructor() {
    this.routes = [];
    this.server = createServer((request, response) => this.dispatch(request, response));
  }

  createUrlMatcher(url) {
    if (typeof url === 'string') {
      return (candidateUrl) => candidateUrl === url;
    }

    return (candidateUrl) => url.test(candidateUrl)
  }

  when(method, url, handler) {
    const match = this.createUrlMatcher(url);
    this.routes.push({ method, handler, match });
  }

  listen(port, host) {
    this.server.listen(port, host);
  }

  checkProtectedRoute(request, secret) {
    const requestSignature = request.headers['x-hub-signature'];
    const payloadSignature = 'sha1=' + sha1(secret, request.bodyText || request.body);
    const valid = payloadSignature === requestSignature;

    if (!valid) {
      logger.error(`Invalid request ${request.id}, signature: ${requestSignature}, expected ${payloadSignature}`);
    }

    return valid;
  };

  async dispatch(request, response) {
    const { method, url } = request;
    const match = this.routes.filter(route => route.method === method && route.match(url));

    if (!match.length) {
      response.writeHead(404);
      response.end('');
      return;
    }

    request.id = response.id = randomBytes(16).toString('hex');
    response.request = request;

    this.augmentResponse(response);

    if (method === Post) {
      await readStreamBody(request);
    }

    const route = match[0];

    try {
      route.handler(request, response);
    } catch (error) {
      this.logError(request.id, error);
      response.send(500, { traceId: request.id });
    }
  }

  augmentResponse(response) {
    const send = (value) => {
      if (typeof value !== 'string') {
        value = toJson(value);
      }

      response.end(value);
      this.logRequest(response.request, response, value);
    };

    const sendError = (error) => {
      this.logError(response.id, error);
      response.writeHead(500);
      send(toJson({ traceId: response.id }));
    };

    response.send = function (status, body = '') {
      if (status instanceof Promise) {
        status.then(send).catch(sendError);
        return;
      }

      if (status instanceof Error) {
        sendError(status);
        return;
      }

      if (arguments.length === 2 || typeof status === 'number') {
        response.writeHead(status);
        send(body);
        return;
      }

      send(status);
    };
  }

  logError(traceId, error) {
    logger.error({ traceId, error: serializeError(error) });
  }

  logRequest(request, response, responseBody) {
    const { url, method, body, headers } = request;
    let bodyAsString = body || '';

    if (Buffer.isBuffer(body)) {
      bodyAsString = body.toString('utf8');
    } else if (typeof body === 'object') {
      bodyAsString = JSON.stringify(body);
    }

    logger.debug({ request: { url, method, body: bodyAsString, headers, }, response: [response.statusCode, responseBody] });
  }

  fetch(url, requestOptions) {
    return new Promise((resolve, reject) => {
      const urlObject = new URL(url);
      const request = (urlObject.protocol === 'https:' ? getHttps : getHttp)(urlObject, requestOptions);
      const onError = (error) => reject({ error, ok: false });

      request.on('response', async (response) => {
        const body = await readStreamBody(response);

        response.on('error', onError);
        resolve({
          headers: response.headers,
          body,
          status: response.statusCode,
          ok: response.statusCode < 400
        });
      });

      request.on('error', onError);
      request.end();
    });
  }
}

function readStreamBody(stream) {
  return new Promise(resolve => {
    let body = [];
    const contentType = stream.headers['content-type'] || '';

    stream.on('data', chunk => body.push(chunk));
    stream.on('end', () => {
      stream.body = Buffer.concat(body);
      const isJson = contentType.startsWith('application/json');

      if (isJson || contentType.startsWith('text/')) {
        stream.body = stream.body.toString('utf8');
      }

      if (isJson) {
        stream.bodyText = stream.body;
        stream.body = tryToParseJson(stream.body);
      }

      resolve(stream.body);
    });
  });
}

export const Http = new HttpServer();
export const Get = 'GET';
export const Post = 'POST';