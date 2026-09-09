import importlib
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token


_backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_project_root = os.path.abspath(os.path.join(_backend_root, ".."))

if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class AuthFlowTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._temp_dir = tempfile.mkdtemp(prefix="auth-flow-test-")
        cls._db_path = os.path.join(cls._temp_dir, "test_auth.sqlite3")
        cls._database_url = f"sqlite:///{cls._db_path}"
        cls._original_env = {
            key: os.environ.get(key)
            for key in (
                "DATABASE_URL",
                "DBUPDATE_DATABASE_URL",
                "JWT_SECRET_KEY",
                "SECRET_KEY",
            )
        }

        os.environ["DATABASE_URL"] = cls._database_url
        os.environ["DBUPDATE_DATABASE_URL"] = cls._database_url
        os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-with-32-plus-characters")
        os.environ.setdefault("SECRET_KEY", "test-secret")

        cls.db_new_test_module = importlib.import_module("DBupdate.db_new_test")
        cls.db_new_test_module.configure_database(cls._database_url)

        bridge_module = importlib.import_module("DBupdate.db_bridge")
        ewastehub_module = importlib.import_module("ewastehub")
        extensions_module = importlib.import_module("ewastehub.extensions")
        models_module = importlib.import_module("ewastehub.models")

        global db, Base, DataRetrievalDownload, PaymentTransaction, ReferralActivity
        global ReferralCode, ReferralFee, ThirdPartyPartner, User, get_session
        global create_data_retrieval_request, PasswordResetToken, AppUser
        db = extensions_module.db
        Base = cls.db_new_test_module.Base
        DataRetrievalDownload = cls.db_new_test_module.DataRetrievalDownload
        PaymentTransaction = cls.db_new_test_module.PaymentTransaction
        ReferralActivity = cls.db_new_test_module.ReferralActivity
        ReferralCode = cls.db_new_test_module.ReferralCode
        ReferralFee = cls.db_new_test_module.ReferralFee
        ThirdPartyPartner = cls.db_new_test_module.ThirdPartyPartner
        User = cls.db_new_test_module.User
        get_session = cls.db_new_test_module.get_session
        create_data_retrieval_request = bridge_module.create_data_retrieval_request
        PasswordResetToken = models_module.PasswordResetToken
        AppUser = models_module.User

        create_app = ewastehub_module.create_app
        cls.app = create_app()
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
        with self.app.app_context():
            db.metadata.drop_all(bind=db.engine, tables=[AppUser.__table__])
            db.metadata.drop_all(bind=db.engine, tables=[PasswordResetToken.__table__])
            db.metadata.create_all(bind=db.engine, tables=[AppUser.__table__])
            db.metadata.create_all(bind=db.engine, tables=[PasswordResetToken.__table__])

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()

    def _create_reset_token(self, email, *, expires_at=None, used=False):
        self.client.post(
            "/api/auth/register",
            json={"email": email, "password": "12345678"},
        )

        with self.app.app_context():
            user = db.session.query(AppUser).filter_by(email=email).one()
            token_record = PasswordResetToken(
                user_id=user.id,
                token=f"token-{email}",
                created_at=datetime.utcnow(),
                expires_at=expires_at or (datetime.utcnow() + timedelta(minutes=30)),
                used=used,
            )
            db.session.add(token_record)
            db.session.commit()
            return token_record.token, user.id

    def _register_and_login(self, email, password="12345678"):
        self.client.post(
            "/api/auth/register",
            json={"email": email, "password": password},
        )
        login_response = self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(login_response.status_code, 200)
        return login_response.get_json()["access_token"]

    def _make_access_token_for_role(self, email, role):
        with self.app.app_context():
            user = AppUser(
                email=email,
                auth_provider="local",
                password_hash="placeholder-password-hash",
                role=role,
            )
            db.session.add(user)
            db.session.commit()
            return create_access_token(identity=str(user.id), additional_claims={"role": role}), user.id

    def _seed_reporting_records(self):
        owner_email = "reports-owner@example.com"
        owner_token = self._register_and_login(owner_email)
        staff_token, staff_id = self._make_access_token_for_role("reports-staff@example.com", "staff")
        admin_token, admin_id = self._make_access_token_for_role("reports-admin@example.com", "admin")

        with self.app.app_context():
            owner = db.session.query(AppUser).filter_by(email=owner_email).one()
            owner_id = owner.id

        request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Reports Device",
                "category": "laptop",
                "condition": "working",
                "preferred_method": "dropoff",
                "age_years": 6,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(request_response.status_code, 201)
        request_payload = request_response.get_json()["request"]
        device_id = request_payload["device"]["id"]
        request_id = request_payload["id"]

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="pending",
            quoted_price=15,
            final_price=15,
            retrieval_status="pending",
            payment_status="unpaid",
            note="Seeded for reporting tests",
        )

        session = get_session()
        try:
            partner_alpha = ThirdPartyPartner(
                name="Partner Alpha",
                partner_type="resale",
                website_url="https://alpha.example.test",
                referral_landing_url="https://alpha.example.test/referral",
                active=True,
                created_at=datetime(2026, 4, 1, 8, 0, 0),
                updated_at=datetime(2026, 4, 1, 8, 0, 0),
            )
            partner_beta = ThirdPartyPartner(
                name="Partner Beta",
                partner_type="marketplace",
                website_url="https://beta.example.test",
                referral_landing_url="https://beta.example.test/referral",
                active=True,
                created_at=datetime(2026, 4, 2, 8, 0, 0),
                updated_at=datetime(2026, 4, 2, 8, 0, 0),
            )
            session.add_all([partner_alpha, partner_beta])
            session.flush()

            payment_one = PaymentTransaction(
                retrieval_request_id=retrieval_request["id"],
                consumer_id=owner_id,
                provider="stripe",
                payment_kind="initial_retrieval",
                status="paid",
                amount=15,
                currency="GBP",
                provider_payment_id="pi_report_paid_1",
                checkout_reference="checkout-paid-1",
                initiated_at=datetime(2026, 4, 10, 9, 0, 0),
                paid_at=datetime(2026, 4, 10, 9, 5, 0),
                created_at=datetime(2026, 4, 10, 9, 0, 0),
                updated_at=datetime(2026, 4, 10, 9, 5, 0),
            )
            payment_two = PaymentTransaction(
                retrieval_request_id=retrieval_request["id"],
                consumer_id=owner_id,
                provider="paypal",
                payment_kind="extension",
                status="pending",
                amount=8,
                currency="GBP",
                provider_payment_id="pp_report_pending_1",
                checkout_reference="checkout-pending-1",
                initiated_at=datetime(2026, 4, 18, 10, 0, 0),
                created_at=datetime(2026, 4, 18, 10, 0, 0),
                updated_at=datetime(2026, 4, 18, 10, 0, 0),
            )
            session.add_all([payment_one, payment_two])
            session.flush()

            referral_code_one = ReferralCode(
                code="ALPHA-REF-001",
                partner_id=partner_alpha.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                classification_snapshot="rare",
                qr_payload='{"code":"ALPHA-REF-001"}',
                qr_target_url="https://alpha.example.test/ref/ALPHA-REF-001",
                voucher_label="Alpha Voucher",
                bonus_label="£25.00",
                status="redeemed",
                issued_at=datetime(2026, 4, 12, 11, 0, 0),
                redeemed_at=datetime(2026, 4, 13, 11, 0, 0),
                created_at=datetime(2026, 4, 12, 11, 0, 0),
                updated_at=datetime(2026, 4, 13, 11, 0, 0),
            )
            referral_code_two = ReferralCode(
                code="BETA-REF-001",
                partner_id=partner_beta.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                classification_snapshot="rare",
                qr_payload='{"code":"BETA-REF-001"}',
                qr_target_url="https://beta.example.test/ref/BETA-REF-001",
                voucher_label="Beta Voucher",
                bonus_label="£40.00",
                status="issued",
                issued_at=datetime(2026, 4, 19, 14, 0, 0),
                created_at=datetime(2026, 4, 19, 14, 0, 0),
                updated_at=datetime(2026, 4, 19, 14, 0, 0),
            )
            session.add_all([referral_code_one, referral_code_two])
            session.flush()

            activity_one = ReferralActivity(
                partner_id=partner_alpha.id,
                referral_code_id=referral_code_one.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                event_type="redeemed",
                event_reference="alpha-redeemed-1",
                metadata_json='{"source":"staff_portal"}',
                notes="Redeemed with alpha",
                occurred_at=datetime(2026, 4, 13, 11, 0, 0),
                created_at=datetime(2026, 4, 13, 11, 0, 0),
            )
            activity_two = ReferralActivity(
                partner_id=partner_beta.id,
                referral_code_id=referral_code_two.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                event_type="opened",
                event_reference="beta-opened-1",
                metadata_json='{"source":"consumer_dashboard"}',
                notes="Opened with beta",
                occurred_at=datetime(2026, 4, 19, 14, 30, 0),
                created_at=datetime(2026, 4, 19, 14, 30, 0),
            )
            session.add_all([activity_one, activity_two])
            session.flush()

            fee_one = ReferralFee(
                partner_id=partner_alpha.id,
                referral_code_id=referral_code_one.id,
                referral_activity_id=activity_one.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                status="paid",
                fee_amount=25,
                currency="GBP",
                fee_reference="alpha-fee-1",
                due_at=datetime(2026, 4, 20, 12, 0, 0),
                confirmed_at=datetime(2026, 4, 14, 10, 0, 0),
                paid_at=datetime(2026, 4, 15, 10, 0, 0),
                created_at=datetime(2026, 4, 14, 10, 0, 0),
                updated_at=datetime(2026, 4, 15, 10, 0, 0),
            )
            fee_two = ReferralFee(
                partner_id=partner_beta.id,
                referral_code_id=referral_code_two.id,
                referral_activity_id=activity_two.id,
                consumer_id=owner_id,
                device_id=device_id,
                request_id=request_id,
                status="expected",
                fee_amount=40,
                currency="GBP",
                fee_reference="beta-fee-1",
                due_at=datetime(2026, 4, 25, 12, 0, 0),
                created_at=datetime(2026, 4, 20, 12, 0, 0),
                updated_at=datetime(2026, 4, 20, 12, 0, 0),
            )
            session.add_all([fee_one, fee_two])
            session.commit()

            return {
                "owner_token": owner_token,
                "staff_token": staff_token,
                "admin_token": admin_token,
                "owner_id": owner_id,
                "staff_id": staff_id,
                "admin_id": admin_id,
                "device_id": device_id,
                "request_id": request_id,
                "retrieval_request_id": retrieval_request["id"],
                "partner_alpha_id": partner_alpha.id,
                "partner_beta_id": partner_beta.id,
            }
        finally:
            session.close()

    def test_register_persists_user_without_full_name(self):
        response = self.client.post(
            "/api/auth/register",
            json={"email": "new-user@example.com", "password": "12345678"},
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["user"]["email"], "new-user@example.com")
        self.assertIsNone(payload["user"]["full_name"])
        self.assertEqual(payload["user"]["role"], "consumer")

        with self.app.app_context():
            user = db.session.query(AppUser).filter_by(email="new-user@example.com").first()
            self.assertIsNotNone(user)
            self.assertEqual(user.auth_provider, "local")
            self.assertIsNone(user.full_name)
            self.assertEqual(user.role, "consumer")

    def test_register_persists_full_name_when_provided(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Test User",
                "email": "named-user@example.com",
                "password": "12345678",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["user"]["email"], "named-user@example.com")
        self.assertEqual(payload["user"]["full_name"], "Test User")
        self.assertEqual(payload["user"]["role"], "consumer")

        with self.app.app_context():
            app_user = db.session.query(AppUser).filter_by(email="named-user@example.com").first()
            self.assertIsNotNone(app_user)
            self.assertEqual(app_user.auth_provider, "local")
            self.assertEqual(app_user.full_name, "Test User")
            self.assertEqual(app_user.role, "consumer")

    def test_register_rejects_email_already_used_by_google_account(self):
        with self.app.app_context():
            google_user = AppUser(
                email="google-owned@example.com",
                auth_provider="google",
                google_sub="google-sub-123",
                password_hash="google-placeholder",
                role="consumer",
            )
            db.session.add(google_user)
            db.session.commit()

        response = self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Local User",
                "email": "google-owned@example.com",
                "password": "12345678",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {"error": "email is already registered with Google sign-in"},
        )

    def test_login_returns_project_token_for_registered_user(self):
        self.client.post(
            "/api/auth/register",
            json={"email": "login-user@example.com", "password": "12345678"},
        )

        response = self.client.post(
            "/api/auth/login",
            json={"email": "login-user@example.com", "password": "12345678"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["access_token"])
        self.assertEqual(payload["user"]["email"], "login-user@example.com")

    def test_duplicate_register_is_rejected(self):
        first = self.client.post(
            "/api/auth/register",
            json={"email": "duplicate@example.com", "password": "12345678"},
        )
        second = self.client.post(
            "/api/auth/register",
            json={"email": "duplicate@example.com", "password": "12345678"},
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.get_json()["error"], "email already registered")

    def test_registered_user_can_submit_new_recycling_request(self):
        token = self._register_and_login("request-user@example.com")

        response = self.client.post(
            "/api/requests",
            json={
                "item_name": "iPhone 13",
                "category": "phone",
                "condition": "working",
                "preferred_method": "dropoff",
                "pickup_address": None,
                "contact_phone": None,
                "data_wipe": True,
                "paid_retrieval": False,
                "age_years": 1,
                "demand": "medium",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["request"]["preferred_method"], "dropoff")
        self.assertEqual(payload["request"]["device"]["name"], "iPhone 13")
        self.assertEqual(payload["request"]["device"]["device_type"], "phone")

    def test_forgot_password_requires_email(self):
        response = self.client.post("/api/auth/forgot-password", json={})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "email is required")

    def test_forgot_password_creates_reset_token_for_existing_user(self):
        self.client.post(
            "/api/auth/register",
            json={"email": "reset-user@example.com", "password": "12345678"},
        )

        response = self.client.post(
            "/api/auth/forgot-password",
            json={"email": "reset-user@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(
            payload["message"],
            "If the email is registered, password reset instructions will be sent.",
        )
        self.assertEqual(
            payload,
            {"message": "If the email is registered, password reset instructions will be sent."},
        )

        with self.app.app_context():
            before_count = db.session.query(PasswordResetToken).count()
            user = db.session.query(AppUser).filter_by(email="reset-user@example.com").first()
            self.assertIsNotNone(user)
            self.assertEqual(before_count, 1)
            token_records = db.session.query(PasswordResetToken).filter_by(user_id=user.id).all()
            self.assertEqual(len(token_records), 1)
            token_record = token_records[0]
            self.assertIsNotNone(token_record)
            self.assertEqual(token_record.user_id, user.id)
            self.assertTrue(token_record.token)
            self.assertFalse(token_record.used)
            self.assertGreater(token_record.expires_at, token_record.created_at)

    def test_forgot_password_returns_generic_success_for_unknown_email(self):
        with self.app.app_context():
            missing_user = db.session.query(AppUser).filter_by(email="missing-user@example.com").first()
            self.assertIsNone(missing_user)
            before_count = db.session.query(PasswordResetToken).count()

        response = self.client.post(
            "/api/auth/forgot-password",
            json={"email": "missing-user@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(
            payload["message"],
            "If the email is registered, password reset instructions will be sent.",
        )
        self.assertEqual(
            payload,
            {"message": "If the email is registered, password reset instructions will be sent."},
        )

        with self.app.app_context():
            after_count = db.session.query(PasswordResetToken).count()
            self.assertEqual(after_count, before_count)

    def test_reset_password_with_valid_token_updates_password_and_marks_token_used(self):
        token, user_id = self._create_reset_token("reset-valid@example.com")

        response = self.client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"message": "password reset successful"})

        with self.app.app_context():
            token_record = db.session.query(PasswordResetToken).filter_by(token=token).one()
            user = db.session.query(AppUser).filter_by(id=user_id).one()
            self.assertTrue(token_record.used)
            self.assertTrue(check_password_hash(user.password_hash, "new-password-123"))

        login_response = self.client.post(
            "/api/auth/login",
            json={"email": "reset-valid@example.com", "password": "new-password-123"},
        )
        self.assertEqual(login_response.status_code, 200)

    def test_reset_password_rejects_invalid_token(self):
        response = self.client.post(
            "/api/auth/reset-password",
            json={
                "token": "missing-token",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "invalid token"})

    def test_reset_password_rejects_expired_token(self):
        token, _ = self._create_reset_token(
            "reset-expired@example.com",
            expires_at=datetime.utcnow() - timedelta(minutes=1),
        )

        response = self.client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "token has expired"})

        with self.app.app_context():
            token_record = db.session.query(PasswordResetToken).filter_by(token=token).one()
            self.assertFalse(token_record.used)

    def test_reset_password_rejects_used_token(self):
        token, _ = self._create_reset_token("reset-used@example.com", used=True)

        response = self.client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json(), {"error": "token has already been used"})

    def test_reset_password_rejects_password_mismatch(self):
        token, user_id = self._create_reset_token("reset-mismatch@example.com")

        response = self.client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "new_password": "new-password-123",
                "confirm_password": "different-password-123",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "passwords do not match"})

        with self.app.app_context():
            token_record = db.session.query(PasswordResetToken).filter_by(token=token).one()
            user = db.session.query(AppUser).filter_by(id=user_id).one()
            self.assertFalse(token_record.used)
            self.assertTrue(check_password_hash(user.password_hash, "12345678"))

    def test_change_password_requires_authenticated_user(self):
        response = self.client.post(
            "/api/auth/change-password",
            json={
                "current_password": "12345678",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_change_password_updates_local_password_and_enables_new_login(self):
        access_token = self._register_and_login("change-password@example.com")
        response = self.client.post(
            "/api/auth/change-password",
            json={
                "current_password": "12345678",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"message": "password changed successfully"})

        old_login = self.client.post(
            "/api/auth/login",
            json={"email": "change-password@example.com", "password": "12345678"},
        )
        self.assertEqual(old_login.status_code, 401)

        new_login = self.client.post(
            "/api/auth/login",
            json={"email": "change-password@example.com", "password": "new-password-123"},
        )
        self.assertEqual(new_login.status_code, 200)

    def test_change_password_rejects_wrong_current_password(self):
        access_token = self._register_and_login("change-password-wrong@example.com")
        response = self.client.post(
            "/api/auth/change-password",
            json={
                "current_password": "wrong-password",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "current password is incorrect"})

    def test_change_password_rejects_non_local_account(self):
        with self.app.app_context():
            google_user = AppUser(
                email="google-change@example.com",
                auth_provider="google",
                google_sub="google-change-sub",
                password_hash="placeholder-google-password",
                role="consumer",
            )
            db.session.add(google_user)
            db.session.commit()
            access_token = create_access_token(identity=str(google_user.id), additional_claims={"role": "consumer"})

        response = self.client.post(
            "/api/auth/change-password",
            json={
                "current_password": "any-password",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {"error": "Password change is only available for email/password accounts."},
        )

    def test_admin_users_requires_admin_role(self):
        access_token, _ = self._make_access_token_for_role("staff-view@example.com", "staff")

        response = self.client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["admin"]},
        )

    def test_admin_users_lists_accounts_with_filters(self):
        admin_token, admin_id = self._make_access_token_for_role("admin-view@example.com", "admin")

        with self.app.app_context():
            db.session.add_all([
                AppUser(
                    email="owner-one@example.com",
                    auth_provider="local",
                    full_name="Owner One",
                    password_hash="hash-1",
                    role="consumer",
                ),
                AppUser(
                    email="staff-one@example.com",
                    auth_provider="local",
                    full_name="Staff One",
                    password_hash="hash-2",
                    role="staff",
                ),
                AppUser(
                    email="owner-two@example.com",
                    auth_provider="google",
                    full_name="Owner Two",
                    google_sub="google-owner-two",
                    password_hash="hash-3",
                    role="consumer",
                ),
            ])
            db.session.commit()

        response = self.client.get(
            "/api/admin/users?role=consumer&q=owner&limit=1&offset=0",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["pagination"], {"total": 2, "limit": 1, "offset": 0})
        self.assertEqual(payload["filters"], {"role": "consumer", "q": "owner"})
        self.assertEqual(len(payload["users"]), 1)

        listed_user = payload["users"][0]
        self.assertEqual(listed_user["role"], "consumer")
        self.assertIn("owner", listed_user["email"])
        self.assertIn("id", listed_user)
        self.assertIn("created_at", listed_user)
        self.assertIn("full_name", listed_user)
        self.assertIn("auth_provider", listed_user)

        all_response = self.client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(all_response.status_code, 200)
        all_payload = all_response.get_json()
        self.assertGreaterEqual(all_payload["pagination"]["total"], 4)
        returned_ids = {user["id"] for user in all_payload["users"]}
        self.assertIn(admin_id, returned_ids)

    def test_admin_users_rejects_invalid_pagination(self):
        admin_token, _ = self._make_access_token_for_role("admin-invalid@example.com", "admin")

        response = self.client.get(
            "/api/admin/users?limit=0",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "invalid limit"})

        response = self.client.get(
            "/api/admin/users?offset=-1",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "invalid offset"})

    def test_admin_update_user_role_requires_admin(self):
        access_token, user_id = self._make_access_token_for_role("staff-role-view@example.com", "staff")

        response = self.client.patch(
            f"/api/admin/users/{user_id}/role",
            json={"role": "staff"},
            headers={"Authorization": f"Bearer {access_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["admin"]},
        )

    def test_admin_update_user_role_upgrades_consumer_to_staff(self):
        admin_token, _ = self._make_access_token_for_role("admin-upgrade@example.com", "admin")

        with self.app.app_context():
            target = AppUser(
                email="consumer-upgrade@example.com",
                auth_provider="local",
                full_name="Upgrade Target",
                password_hash="hash-upgrade",
                role="consumer",
            )
            db.session.add(target)
            db.session.commit()
            target_id = target.id

        response = self.client.patch(
            f"/api/admin/users/{target_id}/role",
            json={"role": "staff"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["user"]["id"], target_id)
        self.assertEqual(payload["user"]["email"], "consumer-upgrade@example.com")
        self.assertEqual(payload["user"]["role"], "staff")
        self.assertIn("created_at", payload["user"])

        with self.app.app_context():
            updated_user = db.session.query(AppUser).filter_by(id=target_id).one()
            self.assertEqual(updated_user.role, "staff")

    def test_admin_update_user_role_allows_staff_to_consumer(self):
        admin_token, _ = self._make_access_token_for_role("admin-downgrade@example.com", "admin")

        with self.app.app_context():
            target = AppUser(
                email="staff-downgrade@example.com",
                auth_provider="local",
                password_hash="hash-downgrade",
                role="staff",
            )
            db.session.add(target)
            db.session.commit()
            target_id = target.id

        response = self.client.patch(
            f"/api/admin/users/{target_id}/role",
            json={"role": "consumer"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "consumer")

    def test_admin_update_user_role_rejects_invalid_role(self):
        admin_token, user_id = self._make_access_token_for_role("admin-invalid-role@example.com", "admin")

        response = self.client.patch(
            f"/api/admin/users/{user_id}/role",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "invalid role", "allowed_roles": ["admin", "consumer", "staff"]},
        )

    def test_admin_update_user_role_rejects_missing_user(self):
        admin_token, _ = self._make_access_token_for_role("admin-missing-user@example.com", "admin")

        response = self.client.patch(
            "/api/admin/users/999999/role",
            json={"role": "staff"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "user not found"})

    def test_admin_can_promote_user_to_admin(self):
        admin_token, _ = self._make_access_token_for_role("admin-promoter@example.com", "admin")

        with self.app.app_context():
            target = AppUser(
                email="admin-promote-target@example.com",
                auth_provider="local",
                password_hash="hash-promote-admin",
                role="consumer",
            )
            db.session.add(target)
            db.session.commit()
            target_id = target.id

        response = self.client.patch(
            f"/api/admin/users/{target_id}/role",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "admin")

    def test_admin_cannot_remove_own_admin_role(self):
        admin_token, admin_id = self._make_access_token_for_role("admin-self-demote@example.com", "admin")

        response = self.client.patch(
            f"/api/admin/users/{admin_id}/role",
            json={"role": "staff"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json(), {"error": "cannot remove your own admin role"})

    def test_device_responses_include_processing_status(self):
        owner_token = self._register_and_login("device-owner@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Owner Laptop",
                "device_type": "laptop",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(create_response.status_code, 201)
        created_device = create_response.get_json()["device"]
        self.assertEqual(created_device["processing_status"], "pending")
        self.assertEqual(created_device["workflow_status"], "pending")
        self.assertTrue(created_device["is_visible"])
        self.assertFalse(created_device["is_draft"])
        self.assertFalse(created_device["owner_contacted"])
        self.assertIsNone(created_device["owner_contacted_at"])

        device_id = created_device["id"]
        detail_response = self.client.get(
            f"/api/devices/{device_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()["device"]["processing_status"], "pending")
        self.assertTrue(detail_response.get_json()["device"]["is_visible"])
        self.assertFalse(detail_response.get_json()["device"]["is_draft"])
        self.assertFalse(detail_response.get_json()["device"]["owner_contacted"])
        self.assertIsNone(detail_response.get_json()["device"]["owner_contacted_at"])

    def test_processing_status_update_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Phone",
                "device_type": "phone",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/processing-status",
            json={"processing_status": "processing"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_update_processing_status(self):
        owner_token = self._register_and_login("device-owner-staff-update@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Review Tablet",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/processing-status",
            json={"processing_status": "processing"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertEqual(updated_device["processing_status"], "processing")
        self.assertEqual(updated_device["workflow_status"], "processing")
        self.assertIn("classification", updated_device)
        self.assertIn("device_type", updated_device)

    def test_processing_status_update_rejects_invalid_value(self):
        owner_token = self._register_and_login("device-owner-invalid-status@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Status Console",
                "device_type": "console",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/processing-status",
            json={"processing_status": "reviewing"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {
                "error": "invalid processing_status",
                "allowed": ["done", "pending", "processing", "rejected"],
            },
        )

    def test_classification_update_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-classification-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Classification Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/classification",
            json={"classification": "recycle"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_update_device_classification(self):
        owner_token = self._register_and_login("device-owner-classification@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-classification@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Classification Tablet",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/classification",
            json={"classification": "recycle"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertEqual(updated_device["classification"], "recycle")
        self.assertIn("processing_status", updated_device)
        self.assertIn("device_type", updated_device)
        self.assertIn("name", updated_device)

    def test_classification_update_rejects_invalid_value(self):
        owner_token = self._register_and_login("device-owner-invalid-classification@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin-classification@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Classification Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/classification",
            json={"classification": "approved"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {
                "error": "invalid classification",
                "allowed": ["current", "rare", "recycle", "unknown", "unwanted"],
            },
        )

    def test_classification_update_rejects_missing_device(self):
        admin_token, _ = self._make_access_token_for_role("device-admin-missing-classification@example.com", "admin")

        response = self.client.patch(
            "/api/devices/999999/classification",
            json={"classification": "recycle"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "not found"})

    def test_visibility_update_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-visibility-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Visibility Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/visibility",
            json={"is_visible": False},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_update_device_visibility(self):
        owner_token = self._register_and_login("device-owner-visibility@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-visibility@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Visibility Tablet",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/visibility",
            json={"is_visible": False},
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertFalse(updated_device["is_visible"])
        self.assertIn("classification", updated_device)
        self.assertIn("processing_status", updated_device)
        self.assertIn("device_type", updated_device)
        self.assertIn("name", updated_device)

    def test_visibility_update_rejects_invalid_payload(self):
        owner_token = self._register_and_login("device-owner-invalid-visibility@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin-visibility@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Visibility Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/visibility",
            json={"is_visible": "false"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "invalid is_visible", "expected": "boolean"},
        )

    def test_draft_update_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-draft-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Draft Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/draft",
            json={"is_draft": True},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_update_device_draft_state(self):
        owner_token = self._register_and_login("device-owner-draft@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-draft@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Draft Laptop",
                "device_type": "laptop",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/draft",
            json={"is_draft": True},
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertTrue(updated_device["is_draft"])
        self.assertIn("is_visible", updated_device)
        self.assertIn("classification", updated_device)
        self.assertIn("processing_status", updated_device)
        self.assertIn("device_type", updated_device)
        self.assertIn("name", updated_device)

    def test_draft_update_rejects_invalid_payload(self):
        owner_token = self._register_and_login("device-owner-invalid-draft@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin-draft@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Draft Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/draft",
            json={"is_draft": "true"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "invalid is_draft", "expected": "boolean"},
        )

    def test_staff_patch_device_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-edit-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Edit Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}",
            json={"name": "Owner Should Not Edit Staff Route"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_edit_core_device_fields(self):
        owner_token = self._register_and_login("device-owner-edit@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-edit@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Original Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}",
            json={
                "name": "Updated Device Name",
                "device_type": "laptop",
                "condition": "unknown",
                "age_years": 4,
                "demand": "high",
                "notes": "Updated by staff",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertEqual(updated_device["name"], "Updated Device Name")
        self.assertEqual(updated_device["device_type"], "laptop")
        self.assertEqual(updated_device["condition"], "unknown")
        self.assertEqual(updated_device["age_years"], 4)
        self.assertEqual(updated_device["demand"], "high")
        self.assertEqual(updated_device["classification"], "rare")
        self.assertEqual(updated_device["notes"], "Updated by staff")
        self.assertIn("processing_status", updated_device)
        self.assertIn("is_visible", updated_device)
        self.assertIn("is_draft", updated_device)
        self.assertEqual(updated_device["owner_id"], create_response.get_json()["device"]["owner_id"])

        detail_response = self.client.get(
            f"/api/devices/{device_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()["device"]["name"], "Updated Device Name")
        self.assertEqual(detail_response.get_json()["device"]["classification"], "rare")

    def test_staff_can_create_device_on_behalf_of_owner(self):
        owner_token = self._register_and_login("device-owner-on-behalf@example.com")
        staff_token, staff_id = self._make_access_token_for_role("device-staff-on-behalf@example.com", "staff")

        owner_response = self.client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner = owner_response.get_json()["user"]

        response = self.client.post(
            "/api/devices",
            json={
                "owner_id": owner["id"],
                "name": "Staff Added Device",
                "device_type": "laptop",
                "condition": "working",
                "age_years": 6,
                "demand": "high",
                "classification": "rare",
                "workflow_status": "processing",
                "is_visible": False,
                "is_draft": True,
                "owner_contacted": True,
                "notes": "Created by staff",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 201)
        device = response.get_json()["device"]
        self.assertEqual(device["owner_id"], owner["id"])
        self.assertEqual(device["name"], "Staff Added Device")
        self.assertEqual(device["device_type"], "laptop")
        self.assertEqual(device["workflow_status"], "processing")
        self.assertFalse(device["is_visible"])
        self.assertTrue(device["is_draft"])
        self.assertTrue(device["owner_contacted"])
        self.assertIsNotNone(device["owner_contacted_at"])
        self.assertEqual(device["classification"], "rare")
        self.assertEqual(device["notes"], "Created by staff")

        owner_devices_response = self.client.get(
            "/api/devices/mine",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(owner_devices_response.status_code, 200)
        self.assertEqual(owner_devices_response.get_json()["devices"][0]["id"], device["id"])

    def test_list_my_submitted_devices_returns_request_status_with_device_details(self):
        owner_token = self._register_and_login("submitted-devices-owner@example.com")
        other_owner_token = self._register_and_login("submitted-devices-other@example.com")

        draft_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Draft Only Device",
                "device_type": "tablet",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(draft_device_response.status_code, 201)

        first_request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Old Submitted Laptop",
                "category": "laptop",
                "condition": "working",
                "preferred_method": "dropoff",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(first_request_response.status_code, 201)
        first_request = first_request_response.get_json()["request"]

        second_request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "New Submitted Phone",
                "category": "phone",
                "condition": "broken",
                "preferred_method": "pickup",
                "pickup_address": "123 Example Street",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(second_request_response.status_code, 201)
        second_request = second_request_response.get_json()["request"]

        other_request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Other Owner Device",
                "category": "console",
                "condition": "working",
                "preferred_method": "dropoff",
            },
            headers={"Authorization": f"Bearer {other_owner_token}"},
        )
        self.assertEqual(other_request_response.status_code, 201)

        response = self.client.get(
            "/api/devices/mine/submitted",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 200)
        devices = response.get_json()["devices"]
        self.assertEqual(len(devices), 2)
        self.assertEqual([item["request"]["id"] for item in devices], [second_request["id"], first_request["id"]])
        self.assertEqual(devices[0]["name"], "New Submitted Phone")
        self.assertEqual(devices[0]["request"]["status"], "submitted")
        self.assertEqual(devices[0]["request"]["preferred_method"], "pickup")
        self.assertEqual(devices[0]["request"]["pickup_address"], "123 Example Street")
        self.assertEqual(devices[0]["request"]["device_id"], devices[0]["id"])
        self.assertEqual(devices[1]["name"], "Old Submitted Laptop")
        self.assertTrue(all(item["name"] != "Draft Only Device" for item in devices))
        self.assertTrue(all(item["name"] != "Other Owner Device" for item in devices))

    def test_staff_patch_device_can_update_operational_flags(self):
        owner_token = self._register_and_login("device-owner-operational-edit@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-operational-edit@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Operational Patch Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}",
            json={
                "item_name": "Operational Patch Device Updated",
                "category": "tablet",
                "processing_status": "processing",
                "is_visible": False,
                "is_draft": True,
                "owner_contacted": True,
                "contact_notes": "Reached owner after triage",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["name"], "Operational Patch Device Updated")
        self.assertEqual(updated_device["device_type"], "tablet")
        self.assertEqual(updated_device["workflow_status"], "processing")
        self.assertFalse(updated_device["is_visible"])
        self.assertTrue(updated_device["is_draft"])
        self.assertTrue(updated_device["owner_contacted"])
        self.assertIsNotNone(updated_device["owner_contacted_at"])
        self.assertEqual(updated_device["notes"], "Reached owner after triage")

    def test_staff_patch_device_rejects_invalid_device_type(self):
        owner_token = self._register_and_login("device-owner-invalid-edit@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin-edit@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Edit Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}",
            json={"device_type": "fridge"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {
                "error": "invalid device_type",
                "allowed": ["console", "laptop", "other", "phone", "tablet"],
            },
        )

    def test_device_statistics_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-statistics-blocked@example.com")

        response = self.client.get(
            "/api/devices/statistics",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_device_statistics_returns_aggregated_counts(self):
        owner_token = self._register_and_login("device-owner-statistics@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-statistics@example.com", "staff")

        unknown_response = self.client.post(
            "/api/devices",
            json={
                "name": "Stats Unknown Device",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(unknown_response.status_code, 201)
        unknown_device_id = unknown_response.get_json()["device"]["id"]

        current_response = self.client.post(
            "/api/devices",
            json={
                "name": "Stats Current Device",
                "device_type": "phone",
                "condition": "working",
                "age_years": 1,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(current_response.status_code, 201)

        recycle_response = self.client.post(
            "/api/devices",
            json={
                "name": "Stats Recycle Device",
                "device_type": "laptop",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(recycle_response.status_code, 201)
        recycle_device_id = recycle_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{recycle_device_id}/processing-status",
            json={"processing_status": "processing"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            f"/api/devices/{recycle_device_id}/classification",
            json={"classification": "recycle"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            f"/api/devices/{recycle_device_id}/visibility",
            json={"is_visible": False},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            f"/api/devices/{recycle_device_id}/draft",
            json={"is_draft": True},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(response.status_code, 200)

        stats_response = self.client.get(
            "/api/devices/statistics",
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(stats_response.status_code, 200)
        payload = stats_response.get_json()
        self.assertEqual(
            payload,
            {
                "totals": {
                    "devices": 3,
                    "visible": 2,
                    "hidden": 1,
                    "draft": 1,
                    "non_draft": 2,
                },
                "processing_status": {
                    "done": 0,
                    "pending": 2,
                    "processing": 1,
                    "rejected": 0,
                },
                "workflow_status": {
                    "done": 0,
                    "pending": 2,
                    "processing": 1,
                    "rejected": 0,
                },
                "classification": {
                    "current": 1,
                    "rare": 0,
                    "recycle": 1,
                    "unknown": 1,
                    "unwanted": 0,
                },
            },
        )

    def test_device_statistics_rejects_query_params(self):
        admin_token, _ = self._make_access_token_for_role("device-admin-statistics@example.com", "admin")

        response = self.client.get(
            "/api/devices/statistics?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "query params are not supported"})

    def test_unknown_queue_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-unknown-queue-blocked@example.com")

        response = self.client.get(
            "/api/devices/unknown-queue",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_unknown_queue_returns_only_unknown_devices(self):
        owner_token = self._register_and_login("device-owner-unknown-queue@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-unknown-queue@example.com", "staff")

        unknown_response = self.client.post(
            "/api/devices",
            json={
                "name": "Unknown Queue Device",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(unknown_response.status_code, 201)

        current_response = self.client.post(
            "/api/devices",
            json={
                "name": "Current Queue Device",
                "device_type": "phone",
                "condition": "working",
                "age_years": 1,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(current_response.status_code, 201)

        unknown_device_id = unknown_response.get_json()["device"]["id"]

        visibility_response = self.client.patch(
            f"/api/devices/{unknown_device_id}/visibility",
            json={"is_visible": False},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(visibility_response.status_code, 200)

        draft_response = self.client.patch(
            f"/api/devices/{unknown_device_id}/draft",
            json={"is_draft": True},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(draft_response.status_code, 200)

        response = self.client.get(
            "/api/devices/unknown-queue?is_visible=false&is_draft=true&limit=10&offset=0",
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        devices = response.get_json()["devices"]
        self.assertEqual(len(devices), 1)
        device = devices[0]
        self.assertEqual(device["id"], unknown_device_id)
        self.assertEqual(device["classification"], "unknown")
        self.assertEqual(device["name"], "Unknown Queue Device")
        self.assertEqual(device["device_type"], "tablet")
        self.assertIn("processing_status", device)
        self.assertFalse(device["is_visible"])
        self.assertTrue(device["is_draft"])
        self.assertIn("notes", device)

    def test_unknown_queue_returns_empty_list_when_no_unknown_devices(self):
        admin_token, _ = self._make_access_token_for_role("device-admin-empty-unknown-queue@example.com", "admin")

        response = self.client.get(
            "/api/devices/unknown-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"devices": []})

    def test_unknown_queue_rejects_invalid_query_params(self):
        admin_token, _ = self._make_access_token_for_role("device-admin-invalid-unknown-queue@example.com", "admin")

        response = self.client.get(
            "/api/devices/unknown-queue?is_visible=maybe",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "invalid is_visible"})

    def test_staff_can_resolve_unknown_queue_item(self):
        owner_token = self._register_and_login("device-owner-unknown-resolve@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-unknown-resolve@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Resolve Unknown Device",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        resolve_response = self.client.patch(
            f"/api/devices/unknown-queue/{device_id}",
            json={
                "classification": "recycle",
                "workflow_status": "processing",
                "is_visible": True,
                "is_draft": False,
                "notes": "Reviewed and routed to recycle",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(resolve_response.status_code, 200)
        device = resolve_response.get_json()["device"]
        self.assertEqual(device["classification"], "recycle")
        self.assertEqual(device["workflow_status"], "processing")
        self.assertEqual(device["notes"], "Reviewed and routed to recycle")

        queue_response = self.client.get(
            "/api/devices/unknown-queue",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(queue_response.status_code, 200)
        self.assertEqual(queue_response.get_json()["devices"], [])

    def test_staff_can_list_unknown_requests(self):
        owner_token = self._register_and_login("request-owner-unknown-queue@example.com")
        staff_token, _ = self._make_access_token_for_role("request-staff-unknown-queue@example.com", "staff")

        unknown_request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Unknown Queue Request Device",
                "category": "tablet",
                "condition": "unknown",
                "preferred_method": "dropoff",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(unknown_request_response.status_code, 201)

        current_request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Current Queue Request Device",
                "category": "phone",
                "condition": "working",
                "preferred_method": "dropoff",
                "age_years": 1,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(current_request_response.status_code, 201)

        response = self.client.get(
            "/api/requests/unknown-queue",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(response.status_code, 200)
        requests_payload = response.get_json()["requests"]
        self.assertEqual(len(requests_payload), 1)
        self.assertEqual(requests_payload[0]["id"], unknown_request_response.get_json()["request"]["id"])
        self.assertEqual(requests_payload[0]["device"]["classification"], "unknown")

    def test_contact_owner_requires_staff_or_admin(self):
        owner_token = self._register_and_login("device-owner-contact-blocked@example.com")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Blocked Contact Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/contact-owner",
            json={"owner_contacted": True, "contact_notes": "Called owner"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_staff_can_record_owner_contact_and_notes(self):
        owner_token = self._register_and_login("device-owner-contact@example.com")
        staff_token, _ = self._make_access_token_for_role("device-staff-contact@example.com", "staff")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Contact Device",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/contact-owner",
            json={
                "owner_contacted": True,
                "contact_notes": "Called owner and left voicemail",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 200)
        updated_device = response.get_json()["device"]
        self.assertEqual(updated_device["id"], device_id)
        self.assertTrue(updated_device["owner_contacted"])
        self.assertIsNotNone(updated_device["owner_contacted_at"])
        self.assertEqual(updated_device["notes"], "Called owner and left voicemail")
        self.assertIn("classification", updated_device)
        self.assertIn("processing_status", updated_device)
        self.assertIn("is_visible", updated_device)
        self.assertIn("is_draft", updated_device)
        self.assertIn("name", updated_device)
        self.assertIn("device_type", updated_device)

    def test_contact_owner_rejects_invalid_payload(self):
        owner_token = self._register_and_login("device-owner-invalid-contact@example.com")
        admin_token, _ = self._make_access_token_for_role("device-admin-contact@example.com", "admin")

        create_response = self.client.post(
            "/api/devices",
            json={
                "name": "Invalid Contact Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_response.get_json()["device"]["id"]

        response = self.client.patch(
            f"/api/devices/{device_id}/contact-owner",
            json={"owner_contacted": "yes"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "invalid owner_contacted", "expected": "boolean"},
        )

    def test_staff_can_create_request_on_behalf_of_owner(self):
        owner_token = self._register_and_login("request-owner-on-behalf@example.com")
        staff_token, staff_id = self._make_access_token_for_role("request-staff-on-behalf@example.com", "staff")

        owner_response = self.client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner = owner_response.get_json()["user"]

        response = self.client.post(
            "/api/requests",
            json={
                "owner_email": owner["email"],
                "item_name": "Staff Submitted Request",
                "category": "console",
                "condition": "working",
                "preferred_method": "pickup",
                "pickup_address": "1 Repair Lane",
                "contact_phone": "0123456789",
                "staff_note": "Captured during walk-in",
                "status": "approved",
                "workflow_status": "processing",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 201)
        request_payload = response.get_json()["request"]
        self.assertEqual(request_payload["consumer_id"], owner["id"])
        self.assertEqual(request_payload["assigned_staff_id"], staff_id)
        self.assertEqual(request_payload["staff_note"], "Captured during walk-in")
        self.assertEqual(request_payload["status"], "approved")
        self.assertEqual(request_payload["device"]["owner_id"], owner["id"])
        self.assertEqual(request_payload["device"]["workflow_status"], "processing")
        self.assertEqual(request_payload["device"]["name"], "Staff Submitted Request")

    def test_unknown_request_queue_requires_staff_or_admin(self):
        owner_token = self._register_and_login("request-owner-unknown-queue-blocked@example.com")

        response = self.client.get(
            "/api/requests/unknown-queue",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.get_json(),
            {"error": "forbidden", "required_roles": ["staff", "admin"]},
        )

    def test_wipe_job_endpoints_require_staff_or_admin(self):
        owner_token = self._register_and_login("wipe-owner-blocked@example.com")

        device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Owner Wipe Device",
                "device_type": "laptop",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = device_response.get_json()["device"]["id"]

        response = self.client.get(
            "/api/devices/wipe-jobs",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(response.status_code, 403)

        create_response = self.client.post(
            f"/api/devices/{device_id}/wipe-jobs",
            json={"wipe_type": "standard"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(create_response.status_code, 403)

    def test_staff_can_create_update_and_certify_wipe_job(self):
        owner_token = self._register_and_login("wipe-owner@example.com")
        staff_token, staff_id = self._make_access_token_for_role("wipe-staff@example.com", "staff")

        request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Wipe Request Device",
                "category": "laptop",
                "condition": "working",
                "preferred_method": "dropoff",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        request_payload = request_response.get_json()["request"]
        device_id = request_payload["device"]["id"]

        create_job_response = self.client.post(
            f"/api/devices/{device_id}/wipe-jobs",
            json={
                "request_id": request_payload["id"],
                "wipe_type": "secure_erase",
                "notes": "Queue for secure erase",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(create_job_response.status_code, 201)
        wipe_job = create_job_response.get_json()["wipe_job"]
        self.assertEqual(wipe_job["device_id"], device_id)
        self.assertEqual(wipe_job["request_id"], request_payload["id"])
        self.assertEqual(wipe_job["assigned_staff_id"], staff_id)
        self.assertEqual(wipe_job["status"], "queued")
        self.assertEqual(wipe_job["wipe_type"], "secure_erase")

        update_job_response = self.client.patch(
            f"/api/devices/wipe-jobs/{wipe_job['id']}",
            json={
                "status": "completed",
                "verification_status": "verified",
                "notes": "Completed successfully",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(update_job_response.status_code, 200)
        updated_wipe_job = update_job_response.get_json()["wipe_job"]
        self.assertEqual(updated_wipe_job["status"], "completed")
        self.assertEqual(updated_wipe_job["verification_status"], "verified")
        self.assertIsNotNone(updated_wipe_job["completed_at"])

        certificate_response = self.client.post(
            f"/api/devices/wipe-jobs/{wipe_job['id']}/certificates",
            json={
                "certificate_reference": "CERT-1001",
                "certificate_url": "https://example.test/certificates/CERT-1001",
                "storage_key": "wipe-certificates/CERT-1001.pdf",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(certificate_response.status_code, 201)
        certificate = certificate_response.get_json()["wipe_certificate"]
        self.assertEqual(certificate["certificate_reference"], "CERT-1001")

        detail_response = self.client.get(
            f"/api/devices/wipe-jobs/{wipe_job['id']}",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(len(detail_response.get_json()["wipe_job"]["certificates"]), 1)

        list_response = self.client.get(
            f"/api/devices/wipe-jobs?device_id={device_id}&status=completed",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.get_json()["wipe_jobs"]), 1)

        certificate_list_response = self.client.get(
            f"/api/devices/wipe-jobs/{wipe_job['id']}/certificates",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(certificate_list_response.status_code, 200)
        self.assertEqual(len(certificate_list_response.get_json()["wipe_certificates"]), 1)

    def test_owner_can_create_paid_data_retrieval_request(self):
        owner_token = self._register_and_login("retrieval-owner@example.com")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Retrieval Phone",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_device_response.get_json()["device"]["id"]

        response = self.client.post(
            "/api/retrieval-requests",
            json={
                "device_id": device_id,
                "note": "Please retrieve all available data",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 201)
        retrieval_request = response.get_json()["retrieval_request"]
        self.assertEqual(retrieval_request["owner_id"], create_device_response.get_json()["device"]["owner_id"])
        self.assertEqual(retrieval_request["consumer_id"], create_device_response.get_json()["device"]["owner_id"])
        self.assertEqual(retrieval_request["device_id"], device_id)
        self.assertEqual(retrieval_request["status"], "pending")
        self.assertEqual(retrieval_request["retrieval_status"], "pending")
        self.assertEqual(retrieval_request["quoted_price"], 10)
        self.assertEqual(retrieval_request["payment_status"], "unpaid")
        self.assertIsNone(retrieval_request["final_price"])
        self.assertEqual(retrieval_request["note"], "Please retrieve all available data")
        self.assertEqual(retrieval_request["payment_transactions"], [])
        self.assertIsNotNone(retrieval_request["created_at"])

    def test_retrieval_request_rejects_non_owned_device(self):
        owner_token = self._register_and_login("retrieval-device-owner@example.com")
        other_owner_token = self._register_and_login("retrieval-other-owner@example.com")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Protected Retrieval Tablet",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_device_response.get_json()["device"]["id"]

        response = self.client.post(
            "/api/retrieval-requests",
            json={"device_id": device_id},
            headers={"Authorization": f"Bearer {other_owner_token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json(), {"error": "forbidden"})

    def test_retrieval_request_rejects_invalid_payload(self):
        owner_token = self._register_and_login("retrieval-invalid-owner@example.com")

        response = self.client.post(
            "/api/retrieval-requests",
            json={"note": 123},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "device_id is required"})

    def test_owner_can_initiate_checkout_and_confirm_paid_retrieval(self):
        owner_token = self._register_and_login("checkout-owner@example.com")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Checkout Device",
                "device_type": "laptop",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        device_id = create_device_response.get_json()["device"]["id"]

        create_retrieval_response = self.client.post(
            "/api/retrieval-requests",
            json={"device_id": device_id, "note": "Need archived files"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        retrieval_request_id = create_retrieval_response.get_json()["retrieval_request"]["id"]

        checkout_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request_id}/checkout",
            json={"provider": "stripe"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(checkout_response.status_code, 200)
        checkout_payload = checkout_response.get_json()
        transaction = checkout_payload["payment_transaction"]
        self.assertEqual(transaction["payment_kind"], "initial_retrieval")
        self.assertEqual(transaction["provider"], "stripe")
        self.assertEqual(transaction["status"], "initiated")
        self.assertEqual(checkout_payload["retrieval_request"]["payment_status"], "pending")
        self.assertEqual(checkout_payload["checkout"]["integration_mode"], "stub")
        self.assertFalse(checkout_payload["checkout"]["provider_configured"])
        self.assertTrue(checkout_payload["checkout"]["success_url"])
        self.assertTrue(checkout_payload["checkout"]["cancel_url"])

        confirm_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request_id}/payment-status",
            json={
                "provider": "stripe",
                "payment_kind": "initial_retrieval",
                "transaction_id": transaction["id"],
                "status": "paid",
                "provider_payment_id": "pi_test_123",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(confirm_response.status_code, 200)
        confirm_payload = confirm_response.get_json()
        updated_request = confirm_payload["retrieval_request"]
        updated_transaction = confirm_payload["payment_transaction"]
        self.assertEqual(updated_transaction["status"], "paid")
        self.assertEqual(updated_request["payment_status"], "paid")
        self.assertEqual(updated_request["payment_provider"], "stripe")
        self.assertEqual(updated_request["payment_reference"], "pi_test_123")
        self.assertIsNotNone(updated_request["paid_at"])
        self.assertIsNotNone(updated_request["storage_expires_at"])
        self.assertEqual(updated_request["status"], "pending")
        self.assertEqual(updated_request["retrieval_status"], "paid")
        self.assertEqual(updated_request["latest_payment_transaction"]["status"], "paid")

    def test_staff_can_mark_paid_retrieval_completed_and_issue_secure_download(self):
        owner_token = self._register_and_login("download-owner@example.com")
        staff_token, _ = self._make_access_token_for_role("download-staff@example.com", "staff")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Download Device",
                "device_type": "laptop",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="active",
            quoted_price=10,
            final_price=10,
            retrieval_status="completed",
            payment_status="paid",
            paid_at=datetime.utcnow(),
            storage_expires_at=datetime.utcnow() + timedelta(days=30),
            note="Recovered data package is ready",
        )

        status_response = self.client.patch(
            f"/api/retrieval-requests/{retrieval_request['id']}/status",
            json={"retrieval_status": "completed", "note": "Archive prepared for owner"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.get_json()["retrieval_request"]["status"], "active")

        response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/issue-download-link",
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(response.status_code, 201)
        download = response.get_json()["download"]
        self.assertEqual(download["retrieval_request_id"], retrieval_request["id"])
        self.assertTrue(download["token"])
        self.assertEqual(download["download_url"], f"/api/retrieval-download/{download['token']}")
        self.assertIsNotNone(download["expires_at"])
        self.assertEqual(download["retrieval_request"]["owner_id"], owner_id)
        self.assertEqual(download["retrieval_request"]["status"], "active")

    def test_issue_download_link_rejects_non_ready_retrieval_request(self):
        owner_token = self._register_and_login("download-pending-owner@example.com")
        admin_token, _ = self._make_access_token_for_role("download-admin@example.com", "admin")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Pending Download Device",
                "device_type": "tablet",
                "condition": "unknown",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="pending",
            quoted_price=10,
            final_price=None,
            retrieval_status="pending",
            payment_status="unpaid",
            note="Still processing",
        )

        response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/issue-download-link",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {"error": "retrieval request is not ready for download"},
        )

    def test_owner_can_access_issued_secure_download_link_once_and_forbidden_user_is_blocked(self):
        owner_token = self._register_and_login("download-access-owner@example.com")
        other_owner_token = self._register_and_login("download-other-owner@example.com")
        staff_token, _ = self._make_access_token_for_role("download-access-staff@example.com", "staff")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Access Download Device",
                "device_type": "console",
                "condition": "broken",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="active",
            quoted_price=10,
            final_price=10,
            retrieval_status="completed",
            payment_status="paid",
            paid_at=datetime.utcnow(),
            storage_expires_at=datetime.utcnow() + timedelta(days=30),
            note="Archive ready for owner access",
        )

        issue_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/issue-download-link",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        token = issue_response.get_json()["download"]["token"]

        forbidden_response = self.client.get(
            f"/api/retrieval-download/{token}",
            headers={"Authorization": f"Bearer {other_owner_token}"},
        )
        self.assertEqual(forbidden_response.status_code, 403)
        self.assertEqual(forbidden_response.get_json(), {"error": "forbidden"})

        owner_access_response = self.client.get(
            f"/api/retrieval-download/{token}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(owner_access_response.status_code, 200)
        download = owner_access_response.get_json()["download"]
        self.assertEqual(download["retrieval_request_id"], retrieval_request["id"])
        self.assertEqual(download["owner_id"], owner_id)
        self.assertEqual(download["status"], "active")
        self.assertEqual(download["retrieval_status"], "completed")
        self.assertEqual(download["device_id"], device_id)
        self.assertEqual(download["final_price"], 10)
        self.assertIsNotNone(download["expires_at"])
        self.assertEqual(download["content"]["kind"], "retrieved-data-package")

        consumed_response = self.client.get(
            f"/api/retrieval-download/{token}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(consumed_response.status_code, 410)
        self.assertEqual(consumed_response.get_json(), {"error": "download link has already been used"})

    def test_secure_download_rejects_unknown_token(self):
        owner_token = self._register_and_login("download-missing-owner@example.com")

        response = self.client.get(
            "/api/retrieval-download/missing-token",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "download not found"})

    def test_secure_download_rejects_expired_link(self):
        owner_token = self._register_and_login("download-expired-owner@example.com")
        staff_token, _ = self._make_access_token_for_role("download-expired-staff@example.com", "staff")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Expired Download Device",
                "device_type": "laptop",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="active",
            quoted_price=10,
            final_price=10,
            retrieval_status="completed",
            payment_status="paid",
            paid_at=datetime.utcnow(),
            storage_expires_at=datetime.utcnow() + timedelta(days=30),
            note="Expired archive",
        )

        issue_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/issue-download-link",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        token = issue_response.get_json()["download"]["token"]

        session = get_session()
        try:
            download = session.query(DataRetrievalDownload).filter_by(token=token).one()
            download.expires_at = datetime.utcnow() - timedelta(seconds=1)
            session.commit()
        finally:
            session.close()

        response = self.client.get(
            f"/api/retrieval-download/{token}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.get_json(), {"error": "download link has expired"})

    def test_owner_can_purchase_extension_and_reactivate_expired_retrieval(self):
        owner_token = self._register_and_login("extension-owner@example.com")
        staff_token, _ = self._make_access_token_for_role("extension-staff@example.com", "staff")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Extension Device",
                "device_type": "phone",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]
        paid_at = datetime.utcnow() - timedelta(days=100)

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="locked",
            quoted_price=10,
            final_price=10,
            retrieval_status="completed",
            payment_status="paid",
            paid_at=paid_at,
            storage_expires_at=paid_at + timedelta(days=90),
            note="Expired but still within extension window",
        )

        checkout_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/extension-checkout",
            json={"provider": "paypal"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(checkout_response.status_code, 200)
        checkout_payload = checkout_response.get_json()
        extension_transaction = checkout_payload["payment_transaction"]
        self.assertEqual(extension_transaction["payment_kind"], "extension")
        self.assertEqual(extension_transaction["status"], "initiated")
        self.assertEqual(checkout_payload["retrieval_request"]["payment_status"], "paid")

        confirm_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/payment-status",
            json={
                "provider": "paypal",
                "payment_kind": "extension",
                "transaction_id": extension_transaction["id"],
                "status": "paid",
                "provider_payment_id": "paypal-ext-123",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(confirm_response.status_code, 200)
        confirm_payload = confirm_response.get_json()
        updated_request = confirm_payload["retrieval_request"]
        self.assertEqual(confirm_payload["payment_transaction"]["status"], "paid")
        self.assertEqual(updated_request["status"], "active")
        self.assertEqual(updated_request["retrieval_status"], "extended")
        self.assertIsNotNone(updated_request["extended_until"])
        self.assertEqual(len(updated_request["payment_transactions"]), 2)

        issue_response = self.client.post(
            f"/api/retrieval-requests/{retrieval_request['id']}/issue-download-link",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(issue_response.status_code, 201)

    def test_retrieval_detail_marks_request_deleted_after_retention_window(self):
        owner_token = self._register_and_login("deleted-retrieval-owner@example.com")

        create_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Deleted Retrieval Device",
                "device_type": "tablet",
                "condition": "working",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        owner_id = create_device_response.get_json()["device"]["owner_id"]
        device_id = create_device_response.get_json()["device"]["id"]
        paid_at = datetime.utcnow() - timedelta(days=200)

        retrieval_request = create_data_retrieval_request(
            device_id=device_id,
            consumer_id=owner_id,
            status="active",
            quoted_price=10,
            final_price=10,
            retrieval_status="completed",
            payment_status="paid",
            paid_at=paid_at,
            storage_expires_at=paid_at + timedelta(days=90),
            note="Should now be deleted",
        )

        response = self.client.get(
            f"/api/retrieval-requests/{retrieval_request['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()["retrieval_request"]
        self.assertEqual(payload["status"], "deleted")
        self.assertEqual(payload["retrieval_status"], "deleted")
        self.assertIsNotNone(payload["deleted_at"])

    def test_partner_listing_uses_canonical_partner_options_for_current_and_rare_devices(self):
        owner_token = self._register_and_login("partner-options-owner@example.com")

        current_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Current Phone",
                "device_type": "phone",
                "condition": "working",
                "age_years": 1,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        rare_device_response = self.client.post(
            "/api/devices",
            json={
                "name": "Rare Console",
                "device_type": "console",
                "condition": "working",
                "age_years": 5,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        current_partners_response = self.client.get(
            f"/api/rewards/partners?device_id={current_device_response.get_json()['device']['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        rare_partners_response = self.client.get(
            f"/api/rewards/partners?device_id={rare_device_response.get_json()['device']['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(current_partners_response.status_code, 200)
        self.assertEqual(rare_partners_response.status_code, 200)
        current_partner_names = [item["name"] for item in current_partners_response.get_json()["partners"]]
        rare_partner_names = [item["name"] for item in rare_partners_response.get_json()["partners"]]
        self.assertIn("CeX UK", current_partner_names)
        self.assertIn("Collector Network", rare_partner_names)

    def test_owner_can_issue_referral_and_rewards_page_stays_compatible(self):
        owner_token = self._register_and_login("referral-issue-owner@example.com")

        request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Referral Laptop",
                "category": "laptop",
                "condition": "working",
                "preferred_method": "dropoff",
                "age_years": 1,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(request_response.status_code, 201)
        request_payload = request_response.get_json()["request"]

        referral_response = self.client.post(
            "/api/rewards/referrals",
            json={"request_id": request_payload["id"]},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(referral_response.status_code, 201)
        referral = referral_response.get_json()["referral"]
        self.assertEqual(referral["classification_snapshot"], "current")
        self.assertEqual(referral["status"], "issued")
        self.assertEqual(referral["partner"]["name"], "CeX UK")
        self.assertTrue(referral["code"])
        self.assertTrue(referral["qr_payload"])
        self.assertTrue(referral["qr_target_url"])

        detail_response = self.client.get(
            f"/api/rewards/referrals/code/{referral['code']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()["referral"]["id"], referral["id"])

        rewards_response = self.client.get(
            "/api/rewards/mine",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(rewards_response.status_code, 200)
        rewards = rewards_response.get_json()["rewards"]
        self.assertEqual(len(rewards), 1)
        self.assertEqual(rewards[0]["partner"], "CeX UK")
        self.assertEqual(rewards[0]["code"], referral["code"])
        self.assertIsNotNone(rewards[0]["referral_code"])

    def test_owner_can_record_referral_open_and_redeem(self):
        owner_token = self._register_and_login("referral-activity-owner@example.com")

        request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Rare Referral Tablet",
                "category": "tablet",
                "condition": "working",
                "preferred_method": "dropoff",
                "age_years": 4,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        referral_response = self.client.post(
            "/api/rewards/referrals",
            json={"request_id": request_response.get_json()["request"]["id"]},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        referral_id = referral_response.get_json()["referral"]["id"]

        open_response = self.client.post(
            f"/api/rewards/referrals/{referral_id}/open",
            json={"source": "dashboard"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        redeem_response = self.client.post(
            f"/api/rewards/referrals/{referral_id}/redeem",
            json={"channel": "partner_portal", "event_reference": "redeem-123"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(open_response.status_code, 200)
        self.assertEqual(redeem_response.status_code, 200)
        updated_referral = redeem_response.get_json()["referral"]
        self.assertEqual(updated_referral["status"], "redeemed")
        activity_types = [item["event_type"] for item in updated_referral["activities"]]
        self.assertIn("issued", activity_types)
        self.assertIn("opened", activity_types)
        self.assertIn("redeemed", activity_types)

    def test_staff_can_record_referral_events_and_manage_referral_fees(self):
        owner_token = self._register_and_login("referral-fee-owner@example.com")
        staff_token, _ = self._make_access_token_for_role("referral-fee-staff@example.com", "staff")

        request_response = self.client.post(
            "/api/requests",
            json={
                "item_name": "Fee Referral Console",
                "category": "console",
                "condition": "working",
                "preferred_method": "dropoff",
                "age_years": 5,
                "demand": "high",
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        referral_response = self.client.post(
            "/api/rewards/referrals",
            json={"request_id": request_response.get_json()["request"]["id"]},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        referral = referral_response.get_json()["referral"]

        handin_response = self.client.post(
            f"/api/rewards/referrals/{referral['id']}/events",
            json={"event_type": "handin_confirmed", "event_reference": "handoff-1"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        resale_response = self.client.post(
            f"/api/rewards/referrals/{referral['id']}/events",
            json={"event_type": "resale_confirmed", "event_reference": "sale-1"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        fee_recorded_response = self.client.post(
            f"/api/rewards/referrals/{referral['id']}/events",
            json={"event_type": "fee_recorded", "event_reference": "fee-1"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(handin_response.status_code, 200)
        self.assertEqual(resale_response.status_code, 200)
        self.assertEqual(fee_recorded_response.status_code, 200)

        create_fee_response = self.client.post(
            "/api/rewards/referral-fees",
            json={
                "referral_code_id": referral["id"],
                "status": "expected",
                "fee_amount": 35,
                "currency": "GBP",
                "fee_reference": "fee-ref-1",
            },
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(create_fee_response.status_code, 201)
        fee = create_fee_response.get_json()["referral_fee"]
        self.assertEqual(fee["status"], "expected")
        self.assertEqual(fee["fee_amount"], 35)

        update_fee_response = self.client.patch(
            f"/api/rewards/referral-fees/{fee['id']}",
            json={"status": "paid"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        self.assertEqual(update_fee_response.status_code, 200)
        updated_fee = update_fee_response.get_json()["referral_fee"]
        self.assertEqual(updated_fee["status"], "paid")
        self.assertIsNotNone(updated_fee["paid_at"])

        fees_report_response = self.client.get(
            "/api/rewards/referral-fees?status=paid",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        activity_report_response = self.client.get(
            f"/api/rewards/referral-activity?referral_code_id={referral['id']}",
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(fees_report_response.status_code, 200)
        self.assertEqual(activity_report_response.status_code, 200)
        self.assertEqual(len(fees_report_response.get_json()["referral_fees"]), 1)
        reported_event_types = [item["event_type"] for item in activity_report_response.get_json()["referral_activity"]]
        self.assertIn("handin_confirmed", reported_event_types)
        self.assertIn("resale_confirmed", reported_event_types)
        self.assertIn("fee_recorded", reported_event_types)

    def test_owner_cannot_access_staff_referral_reporting_endpoints(self):
        owner_token = self._register_and_login("referral-reporting-blocked@example.com")

        fees_response = self.client.get(
            "/api/rewards/referral-fees",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        activity_response = self.client.get(
            "/api/rewards/referral-activity",
            headers={"Authorization": f"Bearer {owner_token}"},
        )

        self.assertEqual(fees_response.status_code, 403)
        self.assertEqual(activity_response.status_code, 403)

    def test_staff_can_access_payment_summary_report(self):
        fixtures = self._seed_reporting_records()

        response = self.client.get(
            "/api/reports/payments/summary",
            headers={"Authorization": f"Bearer {fixtures['staff_token']}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["total_transactions"], 2)
        self.assertEqual(payload["total_amount"], 23)
        self.assertEqual(payload["paid_amount"], 15)
        self.assertEqual(payload["pending_amount"], 8)
        self.assertEqual(payload["initiated_amount"], 0)
        self.assertEqual(payload["counts_by_status"]["paid"], 1)
        self.assertEqual(payload["counts_by_status"]["pending"], 1)
        self.assertEqual(payload["counts_by_provider"]["stripe"], 1)
        self.assertEqual(payload["counts_by_provider"]["paypal"], 1)
        self.assertEqual(payload["counts_by_payment_kind"]["initial_retrieval"], 1)
        self.assertEqual(payload["counts_by_payment_kind"]["extension"], 1)
        self.assertIsNotNone(payload["latest_created_at"])

    def test_admin_can_access_payment_transactions_report(self):
        fixtures = self._seed_reporting_records()

        response = self.client.get(
            "/api/reports/payments/transactions",
            headers={"Authorization": f"Bearer {fixtures['admin_token']}"},
        )

        self.assertEqual(response.status_code, 200)
        transactions = response.get_json()["transactions"]
        self.assertEqual(len(transactions), 2)
        first_transaction = transactions[0]
        self.assertIn("id", first_transaction)
        self.assertIn("retrieval_request_id", first_transaction)
        self.assertIn("consumer_id", first_transaction)
        self.assertIn("provider", first_transaction)
        self.assertIn("payment_kind", first_transaction)
        self.assertIn("status", first_transaction)
        self.assertIn("amount", first_transaction)
        self.assertIn("currency", first_transaction)
        self.assertIn("provider_payment_id", first_transaction)
        self.assertIn("checkout_reference", first_transaction)
        self.assertIn("initiated_at", first_transaction)
        self.assertIn("paid_at", first_transaction)
        self.assertIn("failed_at", first_transaction)
        self.assertIn("cancelled_at", first_transaction)
        self.assertIn("refunded_at", first_transaction)
        self.assertIn("created_at", first_transaction)
        self.assertIn("updated_at", first_transaction)
        self.assertEqual(first_transaction["retrieval_request"]["id"], fixtures["retrieval_request_id"])
        self.assertEqual(first_transaction["consumer"]["id"], fixtures["owner_id"])
        self.assertEqual(first_transaction["device"]["id"], fixtures["device_id"])

    def test_consumer_cannot_access_payment_reports(self):
        fixtures = self._seed_reporting_records()

        summary_response = self.client.get(
            "/api/reports/payments/summary",
            headers={"Authorization": f"Bearer {fixtures['owner_token']}"},
        )
        transactions_response = self.client.get(
            "/api/reports/payments/transactions",
            headers={"Authorization": f"Bearer {fixtures['owner_token']}"},
        )

        self.assertEqual(summary_response.status_code, 403)
        self.assertEqual(transactions_response.status_code, 403)

    def test_staff_can_access_referral_summary_report(self):
        fixtures = self._seed_reporting_records()

        response = self.client.get(
            "/api/reports/referrals/summary",
            headers={"Authorization": f"Bearer {fixtures['staff_token']}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["total_referral_codes"], 2)
        self.assertEqual(payload["total_referral_activity"], 2)
        self.assertEqual(payload["total_referral_fees"], 2)
        self.assertEqual(payload["fee_amount_total"], 65)
        self.assertEqual(payload["fee_amount_confirmed"], 0)
        self.assertEqual(payload["fee_amount_paid"], 25)
        self.assertEqual(payload["counts_by_fee_status"]["paid"], 1)
        self.assertEqual(payload["counts_by_fee_status"]["expected"], 1)
        self.assertEqual(payload["counts_by_activity_event_type"]["redeemed"], 1)
        self.assertEqual(payload["counts_by_activity_event_type"]["opened"], 1)
        self.assertEqual(payload["counts_by_partner"]["Partner Alpha"], 1)
        self.assertEqual(payload["counts_by_partner"]["Partner Beta"], 1)

    def test_admin_can_access_referral_fees_report(self):
        fixtures = self._seed_reporting_records()

        response = self.client.get(
            "/api/reports/referrals/fees",
            headers={"Authorization": f"Bearer {fixtures['admin_token']}"},
        )

        self.assertEqual(response.status_code, 200)
        fees = response.get_json()["referral_fees"]
        self.assertEqual(len(fees), 2)
        first_fee = fees[0]
        self.assertIn("id", first_fee)
        self.assertIn("partner_id", first_fee)
        self.assertIn("referral_code_id", first_fee)
        self.assertIn("referral_activity_id", first_fee)
        self.assertIn("consumer_id", first_fee)
        self.assertIn("device_id", first_fee)
        self.assertIn("request_id", first_fee)
        self.assertIn("status", first_fee)
        self.assertIn("fee_amount", first_fee)
        self.assertIn("currency", first_fee)
        self.assertIn("fee_reference", first_fee)
        self.assertIn("due_at", first_fee)
        self.assertIn("confirmed_at", first_fee)
        self.assertIn("paid_at", first_fee)
        self.assertIn("created_at", first_fee)
        self.assertIn("updated_at", first_fee)
        self.assertIn("partner", first_fee)
        self.assertIn("referral_code", first_fee)
        self.assertIn("request", first_fee)
        self.assertIn("device", first_fee)

    def test_staff_can_access_referral_activity_report(self):
        fixtures = self._seed_reporting_records()

        response = self.client.get(
            "/api/reports/referrals/activity",
            headers={"Authorization": f"Bearer {fixtures['staff_token']}"},
        )

        self.assertEqual(response.status_code, 200)
        activity = response.get_json()["referral_activity"]
        self.assertEqual(len(activity), 2)
        first_event = activity[0]
        self.assertIn("id", first_event)
        self.assertIn("partner_id", first_event)
        self.assertIn("referral_code_id", first_event)
        self.assertIn("consumer_id", first_event)
        self.assertIn("device_id", first_event)
        self.assertIn("request_id", first_event)
        self.assertIn("event_type", first_event)
        self.assertIn("event_reference", first_event)
        self.assertIn("metadata_json", first_event)
        self.assertIn("notes", first_event)
        self.assertIn("occurred_at", first_event)
        self.assertIn("created_at", first_event)
        self.assertIn("partner", first_event)
        self.assertIn("referral_code", first_event)

    def test_consumer_cannot_access_referral_reports(self):
        fixtures = self._seed_reporting_records()

        summary_response = self.client.get(
            "/api/reports/referrals/summary",
            headers={"Authorization": f"Bearer {fixtures['owner_token']}"},
        )
        fees_response = self.client.get(
            "/api/reports/referrals/fees",
            headers={"Authorization": f"Bearer {fixtures['owner_token']}"},
        )
        activity_response = self.client.get(
            "/api/reports/referrals/activity",
            headers={"Authorization": f"Bearer {fixtures['owner_token']}"},
        )

        self.assertEqual(summary_response.status_code, 403)
        self.assertEqual(fees_response.status_code, 403)
        self.assertEqual(activity_response.status_code, 403)

    def test_reporting_filters_apply_to_payment_and_referral_reports(self):
        fixtures = self._seed_reporting_records()

        payment_response = self.client.get(
            "/api/reports/payments/transactions?provider=paypal&payment_kind=extension&from=2026-04-15",
            headers={"Authorization": f"Bearer {fixtures['staff_token']}"},
        )
        self.assertEqual(payment_response.status_code, 200)
        payment_transactions = payment_response.get_json()["transactions"]
        self.assertEqual(len(payment_transactions), 1)
        self.assertEqual(payment_transactions[0]["provider"], "paypal")
        self.assertEqual(payment_transactions[0]["payment_kind"], "extension")

        referral_response = self.client.get(
            f"/api/reports/referrals/fees?partner_id={fixtures['partner_alpha_id']}&status=paid",
            headers={"Authorization": f"Bearer {fixtures['staff_token']}"},
        )
        self.assertEqual(referral_response.status_code, 200)
        referral_fees = referral_response.get_json()["referral_fees"]
        self.assertEqual(len(referral_fees), 1)
        self.assertEqual(referral_fees[0]["partner"]["name"], "Partner Alpha")
        self.assertEqual(referral_fees[0]["status"], "paid")

    def test_reporting_endpoints_return_empty_payloads_when_no_data(self):
        staff_token, _ = self._make_access_token_for_role("reports-empty-staff@example.com", "staff")

        payment_summary_response = self.client.get(
            "/api/reports/payments/summary",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        payment_transactions_response = self.client.get(
            "/api/reports/payments/transactions",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        referral_summary_response = self.client.get(
            "/api/reports/referrals/summary",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        referral_fees_response = self.client.get(
            "/api/reports/referrals/fees",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        referral_activity_response = self.client.get(
            "/api/reports/referrals/activity",
            headers={"Authorization": f"Bearer {staff_token}"},
        )

        self.assertEqual(payment_summary_response.status_code, 200)
        self.assertEqual(payment_transactions_response.status_code, 200)
        self.assertEqual(referral_summary_response.status_code, 200)
        self.assertEqual(referral_fees_response.status_code, 200)
        self.assertEqual(referral_activity_response.status_code, 200)

        self.assertEqual(
            payment_summary_response.get_json(),
            {
                "total_transactions": 0,
                "total_amount": 0,
                "counts_by_status": {},
                "counts_by_provider": {},
                "counts_by_payment_kind": {},
                "paid_amount": 0,
                "pending_amount": 0,
                "initiated_amount": 0,
                "latest_created_at": None,
            },
        )
        self.assertEqual(payment_transactions_response.get_json(), {"transactions": []})
        self.assertEqual(
            referral_summary_response.get_json(),
            {
                "total_referral_codes": 0,
                "total_referral_activity": 0,
                "total_referral_fees": 0,
                "fee_amount_total": 0,
                "fee_amount_confirmed": 0,
                "fee_amount_paid": 0,
                "counts_by_fee_status": {},
                "counts_by_activity_event_type": {},
                "counts_by_partner": {},
            },
        )
        self.assertEqual(referral_fees_response.get_json(), {"referral_fees": []})
        self.assertEqual(referral_activity_response.get_json(), {"referral_activity": []})

    def test_app_registers_reporting_routes(self):
        routes = {rule.rule for rule in self.app.url_map.iter_rules()}
        self.assertIn("/api/reports/payments/summary", routes)
        self.assertIn("/api/reports/payments/transactions", routes)
        self.assertIn("/api/reports/referrals/summary", routes)
        self.assertIn("/api/reports/referrals/fees", routes)
        self.assertIn("/api/reports/referrals/activity", routes)


if __name__ == "__main__":
    unittest.main()
