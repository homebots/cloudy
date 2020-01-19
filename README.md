# Cloudy

RESTful server + dashboard for a small Docker-based cloud infrastructure

## Setup

- Install Docker
- Install NodeJS

## project.json

Here's where the cloud services and docker images are declared

```json
{
  "registry": "registry.domain.com/v2",
  {
    "name": "docker-image-name",
    "projectRoot": "path/to/docker/project/folder",
    "service": "docker-container-name",
    "expose": ["80:80", "81:3000"],
    "vars": ["DEBUG=1", "ENV_VAR=2"]
  },
}
```

The server with run `registry.domain.com/v2/docker-image-name` with exposed ports and environment variables, using a container named `docker-container-name`.

## .key

Add a very long key here to secure the server.
The same key can be added to `localStorage.key` in the client browser where the cloud is managed.

It goes without saying that is very important to keep this key secure.
