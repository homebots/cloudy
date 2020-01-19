const http = require('http');
const crypto = require('crypto');
const { parse } = require('querystring');
const configuration = require('./projects.json');
const _sh = require('child_process').spawnSync;
const sh = (command, args) => _sh(command, args, { stdio: 'pipe', shell: true }).stdout.toString('utf8');

const httpSecret = require('fs').readFileSync('./.key').toString('utf8').trim();
const buildArgsBase = ['CACHEBUST=' + new Date().getTime()]

const prefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');
const log = (...args) => console.log(new Date().toISOString(), ...args);
const image = (p) => `${configuration.registry}/${p.name}:latest`;
const buildArgs = (p) => [...buildArgsBase, ...(p.buildArgs || [])].map(arg => `--build-arg ${arg}`);
const publish = (p) => run('docker', ['push', image(p)]);
const build = (p) => run('docker', ['build', ...buildArgs(p), '-t', image(p), `${p.projectRoot}`]);
const json = (x) => JSON.stringify(x, null, 2);

let isRebuilding = false;

const run = (command, args) => {
  log(command, args);
  log(prefix(sh(command, args)));
};

function findProject(name) {
  return configuration.projects.find(p => p.service === name);
}

function deployProject(project) {
  if (!project.service) return;

  const ports = project.expose ? project.expose.map(ports => `-p${ports}`) : [];
  const envVars = project.vars ? project.vars.map(env => ['-e', env]).reduce((a, b) => a.concat(b)) : [];

  run('docker', ['stop', project.service]);
  run('docker', ['run', '--rm', '-d', '--name', project.service, ...ports, ...envVars, image(project)]);
}

function buildProject(project) {
  build(project);
  publish(project);
}

function readBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => callback(body));
}

function updateDockerImages(req, res) {
  log('updating cloud images');
  run('git', ['pull', '--rebase']);
  res.writeHead(200);
  res.end();

  setTimeout(() => {
    if (isRebuilding) return;

    isRebuilding = true;
    configuration.projects.forEach(buildProject);
    process.exit(0);
  });
}

function redeployAllImages(req, res) {
  log('reloading cloud');
  configuration.projects.forEach(deployProject);
  res.writeHead(201);
  res.end();
}

function redeploySpecificImage(req, res) {
  const [, action, service] = req.url.match(/^\/(build|deploy)\/(.+)/);
  const project = findProject(service);

  if (project) {
    log(`reloading ${project.service}`);
    run('git', ['pull', '--rebase']);

    if (action === 'build') {
      buildProject(project);
    }

    deployProject(project);
    res.writeHead(201);
    res.end();
    return;
  }

  log(`service ${service} not found`);
  res.writeHead(404);
  res.end();
}

function listServices(req, res) {
  log(`discovered by ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
  res.end(json(configuration.projects.map(p => p.service).filter(Boolean)));
}

function listImages(req, res) {
  const services = sh('docker', ['ps', '--format', '"{{.Names}}"']).trim().split('\n').map(name => ({ name }));
  res.end(json(services));
}

http.createServer((req, res) => {
  if (isRebuilding) {
    res.writeHead(503);
    res.end();
  }

  const requestSignature = req.headers['x-hub-signature'];
  const isPost = req.method === 'POST';
  const isGet = req.method === 'GET';

  readBody(req, function(body) {
    log('>>', req.method, req.url, req.headers);
    const payloadSignature = 'sha1=' + crypto.createHmac('sha1', httpSecret).update(body).digest('hex');
    log(payloadSignature, requestSignature);

    if (isPost && requestSignature !== httpSecret) {
      res.writeHead(401, 'Unauthorized');
      res.end();
      return;
    }

    switch (true) {
      case isPost && req.url === '/update':
        updateDockerImages(req, res)
        break;

      case isPost && req.url === '/deploy':
        redeployAllImages(req, res);
        break;

      case isPost && /^\/(build|deploy)/.test(req.url):
        redeploySpecificImage(req, res);
        break;

      case isGet && req.url === '/discover':
        listServices(req, res);
        break;

      case isGet && req.url === '/status':
        listImages(req, res);
        break;

      case isGet && req.url === '/':
        require('fs').createReadStream(__dirname + '/index.html').pipe(res);
        break;

      default:
        res.writeHead(404);
        res.end();
    }
  });
}).listen(process.env.PORT || 9999);
