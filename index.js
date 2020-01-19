const http = require('http');
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
  req.on('end', () => callback(parse(body)));
}

const server = http.createServer((req, res) => {
  const requestSecret = req.headers['x-hub-signature'];
  const isAuthorised = (req) => req.method === 'POST' && requestSecret === httpSecret;

  log('>>', req.method, req.url);

  switch (true) {
    case isAuthorised(req) && req.url === '/update':
      log('updating cloud');
      run('git', ['pull', '--rebase']);
      res.writeHead(200);
      res.end('');

      setTimeout(() => {
        configuration.projects.forEach(buildProject);
        process.exit(0);
      });
      break;

    case isAuthorised(req) && req.url === '/deploy':
      log('reloading cloud');
      configuration.projects.forEach(deployProject);
      res.end('OK');
      break;

    case isAuthorised(req) && /^\/(build|deploy)/.test(req.url):
      const [, action, service] = req.url.match(/^\/(build|deploy)\/(.+)/);
      const project = findProject(service);

      if (project) {
        log(`reloading ${project.service}`);
        run('git', ['pull', '--rebase']);

        if (action === 'build') {
          buildProject(project);
        }

        deployProject(project);
        res.end('OK');
        return;
      }

      log(`service ${service} not found`);
      res.writeHead(404);
      res.end('');
      break;

    case req.method === 'GET' && req.url === '/discover':
      log(`discovered by ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
      res.end(json(configuration.projects.map(p => p.service).filter(Boolean)));
      break;

    case req.method === 'GET' && req.url === '/status':
      const services = sh('docker', ['ps', '--format', '"{{.Names}}"']).trim().split('\n').map(name => ({ name }));
      res.end(json(services));
      break;

    case req.method === 'GET' && req.url === '/':
      require('fs').createReadStream(__dirname + '/index.html').pipe(res);
      break;

    default:
      res.writeHead(404);
      res.end();
  }
})

server.listen(process.env.PORT || 9999);
