import importlib
import os
import shutil
import sys
import tempfile
import unittest


_backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_project_root = os.path.abspath(os.path.join(_backend_root, ".."))

if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class GoogleLoginTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._temp_dir = tempfile.mkdtemp(prefix="google-login-test-")
        cls._db_path = os.path.join(cls._temp_dir, "test_google_login.sqlite3")
        cls._database_url = f"sqlite:///{cls._db_path}"
        cls._original_env = {
            key: os.environ.get(key)
            for key in (
                "DATABASE_URL",
                "DBUPDATE_DATABASE_URL",
                "JWT_SECRET_KEY",
                "SECRET_KEY",
                "GOOGLE_CLIENT_ID",
            )
        }

        os.environ["DATABASE_URL"] = cls._database_url
        os.environ["DBUPDATE_DATABASE_URL"] = cls._database_url
        os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-with-32-plus-characters")
        os.environ.setdefault("SECRET_KEY", "test-secret")
        os.environ.setdefault(
            "GOOGLE_CLIENT_ID",
            "test-client-id.apps.googleusercontent.com",
        )

        cls.db_new_test_module = importlib.import_module("DBupdate.db_new_test")
        cls.db_new_test_module.configure_database(cls._database_url)

        ewastehub_module = importlib.import_module("ewastehub")
        extensions_module = importlib.import_module("ewastehub.extensions")
        models_module = importlib.import_module("ewastehub.models")
        modules_auth_module = importlib.import_module("ewastehub.modules.auth")
        cls.ewastehub_module = ewastehub_module

        global db, AppUser, auth_module
        db = extensions_module.db
        AppUser = models_module.User
        auth_module = modules_auth_module

        cls.original_init_bridge_db = ewastehub_module.init_bridge_db
        ewastehub_module.init_bridge_db = lambda: None
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
        if hasattr(cls, "ewastehub_module"):
            cls.ewastehub_module.init_bridge_db = cls.original_init_bridge_db
        shutil.rmtree(getattr(cls, "_temp_dir", ""), ignore_errors=True)
        for key, value in getattr(cls, "_original_env", {}).items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def setUp(self):
        self.original_verifier = auth_module._verify_google_credential
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.metadata.drop_all(bind=db.engine, tables=[AppUser.__table__])
            db.create_all()
            db.metadata.create_all(bind=db.engine, tables=[AppUser.__table__])

    def tearDown(self):
        auth_module._verify_google_credential = self.original_verifier
        with self.app.app_context():
            db.session.remove()

    def _mock_google_identity(self, email, sub="google-user-1"):
        def _fake_verifier(_credential):
            return {
                "sub": sub,
                "email": email,
                "email_verified": True,
                "iss": "https://accounts.google.com",
            }

        auth_module._verify_google_credential = _fake_verifier

    def test_google_login_creates_user_on_first_login(self):
        self._mock_google_identity("new-google-user@example.com")

        response = self.client.post(
            "/api/auth/google",
            json={"credential": "fake-google-token"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["access_token"])
        self.assertEqual(payload["user"]["email"], "new-google-user@example.com")
        self.assertEqual(payload["user"]["role"], "consumer")

        with self.app.app_context():
            users = db.session.query(AppUser).all()
            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].email, "new-google-user@example.com")
            self.assertEqual(users[0].auth_provider, "google")
            self.assertEqual(users[0].google_sub, "google-user-1")

    def test_google_login_reuses_existing_user_on_repeat_login(self):
        email = "existing-google-user@example.com"
        self._mock_google_identity(email, sub="google-user-repeat")

        first_response = self.client.post(
            "/api/auth/google",
            json={"credential": "first-fake-token"},
        )
        second_response = self.client.post(
            "/api/auth/google",
            json={"credential": "second-fake-token"},
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)

        first_payload = first_response.get_json()
        second_payload = second_response.get_json()
        self.assertEqual(first_payload["user"]["email"], email)
        self.assertEqual(second_payload["user"]["email"], email)
        self.assertEqual(first_payload["user"]["id"], second_payload["user"]["id"])

        with self.app.app_context():
            users = db.session.query(AppUser).filter_by(email=email).all()
            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].google_sub, "google-user-repeat")

    def test_google_login_rejects_email_already_used_by_local_account(self):
        self.client.post(
            "/api/auth/register",
            json={"email": "local-user@example.com", "password": "12345678"},
        )
        self._mock_google_identity("local-user@example.com", sub="google-conflict-sub")

        response = self.client.post(
            "/api/auth/google",
            json={"credential": "fake-google-token"},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {"error": "email is already registered with email/password sign-in"},
        )


if __name__ == "__main__":
    unittest.main()
