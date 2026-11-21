"""Deploy (or redeploy) NagarLens to its Hugging Face Space. One command, from the repo root:

    .venv/Scripts/python deploy/push_space.py            # deploys the last commit (git HEAD)

What it does: takes a clean copy of the last commit (`git archive HEAD`, so only tracked files, never .env,
databases, node_modules or build output), lays the deployment files on top, swaps in the Space's own README
(deploy/SPACE_README.md, which carries the Space settings), and uploads it. The Space then rebuilds the Docker
image from the Dockerfile at the repo root, which takes a few minutes.

Needs: `uv pip install --python .venv huggingface_hub` and a Hugging Face login with write access
(`hf auth login`). Nothing here reads or uploads a secret; the Space runs without an API key.
"""
import io
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
SPACE_NAME = "nagarlens"
# Deployment files are also copied from the working tree, so a deploy works before they are committed.
OVERLAY = ["Dockerfile", ".dockerignore", "deploy/start.sh", "deploy/SPACE_README.md", "frontend/next.config.ts"]
# Not needed to run the app, or never to be published.
IGNORE = ["demo/**", "tests/**", ".idea/**", ".streamlit/**", "docs/tasks/**", "docs/TEAM_PLAN.md",
          "docs/FOLLOW_THE_RUPEE_HACKATHON_SPEC.md", "**/*.db", ".env", "**/node_modules/**", "**/.next/**",
          "**/__pycache__/**", "app.py", "TASKS.md", "AGENTS.md", "CLAUDE.md"]


def main() -> int:
    api = HfApi()
    user = api.whoami()["name"]
    repo_id = f"{user}/{SPACE_NAME}"
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()

    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp) / "space"
        stage.mkdir()
        tar = subprocess.run(["git", "archive", "--format=tar", "HEAD"], cwd=ROOT, capture_output=True, check=True).stdout
        with tarfile.open(fileobj=io.BytesIO(tar)) as t:
            t.extractall(stage)
        for rel in OVERLAY:
            src = ROOT / rel
            if src.exists():
                (stage / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, stage / rel)
        # shell scripts must have Unix line endings inside the Linux container
        start = stage / "deploy" / "start.sh"
        start.write_bytes(start.read_bytes().replace(b"\r\n", b"\n"))
        shutil.copyfile(stage / "deploy" / "SPACE_README.md", stage / "README.md")
        for forbidden in [".env", "backend/nagarlens.db"]:
            assert not (stage / forbidden).exists(), f"{forbidden} must never be uploaded"

        api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
        api.upload_folder(repo_id=repo_id, repo_type="space", folder_path=str(stage), ignore_patterns=IGNORE,
                          delete_patterns=["*"], commit_message=f"Deploy NagarLens at {commit}")

    print(f"uploaded commit {commit} to https://huggingface.co/spaces/{repo_id}")
    print(f"app (after the build finishes): https://{user.lower()}-{SPACE_NAME}.hf.space")
    return 0


if __name__ == "__main__":
    sys.exit(main())
