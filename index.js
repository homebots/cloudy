(async () => {
  let configuration;
  const http = require('http');
  const FS = require('fs').promises;
  const crypto = require('crypto');
  const ChildProcess = require('child_process');
  const Path = require('path');

  const shOptions = { stdio: 'pipe', shell: true };
  const _sh = ChildProcess.spawnSync;
  const sh = (command, args) => _sh(command, args, shOptions).stdout.toString('utf8');
  const readFile = async (file) => (await FS.readFile(Path.join(__dirname, file))).toString('utf8').trim();
  const prefix = (string) => string.trim().split('\n').filter(Boolean).map(line => `>> ${line}`).join('\n');
  const log = (...args) => console.log(new Date().toISOString(), ...args);
  const dockerImage = (p) => p.from || `${configuration.registry}/${p.image}:latest`;
  const buildArgs = (p) => ['CACHEBUSTER=' + new Date().getTime(), ...(p.buildArgs || [])].map(arg => `--build-arg ${arg}`);
  const dockerPublish = (p) => run('docker', ['push', dockerImage(p)]);
  const dockerBuild = (p) => run('docker', ['build', ...buildArgs(p), '-t', dockerImage(p), `${p.projectRoot}`]);
  const toJson = (x) => JSON.stringify(x, null, 2);
  const replaceVars = (text, vars) => text.replace(/\{\{\s*(\w+)\s*}\}/g, (_, variable) => vars[variable]);
  const httpSecret = await readFile('.key');

  let isRebuilding = false;

  const run = (command, args) => {
    log(command, args.join(' '));
    log(prefix(sh(command, args)));
  };

  function filterProjects(name) {
    return name ? configuration.projects.filter(p => p.service === name) : configuration.projects;
  }

  async function buildByName(serviceName) {
    isRebuilding = true;

    try {
      filterProjects(serviceName).forEach(p => buildProject(p));
    } catch (e) {}

    isRebuilding = false;
  }

  async function deployByName(serviceName) {
    filterProjects(serviceName).forEach(async (p) => await deployProject(p));
    reloadNginx();
  }

  function buildProject(project) {
    log('building project', project.service || project.image);

    if (project.image) {
      dockerBuild(project);
      dockerPublish(project);
    }
  }

  async function deployProject(project) {
    log('deploying project', project.service || project.image);

    if (!project.service) return;

    run('docker', ['stop', project.service]);
    run('docker', ['run', '--rm', '-d', '--name', project.service, ...project.expose, ...project.envVars, ...project.mount, dockerImage(project)]);

    if (project.serviceConfig) {
      await addNginxConfig(project);
    }
  }

  function updateRepository() {
    log('updating repository');

    try {
      run('git', ['pull', '--rebase']);
    } catch (error) {
      log('failed to fetch', error);
    }
  }

  function listServices(req, res) {
    log(`discovered by ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    res.end(toJson(configuration.projects.map(p => p.service).filter(Boolean)));
  }

  function listImages(_, res) {
    const services = sh('docker', ['ps', '--format', '"{{.Names}}"']).trim().split('\n').map(name => ({
      name
    }));
    res.end(toJson(services));
  }

  async function addNginxConfig(project) {
    const vars = {
      ...project.env,
      port: project.port,
      service: project.service,
    };

    const sourceFile = project.serviceConfig;
    const source = await readFile(sourceFile);
    const content = replaceVars(source, vars);

    try {
      await FS.writeFile(Path.join(__dirname, 'nginx-sites', `${project.service}.conf`), content);
    } catch (error) {
      log('Failed to create Nginx configuration!');
      log(error);
    }
  }

  async function reloadNginx() {
    log('Reloading Nginx');

    try {
      ChildProcess.execSync('nginx -t && service nginx reload');
    } catch (error) {
      log('Nginx failed to reload');
      log(error.message);
    }
  }

  function readBody(request) {
    return new Promise(resolve => {
      let body = '';
      request.on('data', chunk => body += String(chunk));
      request.on('end', () => resolve(body));
    });
  }

  async function initializeProjectConfiguration() {
    configuration = JSON.parse(await FS.readFile('./projects.json'));
    let sequentialPort = 2100;
    const replaceInlinePort = (text, port) => text.replace(/_port_/g, port);

    configuration.projects.forEach(project => {
      project.expose = [];
      project.envVars = [];
      project.mount = [];

      if (project.service && !project.port) {
        project.port = sequentialPort++;
      }

      if (project.ports) {
        project.expose = project.ports.map(port => replaceInlinePort(`-p127.0.0.1:${port}`, project.port));
      }

      if (project.env) {
        project.envVars = Object.keys(project.env)
          .map(key => ['-e', `${key}="${replaceInlinePort(project.env[key], project.port)}"`])
          .reduce((vars, item) => vars.concat(item), []);
      }

      if (project.volumes) {
        project.mount = project.volumes.map(volume => ['-v' + volume.replace('_data_', `$PWD/data/${project.service}`)])
      }

      project.envVars.push('-e', 'API_KEY=' + httpSecret);
    });
  }

  const server = http.createServer(async (req, res) => {
    if (isRebuilding) {
      res.writeHead(503);
      res.end();
    }

    const requestSignature = req.headers['x-hub-signature'];
    const isPost = req.method === 'POST';
    const isGet = req.method === 'GET';
    const getProjectFromUrl = (url) => url.match(/^\/(build|deploy)\/(.+)/)[2];

    if (isPost) {
      const requestBody = await readBody(req);
      const payloadSignature = 'sha1=' + crypto.createHmac('sha1', httpSecret).update(requestBody).digest('hex');

      if (payloadSignature !== requestSignature) {
        log('Invalid signature!', payloadSignature, requestSignature);
        res.writeHead(401, 'Unauthorized');
        res.end();
        return;
      }
    }

    switch (true) {
      case isPost && req.url === '/restart':
        res.writeHead(202);
        res.end('');

        sh('pm2 reload cloudy');
        setTimeout(() => process.exit(0));
        break;

      case isPost && req.url === '/update':
        res.writeHead(202);
        res.end('');

        setTimeout(async () => {
          updateRepository();
          await initializeProjectConfiguration();
          await buildByName();
          deployByName();
        });
        break;

      case isPost && req.url === '/redeployAll':
        res.writeHead(202);
        res.end();

        deployByName();
        break;

      case isPost && /^\/build\//.test(req.url):
        res.writeHead(202);
        res.end();

        setTimeout(async () => {
          updateRepository();
          const name = getProjectFromUrl(req.url);
          await buildByName(name);
          deployByName(name);
        });
        break;

      case isPost && /^\/deploy\//.test(req.url):
        res.writeHead(202);
        res.end();

        setTimeout(() => deployByName(getProjectFromUrl(req.url)));
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

  server.listen(process.env.PORT || 9999, '127.0.0.1');

  initializeProjectConfiguration();
})();
