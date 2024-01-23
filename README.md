# ARC55: Msig App

TEALScript Reference Implementation of [ARC55](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0055.md)

Build:
```sh
bun install
bunx tealscript src/*.algo.ts dist
```

Test:
```sh
bun run index.ts
```

If you make any changes to the TEALScript files, you can regenerate the client library with algokitgen
```sh
bunx algokitgen generate -a dist/MsigApp.arc32.json -o client/MsigApp.client.ts
# Of if you want just the ARC55 client
bunx tealscript src/arcs/arc55.algo.ts dist
bunx algokitgen generate -a dist/ARC55.arc32.json -o client/ARC55.client.ts
```
