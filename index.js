const http = require('http');
const FS = require('fs');
const crypto = require('crypto');
const configuration = require('./projects.json');
const ChildProcess = require('child_process');
const { time } = require('console');
const _sh = ChildProcess.spawnSync;
const sh = (command, args) => _sh(command, args, { stdio: 'pipe', shell: true }).stdout.toString('utf8');

const readFile = (file) => FS.readFileSync(file).toString('utf8').trim();
const prefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');
const log = (...args) => console.log(new Date().toISOString(), ...args);
const dockerImage = (p) => p.from || `${configuration.registry}/${p.image}:latest`;
const buildArgs = (p) => [...buildArgsBase, ...(p.buildArgs || [])].map(arg => `--build-arg ${arg}`);
const publish = (p) => run('docker', ['push', dockerImage(p)]);
const build = (p) => run('docker', ['build', ...buildArgs(p), '-t', dockerImage(p), `${p.projectRoot}`]);
const json = (x) => JSON.stringify(x, null, 2);
const replaceVars = (text, vars) => text.replace(/\{\{\s*(\w+)\s*}\}/g, (_, variable) => vars[variable]);

const httpSecret = readFile('./.key');
const buildArgsBase = ['CACHEBUST=' + new Date().getTime()]

let isRebuilding = false;

const run = (command, args) => {
  log(command, args);
  log(prefix(sh(command, args)));
};

function findProject(name) {
  return configuration.projects.find(p => p.service === name);
}

function deployProject(project) {
  if (project.service) {
    run('docker', ['stop', project.service]);
    run('docker', ['run', '--rm', '-d', '--name', project.service, ...project.expose, ...project.envVars, dockerImage(project)]);
  }

  if (project.serviceConfig) {
    reloadNginx();
  }
}

function buildProject(project) {
  if (project.image) {
    build(project);
    publish(project);
  }

  if (project.serviceConfig) {
    addNginxConfig(project);
  }
}

function readBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => callback(body));
}

function updateDockerImages(req, res) {
  log('updating cloud images');
  res.writeHead(200);
  res.end();

  run('git', ['pull', '--rebase']);

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
    run('git', ['pull', '--rebase']);

    if (action === 'build') {
      log(`build ${project.service}`);
      buildProject(project);
    } else {
      log(`deploy ${project.service}`);
      deployProject(project);
    }

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

function getRandomPort() {
  return 3000 + ~~(Math.random() * 3000);
}

function addNginxConfig(project) {
  const vars = {
    ...project.env,
    randomPort: project.port
  };

  const sourceFile = project.serviceConfig;
  const source = FS.readFileSync(sourceFile).toString('utf-8');
  const content = replaceVars(source, vars);

  try {
    FS.writeFileSync(`/etc/nginx/cloudy/${project.service}.conf`, content);
  } catch (error) {
    log('Failed to create Nginx configuration!');
    log(error);
  }
}

function reloadNginx() {
  log('Reloading Nginx');

  try {
    ChildProcess.execSync('nginx -t && service nginx reload');
  } catch (error) {
    log('Nginx failed to reload');
    log(error);
  }
}

function replaceInlinePort(text, port) {
  return text.replace(/_randomPort_/g, port);
}

function initializeProject(project) {
  project.expose = [];
  project.envVars = [];

  if (project.randomPort) {
    project.port = getRandomPort();
  }

  if (project.ports) {
    project.expose = project.ports.map(port => replaceInlinePort(`-p127.0.0.1:${port}`, project.port));
  }

  if (project.env) {
    project.envVars = Object.keys(project.env)
      .map(key => ['-e', `${key}="${replaceInlinePort(project.env[key], project.port)}"`])
      .reduce((vars, item) => vars.concat(item), []);
  }
}


configuration.projects.forEach(p => initializeProject(p));

http.createServer((req, res) => {
  if (isRebuilding) {
    res.writeHead(503);
    res.end();
  }

  const requestSignature = req.headers['x-hub-signature'];
  const isPost = req.method === 'POST';
  const isGet = req.method === 'GET';

  readBody(req, function (body) {
    const payloadSignature = 'sha1=' + crypto.createHmac('sha1', httpSecret).update(body).digest('hex');

    if (isPost && payloadSignature !== requestSignature) {
      log('Invalid signature!', payloadSignature, requestSignature);
      res.writeHead(401, 'Unauthorized');
      res.end();
      return;
    }

    switch (true) {
      case isPost && req.url === '/update':
        updateDockerImages(req, res)
        break;

      case isPost && req.url === '/redeployAll':
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
