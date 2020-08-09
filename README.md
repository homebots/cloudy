# Cloudy

Cloudy is **a tiny REST API to deploy micro services** from GitHub repositories. It has **no dependencies**.

It works by receiving GitHub WebHook calls, cloning the source code and running it inside a Docker container.

> SEE ALSO:
>
> The companion node service [that builds the base cloud containers](https://github.com/homebots/cloudy-images) from a git repository.

## How it works

A push to a GitHub repo will trigger a webhook.

The service will then clone the source repository and deploy it to a Docker container, using one of the base images.

<!-- The server with run `registry.domain.com/v2/docker-image-name` with the exposed ports and environment variables. -->

A reverse proxy with Nginx should be set up in the host machine to map the domains to docker containers.

## How to run the Cloudy server

Define the registry and domain where the Cloudy service will run:

```
exports CLOUDY_DOCKER_REGISTRY='your.docker-registry.com'
exports CLOUDY_DOMAIN='your-domain.com'
exports PORT=9999
```

Then just run `node index.js` in a host machine. Use of [`pm2`](https://www.npmjs.com/package/pm2) is recommended to allow the service to restart when updates are available.

## Service configurations

Add a file called `service.json` to a GitHub repository, with any of the following options:

```json
{
  // one of "node" or "nginx". default is "node"
  "type": "node",

  // optional. If not provided, default is [service-id].[cloudy-domain],
  // e.g. bc5a6b6d5bbc5a6b6d5b.your-domain.com
  "domain": "abc.example.com",

  // any env variables you need to set
  "env": {
    "FOO": "foo",
    "DEBUG": "true",
  },

  // additional ports to expose
  "ports": [1234, 5678]
}
```

## Environment variables

In addition to any variables provided by a service configuration, these will be set in every machine:

```
DATA_DIR          A folder where any files can be stored
GIT_URL           https://github.com/origin-repo/name
```

## Security and the .key file

Create a very long key hash in a file called `.key` (in the server root folder) to secure the server.

It goes without saying that is very important to keep this key secure.

Then use this key in the 'Secret' input of GitHub Webhooks, in every repository that will deploy a service.

## Adding a deploy Webhook

First we need to create a new deploy key.
Let's say we want to deploy a service from 'https://github.com/repository/name':

```
curl -X POST 'https://cloudy.example.com/create' --data 'repository/name'

>> 4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f
```

Go to `Repository Settings > Webhooks` and add a new webhook (https://github.com/repository/name/settings/hooks/new)

- URL: the domain where Cloudy is running + '/deploy', e.g. `https://cloudy.example.com/deploy`

- Content Type: application/json

- Secret: `4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f`
