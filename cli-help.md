# create-key / get-key / delete-key

```bash
# Returns a key to use with GitHub webhooks

cy create-key repository
# >> 4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f

cy get-key repository
# >> 4de1f5aab51b969dace864d506ad88cd1bd4c5c710b6145ff2e196012f3d292f

cy delete-key repository
```

# build

```bash
cy build repository
cy build repository branch-name
```

# run

```bash
# Same as calling build, then running the created container with a
# specific configuration
cy run repository
cy run repository branch-name
```

# destroy

```bash
cy destroy repository
cy destroy repository branch-name
```

# ls, list

```bash
# List all registered services
cy list

# List all registered services, printing only the 'origin' column
cy list origin
```

# destroy

```bash
cy destroy repository [master]
cy destroy repository branch-name
```

# stop / start / restart

```bash
cy stop repository master
cy start repository branch-name
cy restart repository
```

# update-nginx

```bash
# recreate the server configuration for all registered services
cy update-nginx
```

# build-all / deploy-all

```bash
# destroys and recreates all registered services
cy build-all

# redeploys all services without a rebuild step
cy deploy-all

```
