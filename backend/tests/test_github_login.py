import importlib
import os
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse


_backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_project_root = os.path.abspath(os.path.join(_backend_root, ".."))

if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class GitHubLoginTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._temp_dir = tempfile.mkdtemp(prefix="github-login-test-")
        cls._db_path = os.path.join(cls._temp_dir, "test_github_login.sqlite3")
        cls._database_url = f"sqlite:///{cls._db_path}"
        cls._original_env = {
            key: os.environ.get(key)
            for key in (
                "DATABASE_URL",
                "DBUPDATE_DATABASE_URL",
                "JWT_SECRET_KEY",
                "SECRET_KEY",
                "FRONTEND_URL",
                "GITHUB_CLIENT_ID",
                "GITHUB_CLIENT_SECRET",
                "GITHUB_REDIRECT_URI",
            )
        }

        os.environ["DATABASE_URL"] = cls._database_url
        os.environ["DBUPDATE_DATABASE_URL"] = cls._database_url
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-with-32-plus-characters"
        os.environ["SECRET_KEY"] = "test-secret"
        os.environ["FRONTEND_URL"] = "http://127.0.0.1:5173"
        os.environ["GITHUB_CLIENT_ID"] = "test-github-client-id"
        os.environ["GITHUB_CLIENT_SECRET"] = "test-github-client-secret"
        os.environ["GITHUB_REDIRECT_URI"] = "http://127.0.0.1:5050/api/auth/github/callback"

        cls.db_new_test_module = importlib.import_module("DBupdate.db_new_test")
        cls.db_new_test_module.configure_database(cls._database_url)

        ewastehub_module = importlib.import_module("ewastehub")
        extensions_module = importlib.import_module("ewastehub.extensions")

        global db, Base, User, get_session
        db = extensions_module.db
        Base = cls.db_new_test_module.Base
        User = cls.db_new_test_module.User
        get_session = cls.db_new_test_module.get_session

        cls.app = ewastehub_module.create_app()
        cls.app.config.update(TESTING=True)
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "app"):
            with cls.app.app_context():
                db.session.remove()
                db.drop_all()
                db.engine.dispose()
        if hasattr(cls, "db_new_test_module"):
            cls.db_new_test_module.engine.dispose()
        shutil.rmtree(getattr(cls, "_temp_dir", ""), ignore_errors=True)
        for key, value in getattr(cls, "_original_env", {}).items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def setUp(self):
        with self.app.app_context():
            db.session.remove()
        Base.metadata.drop_all(self.__class__.db_new_test_module.engine)
        Base.metadata.create_all(self.__class__.db_new_test_module.engine)

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()

    def test_github_login_redirects_to_github_authorize(self):
        response = self.client.get("/api/auth/github/login?next=/app/dashboard")

        self.assertEqual(response.status_code, 302)
        redirect_url = response.headers["Location"]
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)

        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "github.com")
        self.assertEqual(parsed.path, "/login/oauth/authorize")
        self.assertEqual(params["client_id"][0], "test-github-client-id")
        self.assertEqual(params["redirect_uri"][0], "http://127.0.0.1:5050/api/auth/github/callback")
        self.assertEqual(params["scope"][0], "read:user user:email")
        self.assertTrue(params["state"][0])

        with self.client.session_transaction() as flask_session:
            self.assertEqual(flask_session["github_oauth_next"], "/app/dashboard")
            self.assertEqual(flask_session["github_oauth_state"], params["state"][0])

    def test_github_login_uses_public_origin_for_ngrok_demo(self):
        public_origin = "https://extent-ranged-race.ngrok-free.dev"
        response = self.client.get(
            f"/api/auth/github/login?next=/app/dashboard&public_origin={public_origin}"
        )

        self.assertEqual(response.status_code, 302)
        redirect_url = response.headers["Location"]
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)

        self.assertEqual(
            params["redirect_uri"][0],
            f"{public_origin}/api/auth/github/callback",
        )

        with self.client.session_transaction() as flask_session:
            self.assertEqual(flask_session["github_oauth_frontend_origin"], public_origin)
            self.assertEqual(
                flask_session["github_oauth_redirect_uri"],
                f"{public_origin}/api/auth/github/callback",
            )

    @patch("ewastehub.modules.auth.requests.get")
    @patch("ewastehub.modules.auth.requests.post")
    def test_github_callback_creates_user_and_redirects_back_to_frontend(self, mock_post, mock_get):
        start_response = self.client.get("/api/auth/github/login?next=/app/dashboard")
        self.assertEqual(start_response.status_code, 302)

        with self.client.session_transaction() as flask_session:
            github_state = flask_session["github_oauth_state"]

        mock_post.return_value = _FakeResponse({"access_token": "github-access-token"})
        mock_get.side_effect = [
            _FakeResponse({"id": 12345, "login": "octocat"}),
            _FakeResponse(
                [
                    {
                        "email": "github-user@example.com",
                        "verified": True,
                        "primary": True,
                    }
                ]
            ),
        ]

        response = self.client.get(
            f"/api/auth/github/callback?code=test-code&state={github_state}"
        )

        self.assertEqual(response.status_code, 302)
        redirect_url = response.headers["Location"]
        self.assertTrue(redirect_url.startswith("http://127.0.0.1:5173/auth/oauth-callback#"))
        self.assertIn("access_token=", redirect_url)
        self.assertIn("next=%2Fapp%2Fdashboard", redirect_url)

        session = get_session()
        try:
            user = session.query(User).filter_by(email="github-user@example.com").first()
            self.assertIsNotNone(user)
            self.assertEqual(user.role, "consumer")
            self.assertEqual(user.auth_provider, "github")
            self.assertEqual(user.full_name, "octocat")
        finally:
            session.close()

    @patch("ewastehub.modules.auth.requests.get")
    @patch("ewastehub.modules.auth.requests.post")
    def test_github_callback_returns_to_public_origin_for_ngrok_demo(self, mock_post, mock_get):
        public_origin = "https://extent-ranged-race.ngrok-free.dev"
        start_response = self.client.get(
            f"/api/auth/github/login?next=/app/dashboard&public_origin={public_origin}"
        )
        self.assertEqual(start_response.status_code, 302)

        with self.client.session_transaction() as flask_session:
            github_state = flask_session["github_oauth_state"]

        mock_post.return_value = _FakeResponse({"access_token": "github-access-token"})
        mock_get.side_effect = [
            _FakeResponse({"id": 12345, "login": "octocat"}),
            _FakeResponse(
                [
                    {
                        "email": "github-user@example.com",
                        "verified": True,
                        "primary": True,
                    }
                ]
            ),
        ]

        response = self.client.get(
            f"/api/auth/github/callback?code=test-code&state={github_state}"
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            response.headers["Location"].startswith(
                f"{public_origin}/auth/oauth-callback#"
            )
        )
        self.assertEqual(
            mock_post.call_args.kwargs["data"]["redirect_uri"],
            f"{public_origin}/api/auth/github/callback",
        )


if __name__ == "__main__":
    unittest.main()
