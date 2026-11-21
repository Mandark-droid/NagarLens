# Deployment: Hugging Face Space

Live app: https://kshitijthakkar-nagarlens.hf.space
Space page (build logs, settings): https://huggingface.co/spaces/kshitijthakkar/nagarlens

## How it is deployed

One Docker container (`Dockerfile` at the repo root), public port 7860:

- `next start` serves the web app on 7860.
- `uvicorn backend.main:app` serves the API on 127.0.0.1:8000 inside the container.
- The browser calls `/api/...` on the same origin, and Next proxies it to the API. This is switched on at build
  time by two variables set in the Dockerfile: `API_PROXY_TARGET=http://127.0.0.1:8000` (adds the rewrite in
  `frontend/next.config.ts`) and `NEXT_PUBLIC_API_URL=""` (makes the client use relative URLs).
  Without them, local development is unchanged: the browser calls `http://localhost:8000` directly.
- `deploy/start.sh` starts the API, waits for `/api/health`, then starts the web app.
- No API key is set on the Space, so the explanation panels show cached answers or deterministic templates.
  To enable live Claude there, add `ANTHROPIC_API_KEY` as a Space secret (Settings, Variables and secrets); never
  put a key in a file.
- State written at run time (officer decisions in SQLite, cached AI answers) lives inside the container and is
  reset whenever the Space rebuilds or restarts.

## Redeploy after a new commit

```
uv pip install --python .venv huggingface_hub      # once
hf auth login                                      # once, with a token that has write access
.venv/Scripts/python deploy/push_space.py          # uploads git HEAD; the Space rebuilds in a few minutes
```

`deploy/push_space.py` uploads a clean copy of the last commit (`git archive HEAD`), so uncommitted work, `.env`,
databases, `node_modules` and build output can never be uploaded. It leaves out files the running app does not need
(`demo/`, `tests/`, `docs/tasks/`, the Streamlit fallback). It replaces the Space's README with
`deploy/SPACE_README.md`, which carries the Space settings (Docker SDK, port 7860).

Check the result:

```
.venv/Scripts/python -c "from huggingface_hub import HfApi; print(HfApi().get_space_runtime('kshitijthakkar/nagarlens').stage)"
curl -s https://kshitijthakkar-nagarlens.hf.space/api/health
```

`stage` goes BUILDING, then RUNNING. If it shows BUILD_ERROR or RUNTIME_ERROR, open the Space page and read the logs.

## Run the same container locally (optional, needs Docker)

```
docker build -t nagarlens .
docker run --rm -p 7860:7860 nagarlens     # then open http://localhost:7860
```
