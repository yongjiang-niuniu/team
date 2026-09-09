from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from project_database import default_database_url

LAUNCHER_DIR = ROOT_DIR / "launcher"
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
LOG_DIR = LAUNCHER_DIR / ".logs"

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 5050
FRONTEND_HOST = "127.0.0.1"
FRONTEND_PORT = 5173
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
FRONTEND_URL = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}"


def _print(message: str) -> None:
    print(message, flush=True)


def ensure_command(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path
    raise RuntimeError(f"Required command not found in PATH: {name}")


def backend_python() -> Path:
    if os.name == "nt":
        return BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    return BACKEND_DIR / ".venv" / "bin" / "python"


def is_port_listening(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((BACKEND_HOST, port)) == 0


def wait_for_http(url: str, timeout_seconds: int) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except urllib.error.HTTPError:
            return True
        except OSError:
            time.sleep(0.5)
    return False


def run_checked(command: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    _print(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=cwd, env=env, check=True)


def ensure_backend_venv() -> Path:
    venv_python = backend_python()
    if venv_python.exists():
        return venv_python

    _print("Creating backend virtual environment...")
    run_checked([sys.executable, "-m", "venv", str(BACKEND_DIR / ".venv")], cwd=ROOT_DIR)
    return venv_python


def ensure_dependencies() -> tuple[Path, str]:
    venv_python = ensure_backend_venv()
    npm = ensure_command("npm.cmd" if os.name == "nt" else "npm")

    _print("Installing backend dependencies...")
    run_checked([str(venv_python), "-m", "pip", "install", "-r", str(LAUNCHER_DIR / "requirements.txt")], cwd=ROOT_DIR)

    if not (FRONTEND_DIR / "node_modules").exists():
        _print("Installing frontend dependencies...")
        run_checked([npm, "install"], cwd=FRONTEND_DIR)

    return venv_python, npm


def spawn_process(command: list[str], cwd: Path, env: dict[str, str], log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as log_file:
        kwargs = {
            "cwd": cwd,
            "env": env,
            "stdin": subprocess.DEVNULL,
            "stdout": log_file,
            "stderr": subprocess.STDOUT,
        }
        if os.name == "nt":
            kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "DETACHED_PROCESS", 0)
        else:
            kwargs["start_new_session"] = True
        subprocess.Popen(command, **kwargs)


def backend_env() -> dict[str, str]:
    env = os.environ.copy()
    database_url = env.get("DATABASE_URL", "").strip() or default_database_url()
    env["DATABASE_URL"] = database_url
    env["DBUPDATE_DATABASE_URL"] = database_url
    python_path = env.get("PYTHONPATH", "")
    project_paths = [str(ROOT_DIR), str(BACKEND_DIR)]
    if python_path:
        project_paths.append(python_path)
    env["PYTHONPATH"] = os.pathsep.join(project_paths)
    env["FLASK_DEBUG"] = "0"
    return env


def frontend_env() -> dict[str, str]:
    return os.environ.copy()


def ensure_demo_accounts(venv_python: Path) -> None:
    _print("Ensuring demo accounts exist...")
    run_checked([str(venv_python), "seed_demo_accounts.py"], cwd=BACKEND_DIR, env=backend_env())


def start_backend(venv_python: Path) -> None:
    ensure_demo_accounts(venv_python)

    if is_port_listening(BACKEND_PORT):
        _print(f"Backend already listening on {BACKEND_PORT}.")
        return

    _print("Starting backend...")
    spawn_process(
        [
            str(venv_python),
            "-m",
            "flask",
            "--app",
            "wsgi",
            "run",
            "--host",
            BACKEND_HOST,
            "--port",
            str(BACKEND_PORT),
            "--no-debugger",
            "--no-reload",
        ],
        cwd=BACKEND_DIR,
        env=backend_env(),
        log_path=LOG_DIR / "backend.log",
    )


def start_frontend(npm: str) -> None:
    if is_port_listening(FRONTEND_PORT):
        _print(f"Frontend already listening on {FRONTEND_PORT}.")
        return

    _print("Starting frontend...")
    spawn_process(
        [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--port", str(FRONTEND_PORT)],
        cwd=FRONTEND_DIR,
        env=frontend_env(),
        log_path=LOG_DIR / "frontend.log",
    )


def open_browser() -> None:
    try:
        webbrowser.open(FRONTEND_URL)
    except Exception:
        pass


def main() -> int:
    try:
        venv_python, npm = ensure_dependencies()
        start_backend(venv_python)
        start_frontend(npm)

        if not wait_for_http(BACKEND_URL, timeout_seconds=20):
            raise RuntimeError(f"Backend did not become ready at {BACKEND_URL}. See {LOG_DIR / 'backend.log'}")
        if not wait_for_http(FRONTEND_URL, timeout_seconds=30):
            raise RuntimeError(f"Frontend did not become ready at {FRONTEND_URL}. See {LOG_DIR / 'frontend.log'}")

        open_browser()
        _print("Launcher started.")
        _print(f"Frontend: {FRONTEND_URL}")
        _print(f"Backend: {BACKEND_URL}")
        return 0
    except subprocess.CalledProcessError as exc:
        _print(f"Launcher failed while running: {' '.join(exc.cmd)}")
        return exc.returncode or 1
    except Exception as exc:
        _print(f"Launcher failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
