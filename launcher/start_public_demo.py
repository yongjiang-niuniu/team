from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
import webbrowser
from pathlib import Path

from start_app import (
    BACKEND_URL,
    FRONTEND_DIR,
    FRONTEND_HOST,
    LOG_DIR,
    ensure_dependencies,
    is_port_listening,
    spawn_process,
    start_backend,
    wait_for_http,
)


PUBLIC_FRONTEND_PORT = 5174
PUBLIC_FRONTEND_URL = f"http://{FRONTEND_HOST}:{PUBLIC_FRONTEND_PORT}"
NGROK_URL_PATTERN = re.compile(
    r"https://[-a-zA-Z0-9]+(?:\.ngrok-free\.app|\.ngrok-free\.dev|\.ngrok\.app|\.ngrok\.io)",
    re.IGNORECASE,
)


def _print(message: str) -> None:
    print(message, flush=True)


def find_ngrok() -> str:
    bundled = Path(__file__).resolve().parent / ("ngrok.exe" if os.name == "nt" else "ngrok")
    if bundled.exists():
        return str(bundled)

    command = shutil.which("ngrok.exe" if os.name == "nt" else "ngrok") or shutil.which("ngrok")
    if command:
        return command

    raise RuntimeError(
        "ngrok was not found. Install ngrok first, then run this launcher again. "
        "Windows: winget install Ngrok.Ngrok. "
        "If ngrok asks for an auth token, run: ngrok config add-authtoken <your-token>"
    )


def frontend_public_env() -> dict[str, str]:
    env = os.environ.copy()
    env["VITE_API_BASE_URL"] = "same-origin"
    env["VITE_BACKEND_PROXY_TARGET"] = BACKEND_URL
    env["VITE_ALLOWED_HOSTS"] = "all"
    return env


def start_public_frontend(npm: str) -> None:
    if is_port_listening(PUBLIC_FRONTEND_PORT):
        _print(f"Public demo frontend already listening on {PUBLIC_FRONTEND_PORT}.")
        return

    _print("Starting public demo frontend...")
    spawn_process(
        [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--port", str(PUBLIC_FRONTEND_PORT)],
        cwd=FRONTEND_DIR,
        env=frontend_public_env(),
        log_path=LOG_DIR / "public-frontend.log",
    )


def stop_existing_public_demo_launchers() -> None:
    """Stop stale launcher parents from previous runs, while keeping this process alive."""
    if os.name != "nt":
        return

    current_pid = os.getpid()
    command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        (
            "Get-CimInstance Win32_Process | "
            "Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*start_public_demo.py*' "
            f"-and $_.ProcessId -ne {current_pid} }} | "
            "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
        ),
    ]
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if result.returncode == 0:
        time.sleep(0.5)


def stop_existing_public_tunnels() -> None:
    """Clear stale public-demo tunnel processes before making a fresh link."""
    _print("Checking for existing public demo tunnel processes...")
    if os.name == "nt":
        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            (
                "Get-CimInstance Win32_Process | "
                "Where-Object { "
                "($_.Name -eq 'ngrok.exe' -and $_.CommandLine -like '*http*' "
                f"-and $_.CommandLine -like '*{PUBLIC_FRONTEND_PORT}*') "
                "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
            ),
        ]
    else:
        command = ["pkill", "-f", f"ngrok.*http.*{PUBLIC_FRONTEND_PORT}"]

    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if result.returncode == 0:
        _print("Stopped an existing public demo tunnel. A fresh link will be created.")
        time.sleep(1)


def start_ngrok_tunnel(ngrok: str) -> int:
    _print("Starting ngrok tunnel...")
    _print("Keep this window open while other people are using the public link.")

    process = subprocess.Popen(
        [
            ngrok,
            "http",
            "--log=stdout",
            "--log-format=logfmt",
            "--host-header",
            f"{FRONTEND_HOST}:{PUBLIC_FRONTEND_PORT}",
            str(PUBLIC_FRONTEND_PORT),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    public_url = None
    recent_output: list[str] = []
    try:
        deadline = time.time() + 60
        while process.poll() is None:
            line = process.stdout.readline() if process.stdout else ""
            if line:
                recent_output.append(line.strip())
                recent_output = recent_output[-12:]
                print(line, end="", flush=True)
                match = NGROK_URL_PATTERN.search(line)
                if match and public_url is None:
                    public_url = match.group(0).rstrip("/")
                    _print("")
                    _print("Public demo link is ready:")
                    _print(public_url)
                    _print("")
                    _print("Share this URL with testers while this window stays open.")
                    _print("Email/password demo accounts and Facebook/Instagram demo sign-in work through this link.")
                    _print("Google/GitHub OAuth may require provider console URLs to be updated for the ngrok domain.")
                    _print("")
                    try:
                        webbrowser.open(public_url)
                    except Exception:
                        pass
            elif time.time() > deadline and public_url is None:
                raise RuntimeError(
                    "ngrok did not return a public URL within 60 seconds. "
                    "If ngrok asks for authentication, run: ngrok config add-authtoken <your-token>"
                )
            else:
                time.sleep(0.2)

        if public_url is None:
            details = "\n".join(recent_output)
            raise RuntimeError(
                "ngrok exited before creating a public URL. "
                "Install/configure ngrok, then run launcher\\public_demo.bat again.\n"
                f"{details}"
            )
        return process.returncode or 0
    except KeyboardInterrupt:
        _print("Stopping ngrok tunnel...")
        process.terminate()
        return 0
    except Exception:
        process.terminate()
        raise


def main() -> int:
    try:
        ngrok = find_ngrok()
        stop_existing_public_tunnels()
        stop_existing_public_demo_launchers()
        venv_python, npm = ensure_dependencies()
        start_backend(venv_python)
        start_public_frontend(npm)

        if not wait_for_http(BACKEND_URL, timeout_seconds=20):
            raise RuntimeError(f"Backend did not become ready at {BACKEND_URL}. See {LOG_DIR / 'backend.log'}")
        if not wait_for_http(PUBLIC_FRONTEND_URL, timeout_seconds=30):
            raise RuntimeError(
                f"Public demo frontend did not become ready at {PUBLIC_FRONTEND_URL}. "
                f"See {LOG_DIR / 'public-frontend.log'}"
            )

        _print("Local public-demo frontend:")
        _print(PUBLIC_FRONTEND_URL)
        return start_ngrok_tunnel(ngrok)
    except subprocess.CalledProcessError as exc:
        _print(f"Public demo launcher failed while running: {' '.join(exc.cmd)}")
        return exc.returncode or 1
    except Exception as exc:
        _print(f"Public demo launcher failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
