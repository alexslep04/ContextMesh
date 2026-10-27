# GitHub bridge

`watch_repo.py` polls the latest commit on a public GitHub repository and writes
the normalized snapshot consumed by `codex_bridge.py`.

```sh
python src/bridge/watch_repo.py --repo alexslep04/ContextMesh
```

The branch defaults to `main`, the polling interval defaults to 120 seconds,
and the snapshot defaults to `src/bridge/repo_context.json`. All can be changed:

```sh
python src/bridge/watch_repo.py \
  --repo owner/repository \
  --branch development \
  --interval 30 \
  --output .contextmesh/repo-context.json
```

The watcher uses GitHub's unauthenticated public API, so GitHub's public rate
limits apply. Stop the process with Ctrl+C.

Run its focused tests from the repository root:

```sh
python -m unittest discover -s tests/bridge
```
