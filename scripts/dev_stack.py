#!/usr/bin/env python3

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "infra/docker/docker-compose.yml"
DEFAULT_TIMEOUT_SECONDS = 180
WORKER_STABILITY_SECONDS = 3
ANSI_PATTERN = re.compile(r"\x1b\[[0-9;]*m")

ENV_FILE_PAIRS = (
    (ROOT / ".env.example", ROOT / ".env"),
    (ROOT / "apps/api/.env.example", ROOT / "apps/api/.env"),
    (ROOT / "apps/web/.env.example", ROOT / "apps/web/.env"),
    (ROOT / "apps/worker/.env.example", ROOT / "apps/worker/.env"),
)

CORE_INFRA_PORTS = {
    "postgres": ("tcp", lambda config: int(config["POSTGRES_PORT"])),
    "redis": ("tcp", lambda _config: 6379),
    "mailhog-smtp": ("tcp", lambda _config: 1025),
    "mailhog-ui": ("http", lambda _config: 8025),
    "minio-api": ("tcp", lambda _config: 9000),
    "minio-ui": ("http", lambda _config: 9001),
}

ANALYTICS_INFRA_PORTS = {
    "analytics-postgres": ("tcp", lambda config: int(config["ANALYTICS_POSTGRES_PORT"])),
    "superset": ("http", lambda config: int(config["SUPERSET_PORT"])),
}

CORE_COMPOSE_SERVICES = ["postgres", "redis", "mailhog", "minio"]
ANALYTICS_COMPOSE_SERVICES = ["analytics-postgres", "superset"]

SHUTDOWN_REQUESTED = False


class FriendlyError(Exception):
    def __init__(self, summary: str, fix: str, details: str | None = None) -> None:
        super().__init__(summary)
        self.summary = summary
        self.fix = fix
        self.details = details


@dataclass
class ManagedService:
    name: str
    command: list[str]
    process: subprocess.Popen[str] | None = None
    last_lines: collections.deque[str] = field(default_factory=lambda: collections.deque(maxlen=30))
    error_lines: collections.deque[str] = field(default_factory=lambda: collections.deque(maxlen=15))
    ready_marker_at: float | None = None
    url: str | None = None
    extra: dict[str, str] = field(default_factory=dict)

    def mark_ready(self) -> None:
        self.ready_marker_at = time.monotonic()


def colorize(text: str, code: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"\033[{code}m{text}\033[0m"


def info(message: str) -> None:
    print(colorize("[info]", "36"), message, flush=True)


def ok(message: str) -> None:
    print(colorize("[ok]", "32"), message, flush=True)


def warn(message: str) -> None:
    print(colorize("[warn]", "33"), message, flush=True)


def fail(message: str) -> None:
    print(colorize("[fail]", "31"), message, flush=True)


def strip_ansi(value: str) -> str:
    return ANSI_PATTERN.sub("", value).rstrip("\n")


def load_env_values(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def build_runtime_config() -> dict[str, str]:
    root_env = load_env_values(ROOT / ".env")
    api_env = load_env_values(ROOT / "apps/api/.env")
    config = {
        "POSTGRES_PORT": os.environ.get("POSTGRES_PORT") or root_env.get("POSTGRES_PORT") or "55432",
        "ANALYTICS_POSTGRES_PORT": (
            os.environ.get("ANALYTICS_POSTGRES_PORT")
            or root_env.get("ANALYTICS_POSTGRES_PORT")
            or "55433"
        ),
        "SUPERSET_PORT": os.environ.get("SUPERSET_PORT") or root_env.get("SUPERSET_PORT") or "8088",
        "API_PORT": os.environ.get("PORT") or api_env.get("PORT") or "4000",
    }
    return config


def ensure_prerequisites() -> None:
    required_commands = {
        "docker": "Install Docker Desktop or OrbStack and make sure the Docker CLI is available in PATH.",
        "pnpm": "Install pnpm 9+ and make sure it is available in PATH.",
        "node": "Install Node.js 20+ and make sure it is available in PATH.",
    }

    for command, fix in required_commands.items():
        if shutil.which(command) is None:
            raise FriendlyError(
                summary=f"Missing required command: `{command}`.",
                fix=fix,
            )

    if not (ROOT / "node_modules").exists():
        raise FriendlyError(
            summary="Dependencies are not installed in this workspace.",
            fix="Run `pnpm install` in the repository root, then rerun this script.",
        )

    docker_result = run_command(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "version"],
        friendly_name="docker compose version",
    )
    if docker_result.returncode != 0:
        raise compose_error("docker compose is not ready to run.", docker_result.stderr or docker_result.stdout)

    pnpm_result = run_command(["pnpm", "--version"], friendly_name="pnpm --version")
    if pnpm_result.returncode != 0:
        raise FriendlyError(
            summary="pnpm is installed but not working correctly.",
            fix="Reinstall pnpm or repair your Node.js toolchain, then rerun the script.",
            details=pnpm_result.stderr or pnpm_result.stdout,
        )


def ensure_env_files() -> None:
    created: list[Path] = []
    for source, target in ENV_FILE_PAIRS:
        if target.exists():
            continue
        if not source.exists():
            raise FriendlyError(
                summary=f"Missing env template: `{source}`.",
                fix="Restore the missing `.env.example` file before rerunning the script.",
            )
        shutil.copyfile(source, target)
        created.append(target)

    if created:
        joined = ", ".join(str(path.relative_to(ROOT)) for path in created)
        ok(f"Created missing env files from examples: {joined}")


def run_command(
    command: list[str],
    friendly_name: str,
    *,
    check: bool = False,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=capture_output,
            check=False,
        )
    except FileNotFoundError as error:
        raise FriendlyError(
            summary=f"Failed to run `{friendly_name}` because `{command[0]}` is missing.",
            fix=f"Install `{command[0]}` and rerun the script.",
        ) from error

    if check and result.returncode != 0:
        raise FriendlyError(
            summary=f"`{friendly_name}` failed.",
            fix="Review the command output below and fix the reported problem before rerunning.",
            details=(result.stderr or result.stdout).strip() or None,
        )
    return result


def list_running_compose_services() -> set[str]:
    result = run_command(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "ps", "--services", "--status", "running"],
        friendly_name="docker compose ps",
    )
    if result.returncode != 0:
        raise compose_error("Failed to inspect running Docker services.", result.stderr or result.stdout)
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def is_port_open(port: int, *, timeout_seconds: float = 0.5) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout_seconds)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def wait_for_tcp_port(port: int, *, timeout_seconds: int, label: str) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if is_port_open(port):
            return
        time.sleep(1)

    occupant = describe_listener(port)
    details = f"Current listener on {port}:\n{occupant}" if occupant else None
    raise FriendlyError(
        summary=f"{label} did not open port {port} in time.",
        fix="Make sure Docker is running cleanly and no unrelated process is blocking the port.",
        details=details,
    )


def http_get(url: str, *, timeout_seconds: float = 2.0) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "customervoice-dev-stack"})
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        body = response.read().decode("utf-8", errors="replace")
        return response.status, body


def wait_for_http(url: str, *, timeout_seconds: int, label: str) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: str | None = None
    while time.monotonic() < deadline:
        try:
            status, _ = http_get(url)
            if 200 <= status < 500:
                return
        except urllib.error.URLError as error:
            last_error = str(error.reason)
        except OSError as error:
            last_error = str(error)
        time.sleep(1)

    raise FriendlyError(
        summary=f"{label} did not respond at {url}.",
        fix="Make sure the service finished starting and no proxy or port conflict is blocking the endpoint.",
        details=last_error,
    )


def describe_listener(port: int) -> str | None:
    if shutil.which("lsof") is None:
        return None

    result = run_command(
        ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
        friendly_name=f"lsof port {port}",
    )
    output = (result.stdout or result.stderr or "").strip()
    return output or None


def check_port_conflicts(required_ports: dict[str, tuple[str, int]], running_compose_services: set[str]) -> None:
    compose_service_by_label = {
        "postgres": "postgres",
        "redis": "redis",
        "mailhog-smtp": "mailhog",
        "mailhog-ui": "mailhog",
        "minio-api": "minio",
        "minio-ui": "minio",
        "analytics-postgres": "analytics-postgres",
        "superset": "superset",
    }

    for label, (_kind, port) in required_ports.items():
        owner = compose_service_by_label[label]
        if owner in running_compose_services:
            continue
        if not is_port_open(port):
            continue

        details = describe_listener(port)
        raise FriendlyError(
            summary=f"Port {port} is already in use, so `{owner}` cannot start.",
            fix=f"Stop the process using port {port}, or change the service port in your env configuration before rerunning.",
            details=details,
        )


def compose_error(summary: str, output: str | None) -> FriendlyError:
    message = (output or "").strip()
    lower = message.lower()

    if "cannot connect to the docker daemon" in lower or "is the docker daemon running" in lower:
        fix = "Start Docker Desktop or OrbStack, wait for Docker to become healthy, then rerun the script."
    elif "permission denied while trying to connect to the docker daemon socket" in lower or "operation not permitted" in lower:
        fix = (
            "The current shell cannot reach the Docker socket. Start Docker, confirm your terminal can access the "
            "Docker daemon, and rerun the script."
        )
    elif "port is already allocated" in lower or "ports are not available" in lower:
        fix = "Free the conflicting port or change the Docker port mapping in `.env`, then rerun the script."
    else:
        fix = "Review the Docker error output below and fix the reported issue before rerunning."

    return FriendlyError(summary=summary, fix=fix, details=message or None)


def start_infra(services: list[str], timeout_seconds: int) -> set[str]:
    info(f"Starting Docker services: {', '.join(services)}")
    before = list_running_compose_services()
    result = run_command(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d", *services],
        friendly_name="docker compose up",
    )
    if result.returncode != 0:
        raise compose_error("Docker failed to start the local infrastructure.", result.stderr or result.stdout)

    config = build_runtime_config()
    label_ports = {
        label: (kind, resolver(config))
        for label, (kind, resolver) in {**CORE_INFRA_PORTS, **ANALYTICS_INFRA_PORTS}.items()
    }

    for service in services:
        if service == "postgres":
            wait_for_tcp_port(label_ports["postgres"][1], timeout_seconds=timeout_seconds, label="Postgres")
        elif service == "redis":
            wait_for_tcp_port(label_ports["redis"][1], timeout_seconds=timeout_seconds, label="Redis")
        elif service == "mailhog":
            wait_for_tcp_port(label_ports["mailhog-smtp"][1], timeout_seconds=timeout_seconds, label="MailHog SMTP")
            wait_for_http(
                f"http://127.0.0.1:{label_ports['mailhog-ui'][1]}",
                timeout_seconds=timeout_seconds,
                label="MailHog UI",
            )
        elif service == "minio":
            wait_for_tcp_port(label_ports["minio-api"][1], timeout_seconds=timeout_seconds, label="MinIO API")
            wait_for_http(
                f"http://127.0.0.1:{label_ports['minio-ui'][1]}",
                timeout_seconds=timeout_seconds,
                label="MinIO console",
            )
        elif service == "analytics-postgres":
            wait_for_tcp_port(
                label_ports["analytics-postgres"][1],
                timeout_seconds=timeout_seconds,
                label="Analytics Postgres",
            )
        elif service == "superset":
            wait_for_http(
                f"http://127.0.0.1:{label_ports['superset'][1]}",
                timeout_seconds=timeout_seconds,
                label="Superset",
            )

    after = list_running_compose_services()
    missing = [service for service in services if service not in after]
    if missing:
        raise FriendlyError(
            summary=f"Docker reported success, but these services are not running: {', '.join(missing)}.",
            fix="Inspect `docker compose ps` and `docker compose logs` to find the failing container, then rerun the script.",
        )

    started_here = {service for service in services if service not in before}
    ok(f"Docker infrastructure is ready: {', '.join(services)}")
    return started_here


def spawn_service(service: ManagedService) -> None:
    try:
        process = subprocess.Popen(
            service.command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            start_new_session=True,
        )
    except FileNotFoundError as error:
        raise FriendlyError(
            summary=f"Failed to start `{service.name}` because `{service.command[0]}` is missing.",
            fix=f"Install `{service.command[0]}` and rerun the script.",
        ) from error

    service.process = process
    threading.Thread(target=stream_service_logs, args=(service,), daemon=True).start()


def stream_service_logs(service: ManagedService) -> None:
    assert service.process is not None
    assert service.process.stdout is not None

    for raw_line in service.process.stdout:
        line = strip_ansi(raw_line)
        if not line:
            continue

        service.last_lines.append(line)
        lower = line.lower()
        if "error" in lower or "failed" in lower:
            service.error_lines.append(line)

        if service.name == "api":
            maybe_mark_api_ready(service, line)
        elif service.name == "web":
            maybe_mark_web_ready(service, line)
        elif service.name == "worker":
            maybe_mark_worker_ready(service, line)

        print(f"{service.name:>6} | {line}", flush=True)


def maybe_mark_api_ready(service: ManagedService, line: str) -> None:
    if "customerVoice api listening on" not in line:
        return
    match = re.search(r"(https?://[^\s]+)", line)
    if match:
        service.url = match.group(1)
    service.mark_ready()


def maybe_mark_web_ready(service: ManagedService, line: str) -> None:
    if "Local:" not in line and "localhost:" not in line:
        return
    match = re.search(r"(https?://[^\s]+)", line)
    if match:
        service.url = match.group(1).rstrip("/")
        service.mark_ready()


def maybe_mark_worker_ready(service: ManagedService, line: str) -> None:
    if '"message":"worker_start"' in line or '"message": "worker_start"' in line or "worker_start" in line:
        service.mark_ready()


def wait_for_api(service: ManagedService, *, api_port: int, timeout_seconds: int) -> None:
    info("Starting API and waiting for health checks to pass")
    spawn_service(service)
    health_url = f"http://127.0.0.1:{api_port}/health"
    deadline = time.monotonic() + timeout_seconds
    last_error: str | None = None

    while time.monotonic() < deadline:
        ensure_service_alive(service)
        try:
            status, body = http_get(health_url)
            if status == 200:
                payload = json.loads(body)
                if payload.get("status") == "ok":
                    service.url = service.url or f"http://localhost:{api_port}"
                    ok(f"API is healthy at {health_url}")
                    return
        except json.JSONDecodeError as error:
            last_error = f"Invalid health response: {error}"
        except urllib.error.HTTPError as error:
            last_error = f"HTTP {error.code}"
        except urllib.error.URLError as error:
            last_error = str(error.reason)
        except OSError as error:
            last_error = str(error)
        time.sleep(1)

    raise service_timeout(service, "API did not become healthy in time.", last_error)


def wait_for_worker(service: ManagedService, *, timeout_seconds: int) -> None:
    info("Starting worker and waiting for a stable startup")
    spawn_service(service)
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        ensure_service_alive(service)

        if service.ready_marker_at is not None:
            recent_errors = [line for line in service.error_lines if "worker_start" not in line]
            if recent_errors:
                raise service_failure(
                    service,
                    "Worker started but immediately reported an error.",
                    extra_detail=recent_errors[-1],
                )
            if time.monotonic() - service.ready_marker_at >= WORKER_STABILITY_SECONDS:
                ok("Worker is running and polling for jobs")
                return
        time.sleep(0.5)

    raise service_timeout(service, "Worker did not report a healthy startup in time.")


def wait_for_web(service: ManagedService, *, timeout_seconds: int) -> None:
    info("Starting web app and waiting for the Vite server")
    spawn_service(service)
    deadline = time.monotonic() + timeout_seconds
    last_error: str | None = None

    while time.monotonic() < deadline:
        ensure_service_alive(service)
        if service.url:
            try:
                status, _ = http_get(service.url)
                if 200 <= status < 500:
                    ok(f"Web app is serving at {service.url}")
                    return
            except urllib.error.URLError as error:
                last_error = str(error.reason)
            except OSError as error:
                last_error = str(error)
        time.sleep(1)

    raise service_timeout(service, "Web app did not become reachable in time.", last_error)


def ensure_service_alive(service: ManagedService) -> None:
    assert service.process is not None
    return_code = service.process.poll()
    if return_code is None:
        return
    raise service_failure(
        service,
        f"`{service.name}` exited before startup completed (exit code {return_code}).",
    )


def service_timeout(service: ManagedService, summary: str, extra_detail: str | None = None) -> FriendlyError:
    detail_lines = list(service.last_lines)
    if extra_detail:
        detail_lines.append(f"startup-check: {extra_detail}")
    details = "\n".join(detail_lines[-12:]) if detail_lines else extra_detail
    return FriendlyError(
        summary=summary,
        fix=classify_service_fix(service),
        details=details or None,
    )


def service_failure(service: ManagedService, summary: str, extra_detail: str | None = None) -> FriendlyError:
    detail_lines = list(service.last_lines)
    if extra_detail:
        detail_lines.append(extra_detail)
    details = "\n".join(detail_lines[-12:]) if detail_lines else extra_detail
    return FriendlyError(
        summary=summary,
        fix=classify_service_fix(service),
        details=details or None,
    )


def classify_service_fix(service: ManagedService) -> str:
    corpus = "\n".join(service.last_lines).lower()

    if "eaddrinuse" in corpus or "address already in use" in corpus:
        if service.name == "api":
            return "Free port 4000 or change `PORT` in `apps/api/.env`, then rerun the script."
        return "Free the conflicting port or stop the already-running copy of this service, then rerun the script."

    if "cannot find module" in corpus or "command not found" in corpus or "vite: not found" in corpus or "tsx: not found" in corpus:
        return "Dependencies are missing or incomplete. Run `pnpm install`, then rerun the script."

    if "database_url is required" in corpus:
        return "Set `DATABASE_URL` in `.env` or `apps/worker/.env`, then rerun the script."

    if "connect econnrefused" in corpus or "connection refused" in corpus:
        return "A required local dependency is not reachable. Make sure Docker started cleanly and your env files still point at the local compose ports."

    if 'relation "notification_jobs" does not exist' in corpus:
        return "The database schema is missing. Let the API finish bootstrapping, or run `pnpm --filter @customervoice/api db:migrate` manually."

    if "[bootstrap] failed to start api" in corpus:
        return "The API bootstrap failed. Check `.env`, make sure Postgres is running on the configured port, and rerun the script."

    return "Review the service log above, fix the reported issue, and rerun the script."


def stop_service(service: ManagedService) -> None:
    if service.process is None or service.process.poll() is not None:
        return

    pgid = os.getpgid(service.process.pid)
    os.killpg(pgid, signal.SIGINT)

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if service.process.poll() is not None:
            return
        time.sleep(0.2)

    os.killpg(pgid, signal.SIGKILL)


def stop_infra(services: set[str]) -> None:
    if not services:
        return

    info(f"Stopping Docker services started by this script: {', '.join(sorted(services))}")
    result = run_command(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "stop", *sorted(services)],
        friendly_name="docker compose stop",
    )
    if result.returncode == 0:
        ok("Docker cleanup completed")
        return

    warn("Docker cleanup reported an error. You may need to stop containers manually with `docker compose stop`.")
    if result.stderr:
        print(result.stderr.strip(), flush=True)


def handle_signal(signum: int, _frame: object) -> None:
    global SHUTDOWN_REQUESTED
    if SHUTDOWN_REQUESTED:
        return
    SHUTDOWN_REQUESTED = True
    warn(f"Received signal {signum}. Shutting down...")


def build_required_ports(config: dict[str, str], include_analytics: bool) -> dict[str, tuple[str, int]]:
    ports = {
        label: (kind, resolver(config))
        for label, (kind, resolver) in CORE_INFRA_PORTS.items()
    }
    if include_analytics:
        ports.update({
            label: (kind, resolver(config))
            for label, (kind, resolver) in ANALYTICS_INFRA_PORTS.items()
        })
    return ports


def warn_if_web_port_busy() -> None:
    if is_port_open(3333):
        listener = describe_listener(3333)
        warn("Port 3333 is already in use. Vite may move the web app to the next free port.")
        if listener:
            print(listener, flush=True)


def check_api_port_free(api_port: int) -> None:
    if not is_port_open(api_port):
        return

    raise FriendlyError(
        summary=f"Port {api_port} is already in use, so the API cannot start.",
        fix=f"Stop the process using port {api_port}, or change `PORT` in `apps/api/.env` before rerunning.",
        details=describe_listener(api_port),
    )


def print_summary(api_port: int, web_url: str, include_analytics: bool, config: dict[str, str]) -> None:
    print("", flush=True)
    ok("CustomerVoice local stack is ready")
    print(f"  API health : http://localhost:{api_port}/health", flush=True)
    print(f"  Web app    : {web_url}", flush=True)
    print(f"  MailHog UI : http://localhost:8025", flush=True)
    print(f"  MinIO UI   : http://localhost:9001", flush=True)
    print(f"  Postgres   : localhost:{config['POSTGRES_PORT']}", flush=True)
    if include_analytics:
        print(f"  Superset   : http://localhost:{config['SUPERSET_PORT']}", flush=True)
        print(
            f"  Analytics DB: localhost:{config['ANALYTICS_POSTGRES_PORT']}",
            flush=True,
        )
    print("", flush=True)
    info("Press Ctrl+C to stop the app processes and any Docker services this script started.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Start the CustomerVoice local stack, validate readiness, and keep the processes supervised.",
    )
    parser.add_argument(
        "--analytics",
        action="store_true",
        help="Also start analytics-postgres and Superset.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"Startup timeout in seconds for each stage (default: {DEFAULT_TIMEOUT_SECONDS}).",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    managed_services = [
        ManagedService(name="api", command=["pnpm", "dev:api"]),
        ManagedService(name="worker", command=["pnpm", "dev:worker"]),
        ManagedService(name="web", command=["pnpm", "dev:web"]),
    ]
    started_infra: set[str] = set()

    try:
        ensure_prerequisites()
        ensure_env_files()
        config = build_runtime_config()
        running_compose_services = list_running_compose_services()
        required_ports = build_required_ports(config, include_analytics=args.analytics)
        check_port_conflicts(required_ports, running_compose_services)
        check_api_port_free(int(config["API_PORT"]))
        warn_if_web_port_busy()

        infra_services = CORE_COMPOSE_SERVICES + (ANALYTICS_COMPOSE_SERVICES if args.analytics else [])
        started_infra = start_infra(infra_services, args.timeout)

        api_service = managed_services[0]
        worker_service = managed_services[1]
        web_service = managed_services[2]

        wait_for_api(api_service, api_port=int(config["API_PORT"]), timeout_seconds=args.timeout)
        wait_for_worker(worker_service, timeout_seconds=args.timeout)
        wait_for_web(web_service, timeout_seconds=args.timeout)
        print_summary(
            api_port=int(config["API_PORT"]),
            web_url=web_service.url or "http://localhost:3333",
            include_analytics=args.analytics,
            config=config,
        )

        while not SHUTDOWN_REQUESTED:
            for service in managed_services:
                if service.process is not None and service.process.poll() is not None:
                    raise service_failure(
                        service,
                        f"`{service.name}` exited unexpectedly after startup.",
                    )
            time.sleep(1)

        return 0
    except FriendlyError as error:
        fail(error.summary)
        if error.details:
            print(error.details, flush=True)
        print(f"Possible fix: {error.fix}", flush=True)
        return 1
    finally:
        for service in reversed(managed_services):
            stop_service(service)
        stop_infra(started_infra)


if __name__ == "__main__":
    sys.exit(main())
