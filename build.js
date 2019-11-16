const http = require('https');
const sh = require('child_process').spawnSync;
const dockerfiles = require('./dockerfiles.json');
const deployHeaders = { 'X-Http-Secret': process.env.HTTP_SECRET || '' };
const registry = dockerfiles.registry;

const run = (command, args) => sh(command, args, { stdio: 'inherit' }).toString('utf8');
const build = (p) => run('docker', ['build', '--no-cache', '-t', `${registry}/${p.tag}`, `${p.projectRoot}`]);
const publish = (p) => run('docker', ['push', `${registry}/${p.tag}`]);
const deploy = (p) => http.get(`https://hooks.homebots.io/deploy/${p.name}`, { headers: deployHeaders }, response => response.pipe(process.stdout));

dockerfiles.projects.forEach(project => {
  build(project);
  publish(project);
  deploy(project);
});
