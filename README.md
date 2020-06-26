# Cloudy

RESTful server + dashboard for a small Docker-based cloud infrastructure

## Setup

- Install Docker
- Install NodeJS

## project.json

Here's where the cloud services and docker images are declared

```
{
  "registry": "registry.domain.com/v2",
  "projects": [{
    "image": "docker-image-name",
    "projectRoot": "path/to/docker/project/folder",
    "service": "service-name",
    "serviceConfig": "path/to/nginx.conf",
    "port" 5000,
    "ports": ["__port__:__port__", "81:3000"],
    "env": {
      "DEBUG=1",
      "ENV_VAR=2"
    }
  },
}
```

The server with run `registry.domain.com/v2/docker-image-name` with exposed ports and environment variables, using a container named `docker-container-name`.

## .key file

Add a very long key to `.key` to secure the server.
The same key can be added to `localStorage.key` in the client browser where the cloud is managed.

It goes without saying that is very important to keep this key secure.

This key is never sent over HTTP. Instead, it is used to sign the POST requests on client side.
Without a key, only GET requests are allowed, which show the status of each service.
