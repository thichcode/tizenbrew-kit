import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def location_block(config, path):
    marker = f"location {path} {{"
    start = config.find(marker)
    if start == -1:
        raise AssertionError(f"missing Nginx location: {path}")

    depth = 0
    for index in range(start, len(config)):
        if config[index] == "{":
            depth += 1
        elif config[index] == "}":
            depth -= 1
            if depth == 0:
                return config[start:index + 1]

    raise AssertionError(f"unterminated Nginx location: {path}")


class DeploymentConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.deploy = (ROOT / "deploy.sh").read_text(encoding="utf-8")
        cls.readme = (ROOT / "README.md").read_text(encoding="utf-8")
        cls.service = (ROOT / "yt-dlp-resolver.service").read_text(encoding="utf-8")

    def nginx_config(self):
        path = ROOT / "nginx.conf"
        self.assertTrue(path.is_file(), "nginx.conf must exist")
        return path.read_text(encoding="utf-8")

    def test_nginx_listens_on_public_ipv4_and_ipv6_port_8000(self):
        config = self.nginx_config()

        self.assertIn("listen 8000 default_server;", config)
        self.assertIn("listen [::]:8000 default_server;", config)
        self.assertNotIn("listen 80 default_server;", config)
        self.assertNotIn("listen [::]:80 default_server;", config)
        self.assertIn("server_name _;", config)

    def test_play_disables_logging_and_buffering_with_streaming_timeouts(self):
        play = location_block(self.nginx_config(), "/play")

        for directive in (
            "access_log off;",
            "error_log /var/log/nginx/error.log crit;",
            "proxy_buffering off;",
            "proxy_request_buffering off;",
            "proxy_read_timeout 300s;",
            "proxy_send_timeout 300s;",
        ):
            with self.subTest(directive=directive):
                self.assertIn(directive, play)
        self.assertIn("critical errors may still include the request URI", play)

    def test_nginx_locations_proxy_to_local_uvicorn_with_forwarded_headers(self):
        config = self.nginx_config()

        for path in ("/play", "/"):
            block = location_block(config, path)
            with self.subTest(path=path):
                self.assertIn("proxy_pass http://127.0.0.1:8001;", block)
                self.assertNotIn("proxy_pass http://127.0.0.1:8000;", block)
                self.assertIn("proxy_http_version 1.1;", block)
                self.assertIn("proxy_set_header Host $host;", block)
                self.assertIn("proxy_set_header X-Real-IP $remote_addr;", block)
                self.assertIn(
                    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
                    block,
                )
                self.assertIn('proxy_set_header Connection "";', block)

    def test_general_api_location_has_60_second_read_timeout(self):
        general = location_block(self.nginx_config(), "/")

        self.assertIn("proxy_read_timeout 60s;", general)

    def test_static_and_generated_services_use_venv_without_access_logs(self):
        self.assertIn(
            "ExecStart=/opt/yt-dlp-resolver/.venv/bin/python -m uvicorn app:app "
            "--host 127.0.0.1 --port 8001 --no-access-log",
            self.service,
        )
        self.assertNotIn("--host 0.0.0.0", self.service)
        self.assertNotIn("--host 127.0.0.1 --port 8000", self.service)
        self.assertIn(
            "ExecStart=$APP_DIR/.venv/bin/python -m uvicorn app:app "
            "--host 127.0.0.1 --port 8001 --no-access-log",
            self.deploy,
        )
        self.assertNotIn("--host 0.0.0.0", self.deploy)
        self.assertNotIn("--host 127.0.0.1 --port 8000", self.deploy)

    def test_deploy_installs_dependencies_in_application_venv(self):
        self.assertRegex(
            self.deploy,
            r"apt install[^\n]*\bpython3\b[^\n]*\bpython3-pip\b"
            r"[^\n]*\bpython3-venv\b[^\n]*\bnginx\b[^\n]*\bopenssl\b",
        )
        apt_install = self.deploy.index("apt install")
        key_resolution = self.deploy.index('if [[ -n "$KEY_FILE" ]]')
        openssl_generation = self.deploy.index('API_KEY=$(openssl rand -hex 16)')
        self.assertLess(apt_install, key_resolution)
        self.assertLess(apt_install, openssl_generation)
        self.assertIn('python3 -m venv "$APP_DIR/.venv"', self.deploy)
        self.assertIn(
            '"$APP_DIR/.venv/bin/pip" install -q yt-dlp '
            '-r "$(dirname "$0")/requirements.txt"',
            self.deploy,
        )
        self.assertNotRegex(self.deploy, r"(?m)^\s*pip3\s")

    def test_deploy_installs_application_files_without_partial_copies(self):
        self.assertIn(
            'install -o root -g ytresolver -m 0640 "$(dirname "$0")/app.py" '
            '"$APP_DIR/app.py"',
            self.deploy,
        )
        self.assertIn(
            'install -o root -g ytresolver -m 0640 '
            '"$(dirname "$0")/requirements.txt" "$APP_DIR/requirements.txt"',
            self.deploy,
        )
        self.assertIn(
            'install -o root -g ytresolver -m 0640 "$(dirname "$0")/nginx.conf" '
            '"$APP_DIR/nginx.conf"',
            self.deploy,
        )
        self.assertIn(
            'install -o root -g root -m 0644 "$(dirname "$0")/nginx.conf" '
            '"/etc/nginx/sites-available/yt-dlp-resolver"',
            self.deploy,
        )
        self.assertNotRegex(self.deploy, r"(?m)^\s*cp\s")

    def test_deploy_reads_protected_key_file_or_preserves_existing_key(self):
        self.assertIn('ENV_FILE="/etc/yt-dlp-resolver.env"', self.deploy)
        self.assertIn("# Usage: bash deploy.sh [/path/to/api-key-file]", self.deploy)
        self.assertIn(
            'echo "Usage: bash deploy.sh [/path/to/api-key-file]" >&2',
            self.deploy,
        )
        self.assertIn('KEY_FILE="${1:-}"', self.deploy)
        self.assertRegex(
            self.deploy,
            r'if \[\[ -n "\$KEY_FILE" \]\]; then[\s\S]+'
            r'API_KEY=\$\(<"\$KEY_FILE"\)\s+'
            r'elif \[\[ -f "\$ENV_FILE" \]\]; then\s+'
            r'API_KEY=\$\(sed -n \'s/\^API_KEY=//p\' "\$ENV_FILE" \| tail -n 1\)',
        )
        self.assertIn('if [[ ! -f "$KEY_FILE" ]]; then', self.deploy)
        self.assertIn('if command -v stat >/dev/null 2>&1; then', self.deploy)
        self.assertIn("KEY_MODE=$(stat -c '%a' -- \"$KEY_FILE\")", self.deploy)
        self.assertIn('if [[ ! "$KEY_MODE" =~ 00$ ]]; then', self.deploy)
        self.assertNotRegex(self.deploy, r'API_KEY=.*\$(?:1|\{1)')
        self.assertIn('API_KEY=$(openssl rand -hex 16)', self.deploy)
        self.assertIn(
            'if [[ ! "$API_KEY" =~ ^[0-9A-Fa-f]{32,128}$ ]]; then',
            self.deploy,
        )
        self.assertIn(
            'printf \'API_KEY=%s\\nYT_DLP_PATH=%s\\n\' "$API_KEY" "$YT_DLP_PATH"',
            self.deploy,
        )
        self.assertIn('chmod 0600 "$ENV_TMP"', self.deploy)
        self.assertIn('chown root:root "$ENV_TMP"', self.deploy)
        self.assertIn('mv "$ENV_TMP" "$ENV_FILE"', self.deploy)
        self.assertNotRegex(self.deploy, r'(?m)^echo .*\$API_KEY')
        self.assertNotIn('echo "API Key:', self.deploy)

    def test_services_load_environment_file_without_inline_secret(self):
        for source in (self.service, self.deploy):
            with self.subTest(source="static" if source is self.service else "generated"):
                self.assertIn("EnvironmentFile=/etc/yt-dlp-resolver.env", source)
                self.assertNotIn('Environment="API_KEY=', source)
                self.assertNotIn('Environment="YT_DLP_PATH=', source)

    def test_deploy_creates_service_user_and_locks_runtime_permissions(self):
        self.assertIn(
            "getent group ytresolver >/dev/null 2>&1 || groupadd --system ytresolver",
            self.deploy,
        )
        self.assertIn(
            'id -u ytresolver >/dev/null 2>&1 || useradd --system --gid ytresolver '
            '--home "$APP_DIR" --shell /usr/sbin/nologin ytresolver',
            self.deploy,
        )
        self.assertIn('chown -R root:ytresolver "$APP_DIR"', self.deploy)
        self.assertIn('chmod 0750 "$APP_DIR"', self.deploy)
        self.assertIn(
            'chmod -R u=rwX,g=rX,o= "$APP_DIR/.venv"',
            self.deploy,
        )
        self.assertNotIn('chmod -R g+rX "$APP_DIR"', self.deploy)
        self.assertNotRegex(self.deploy, r"chown -R\s+ytresolver(?::|\s)")
        self.assertNotRegex(self.deploy, r"install[^\n]*-o ytresolver")

    def test_deploy_installs_systemd_unit_with_explicit_root_permissions(self):
        self.assertIn(
            'install -o root -g root -m 0644 "$SERVICE_TMP" '
            '"/etc/systemd/system/$SERVICE_NAME.service"',
            self.deploy,
        )

    def test_services_run_as_hardened_dedicated_user(self):
        directives = (
            "User=ytresolver",
            "Group=ytresolver",
            'Environment="PYTHONDONTWRITEBYTECODE=1"',
            "NoNewPrivileges=true",
            "PrivateTmp=true",
            "ProtectSystem=strict",
            "ProtectHome=true",
            "KillSignal=SIGINT",
            "TimeoutStopSec=30",
        )
        for source in (self.service, self.deploy):
            for directive in directives:
                with self.subTest(
                    source="static" if source is self.service else "generated",
                    directive=directive,
                ):
                    self.assertIn(directive, source)
            self.assertNotIn("User=root", source)
            self.assertNotIn("Group=root", source)

    def test_deploy_enables_nginx_site_and_validates_before_reload(self):
        nginx_site = "/etc/nginx/sites-available/yt-dlp-resolver"
        self.assertIn(
            f'install -o root -g root -m 0644 "$(dirname "$0")/nginx.conf" '
            f'"{nginx_site}"',
            self.deploy,
        )
        self.assertIn("rm -f /etc/nginx/sites-enabled/default", self.deploy)
        self.assertRegex(
            self.deploy,
            re.escape(nginx_site) + r"[^\n]*/etc/nginx/sites-enabled/yt-dlp-resolver",
        )

        daemon_reload = self.deploy.index("systemctl daemon-reload")
        enable_resolver = self.deploy.index('systemctl enable "$SERVICE_NAME"')
        nginx_test = self.deploy.index("nginx -t")
        restart_resolver = self.deploy.index('systemctl restart "$SERVICE_NAME"')
        enable_nginx = self.deploy.index("systemctl enable nginx")
        reload_nginx = self.deploy.index("systemctl reload-or-restart nginx")

        self.assertLess(daemon_reload, enable_resolver)
        self.assertLess(enable_resolver, nginx_test)
        self.assertLess(nginx_test, enable_nginx)
        self.assertLess(nginx_test, restart_resolver)
        self.assertLess(nginx_test, reload_nginx)
        self.assertLess(restart_resolver, reload_nginx)
        self.assertLess(enable_nginx, reload_nginx)
        self.assertNotRegex(self.deploy, r"(?m)^systemctl reload nginx$")

    def test_deployment_files_are_pinned_to_lf(self):
        path = ROOT / ".gitattributes"
        self.assertTrue(path.is_file(), ".gitattributes must exist")
        attributes = path.read_text(encoding="utf-8")

        self.assertEqual(
            attributes.splitlines(),
            [
                "*.sh text eol=lf",
                "*.service text eol=lf",
                "*.conf text eol=lf",
            ],
        )

    def test_deploy_reports_public_port_and_test_commands(self):
        self.assertIn('echo "Public port:     8000"', self.deploy)
        self.assertIn('echo "Private Uvicorn: 127.0.0.1:8001"', self.deploy)
        self.assertIn("http://localhost:8000/health", self.deploy)
        self.assertIn("allow inbound TCP 8000", self.deploy)
        self.assertNotRegex(
            self.deploy,
            r"(?m)^\s*(?:ufw|firewall-cmd|iptables|nft)\s",
        )
        self.assertIn("nginx -t", self.deploy)

    def test_readme_documents_public_nginx_and_private_uvicorn(self):
        self.assertIn("Nginx", self.readme)
        self.assertIn("http://SERVER_IP:8000", self.readme)
        self.assertIn("127.0.0.1:8001", self.readme)
        self.assertIn("## Local Development", self.readme)
        self.assertIn(
            "uvicorn app:app --host 127.0.0.1 --port 8001",
            self.readme,
        )
        self.assertNotIn("--host 0.0.0.0", self.readme)
        self.assertNotRegex(self.readme, r"uvicorn[^\n]*--port 8000")

    def test_readme_documents_deploy_key_file_and_manual_firewall(self):
        self.assertIn(
            "bash deploy.sh /path/to/protected-api-key-file",
            self.readme,
        )
        self.assertIn("0600", self.readme)
        self.assertIn("TCP 8000", self.readme)
        self.assertIn("manually", self.readme.lower())

    def test_readme_uses_public_nginx_urls_for_all_examples(self):
        self.assertIn("http://SERVER_IP:8000/health", self.readme)
        self.assertIn("http://SERVER_IP:8000/resolve?", self.readme)
        self.assertRegex(
            self.readme,
            r"http://SERVER_IP:8000/play\?[^\n\"]*mode=redirect",
        )
        self.assertRegex(
            self.readme,
            r"http://SERVER_IP:8000/play\?[^\n\"]*mode=proxy",
        )
        self.assertNotRegex(
            self.readme,
            r"https?://[^\s)`\"]+:80(?:/|\b)",
        )
        self.assertNotRegex(self.readme, r"\bTCP 80\b")


if __name__ == "__main__":
    unittest.main()
