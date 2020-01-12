const http = require('http');
const { parse } = require('querystring');
const configuration = require('./projects.json');
const _sh = require('child_process').spawnSync;
const sh = (command, args) => _sh(command, args, { stdio: 'pipe', shell: true }).stdout.toString('utf8');

const formHeader = 'application/x-www-form-urlencoded';
const httpSecret = require('fs').readFileSync('./.key').toString('utf8');
const buildArgsBase = ['CACHEBUST=' + new Date().getTime()]

const prefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');
const log = (...args) => console.log(new Date().toISOString(), ...args);
const image = (p) => `${configuration.registry}/${p.name}:latest`;
const buildArgs = (p) => [...buildArgsBase, ...(p.buildArgs || [])].map(arg => `--build-arg ${arg}`);
const publish = (p) => run('docker', ['push', image(p)]);
const build = (p) => run('docker', ['build', ...buildArgs(p), '-t', image(p), `${p.projectRoot}`]);

const run = (command, args) => {
  log(command, ...args);
  log(prefix(sh(command, args)));
};

const deploy = (p) => {
  if (!p.service) return;

  const ports = p.expose ? p.expose.map(ports => `-p${ports}`) : [];
  const envVars = p.vars ? p.vars.map(env => ['-e', env]).reduce((a, b) => a.concat(b)) : [];

  run('docker', ['stop', p.service]);
  run('docker', ['run', '--rm', '-d', '--name', p.service, ...ports, ...envVars, image(p)]);
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
      log('reloading cloud');
      run('git', ['pull', '--rebase']);
      rebuild();
      res.end('');
      process.exit(0);
      break;

    case req.method === 'POST' && req.url === '/deploy' && req.headers['content-type'] === formHeader:
      readBody(req, (body) => {
        if (body.token !== httpSecret) {
          res.writeHead(401);
          res.end('');
          return;
        }

        rebuild();
        res.end('OK');
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
