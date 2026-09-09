from flask import Blueprint, jsonify, request

from DBupdate.db_bridge import (
    get_payment_report_summary,
    get_referral_report_summary,
    list_payment_report_transactions,
    list_referral_report_activity,
    list_referral_report_fees,
)
from ..permissions import require_roles

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _s(value) -> str:
    return (value or "").strip()


def _sl(value) -> str:
    return _s(value).lower()


def _parse_partner_id(value):
    if value in (None, ""):
        return None, None
    try:
        return int(value), None
    except Exception:
        return None, (jsonify({"error": "invalid partner_id"}), 400)


def _report_filters():
    partner_id, partner_error = _parse_partner_id(request.args.get("partner_id"))
    if partner_error:
        return None, partner_error
    return {
        "from_at": request.args.get("from"),
        "to_at": request.args.get("to"),
        "status": _sl(request.args.get("status")) or None,
        "provider": _sl(request.args.get("provider")) or None,
        "payment_kind": _sl(request.args.get("payment_kind")) or None,
        "partner_id": partner_id,
        "partner": _s(request.args.get("partner")) or None,
    }, None


@reports_bp.get("/payments/summary")
@require_roles("staff", "admin")
def payment_summary():
    filters, error_response = _report_filters()
    if error_response:
        return error_response
    try:
        summary = get_payment_report_summary(
            from_at=filters["from_at"],
            to_at=filters["to_at"],
            status=filters["status"],
            provider=filters["provider"],
            payment_kind=filters["payment_kind"],
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(summary)


@reports_bp.get("/payments/transactions")
@require_roles("staff", "admin")
def payment_transactions():
    filters, error_response = _report_filters()
    if error_response:
        return error_response
    try:
        transactions = list_payment_report_transactions(
            from_at=filters["from_at"],
            to_at=filters["to_at"],
            status=filters["status"],
            provider=filters["provider"],
            payment_kind=filters["payment_kind"],
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"transactions": transactions})


@reports_bp.get("/referrals/summary")
@require_roles("staff", "admin")
def referral_summary():
    filters, error_response = _report_filters()
    if error_response:
        return error_response
    try:
        summary = get_referral_report_summary(
            from_at=filters["from_at"],
            to_at=filters["to_at"],
            status=filters["status"],
            partner_id=filters["partner_id"],
            partner=filters["partner"],
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(summary)


@reports_bp.get("/referrals/fees")
@require_roles("staff", "admin")
def referral_fees():
    filters, error_response = _report_filters()
    if error_response:
        return error_response
    try:
        fees = list_referral_report_fees(
            from_at=filters["from_at"],
            to_at=filters["to_at"],
            status=filters["status"],
            partner_id=filters["partner_id"],
            partner=filters["partner"],
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"referral_fees": fees})


@reports_bp.get("/referrals/activity")
@require_roles("staff", "admin")
def referral_activity():
    filters, error_response = _report_filters()
    if error_response:
        return error_response
    try:
        activity = list_referral_report_activity(
            from_at=filters["from_at"],
            to_at=filters["to_at"],
            status=filters["status"],
            partner_id=filters["partner_id"],
            partner=filters["partner"],
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"referral_activity": activity})
