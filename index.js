const http = require('http');
const { parse } = require('querystring');
const configuration = require('./projects.json');
const sh = require('child_process').spawnSync;

const registry = configuration.registry;
const formHeader = 'application/x-www-form-urlencoded';
const httpSecret = sh('cat', ['.key']);

const log = (...args) => console.log(new Date().toISOString(), ...args);
const image = (p) => `${registry}/${p.tag}`;
const buildArgs = (p) => p.buildArgs ? p.buildArgs.map(s => `--build-arg ${s}`) : [];
const run = (command, args) => log(command, ...args) || sh(command, args, { stdio: 'inherit' }).toString('utf8');
const publish = (p) => run('docker', ['push', image(p)]);
const build = (p) => run('docker', ['build', ...buildArgs(p), '-t', image(p), `${p.projectRoot}`]);
const deploy = (p) => {
  if (!p.service) return;

  const ports = p.expose ? p.expose.map(ports => `-p${ports}`) : [];
  const envVars = p.vars ? p.vars.map(env => ['-e', env]).reduce((a, b) => a.concat(b)) : [];

  run('docker', ['stop', p.service]);
  run('docker', ['run', '--rm', '-d', '--name', p.service, ...ports, ...envVars, p.tag]);
}

function rebuild() {
  run('git', ['pull', '--rebase']);
  configuration.projects.forEach(project => {
    build(project);
    publish(project);
    deploy(project);
  });
}

function readBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => callback(parse(body)));
}

const server = http.createServer((req, res) => {
  switch (true) {
    case req.method === 'POST' && req.url === '/reload':
      log('reloading');
      run('git', ['pull', '--rebase']);
      res.end('');
      process.exit(0);
      break;

    case req.method === 'POST' && req.url === '/deploy' && req.headers['content-type'] === formHeader:
      readBody(req, (body) => {
        if (body.token === httpSecret) {
          rebuild();
          res.end('OK');
          return;
        }

        res.writeHead(401);
        res.end('');
      });
      break;

    case req.method === 'POST' && req.url.startsWith('/deploy/') && req.headers['content-type'] === formHeader:
      readBody(req, (body) => {
        const service = req.url.split('/deploy/')[1];
        const project = configuration.projects.find(p => p.service === service);

        if (body.token !== httpSecret) {
          res.writeHead(401);
          res.end('');
          return;
        }

        if (project) {
          log(`reloading ${project.service}`);
          deploy(project);
          res.end('OK');
          return;
        }

        res.writeHead(404);
        res.end('');
      });
      break;

    case req.method === 'GET' && req.url === '/discover':
      log(`discovered by ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
      res.end(JSON.stringify(configuration.projects.map(p => p.service).filter(Boolean), null, 2));
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
