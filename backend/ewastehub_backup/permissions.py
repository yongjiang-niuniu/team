from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def require_roles(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            role = claims.get("role")
            if not role:
                return jsonify({"error": "forbidden", "message": "role missing in token"}), 403
            if role not in roles:
                return jsonify({"error": "forbidden", "required_roles": list(roles)}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator