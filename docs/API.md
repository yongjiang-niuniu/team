# API reference

Base URL for local development: `http://127.0.0.1:5050`.

JSON request bodies use `Content-Type: application/json`. Protected endpoints use `Authorization: Bearer <access_token>`.

## Endpoints

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/` | Public | Service name and a short endpoint list |
| GET | `/api/health` | Public | Health response |
| POST | `/api/auth/register` | Public | Register a consumer account |
| POST | `/api/auth/login` | Public | Return JWT access token and user data |
| GET | `/api/me` | Signed in | Return the current user |
| GET | `/api/admin/ping` | Admin | Verify admin access |
| POST | `/api/requests` | Signed in | Create a request belonging to the current user |
| GET | `/api/requests/mine` | Signed in | List the current user's requests, newest first |
| GET | `/api/requests` | Staff/admin | List all requests; optional `?status=submitted` filter |
| GET | `/api/requests/<id>` | Owner/staff/admin | Read a single request |
| PATCH | `/api/requests/<id>/status` | Staff/admin | Set a supported status |

## Consumer example

The email and password below are disposable local examples.

```bash
curl -i -X POST http://127.0.0.1:5050/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"consumer@example.com","password":"local-demo-password"}'

CONSUMER_TOKEN=$(curl -s -X POST http://127.0.0.1:5050/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"consumer@example.com","password":"local-demo-password"}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl -i -X POST http://127.0.0.1:5050/api/requests \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CONSUMER_TOKEN" \
  -d '{"item_name":"Old phone","category":"phone","condition":"broken","preferred_method":"dropoff"}'

curl -i http://127.0.0.1:5050/api/requests/mine \
  -H "Authorization: Bearer $CONSUMER_TOKEN"
```

Registration returns HTTP 201; duplicate email registration returns 409. Invalid login credentials return 401. Request creation returns 201 with a `request` object. Use that object's `id` when reading or updating a request.

All four fields in the creation example are required and must be nonempty. The current code treats them as strings; the example values are not a complete list of allowed categories or methods.

## Local administrator setup

Register a second account at `/api/auth/register`, then run the promotion script from `backend/`:

```bash
python scripts/make_admin.py admin@example.com
```

The script only promotes an existing account. It exits with `User not found` if the email is not registered. Log in after promotion to obtain an access token containing the updated role.

After placing that token in `ADMIN_TOKEN`, inspect and update a request:

```bash
curl -i 'http://127.0.0.1:5050/api/requests?status=submitted' \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -i -X PATCH http://127.0.0.1:5050/api/requests/1/status \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"approved"}'
```

Replace `1` with an existing request ID. Supported statuses are `submitted`, `approved`, `rejected`, and `completed`; an unsupported status returns 400. The API permits any supported status to replace any other supported status.

## Data returned

A public user object contains `id`, `email`, `role`, and `created_at`. Password hashes are not included.

A collection request contains `id`, `created_at`, `consumer_id`, `item_name`, `category`, `condition`, `preferred_method`, and `status`.

Consumers receive 403 when requesting another consumer's item. A missing item returns 404. Roles in already-issued JWTs do not automatically change when the database role changes.
