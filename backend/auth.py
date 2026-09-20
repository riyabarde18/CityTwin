"""
Phone-number accounts: OTP request/verify + opaque bearer sessions.

No password, no SMS gateway wired up (that needs a paid provider account
this environment doesn't have credentials for) — request_otp() is the single
place a real provider integration would plug in. Until then the code is
logged server-side and, only while config.DEV_EXPOSE_OTP is on, returned
directly in the API response so the demo is self-contained end to end.
"""
import hashlib
import logging
import random
import re
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Header
from sqlalchemy.orm import Session

from config import OTP_LENGTH, OTP_EXPIRY_MINUTES, SESSION_EXPIRY_DAYS, DEV_EXPOSE_OTP
from models import UserModel, OtpCodeModel, SessionModel

logger = logging.getLogger(__name__)

PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


def normalize_phone(raw: str) -> str:
    """Minimal E.164-ish normalization: strip whitespace/dashes, keep a leading +."""
    cleaned = re.sub(r"[\s\-().]", "", raw or "")
    return cleaned


def is_valid_phone(phone_number: str) -> bool:
    return bool(PHONE_RE.match(phone_number))


def _hash_code(phone_number: str, code: str) -> str:
    # Not a security-grade secret store (it's a 6-digit OTP with a short TTL,
    # not a password) — this just avoids keeping the raw code at rest.
    return hashlib.sha256(f"{phone_number}:{code}".encode()).hexdigest()


def generate_otp() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))


def request_otp(db: Session, phone_number: str) -> dict:
    """
    Issues a fresh OTP for a phone number, invalidating any earlier unused
    code. Returns a dict with `dev_otp` populated only in dev-expose mode.
    """
    phone_number = normalize_phone(phone_number)
    if not is_valid_phone(phone_number):
        raise ValueError("Enter a valid phone number (7-15 digits, optional leading +).")

    # Invalidate prior unconsumed codes for this number
    db.query(OtpCodeModel).filter(
        OtpCodeModel.phone_number == phone_number,
        OtpCodeModel.consumed == False  # noqa: E712
    ).update({"consumed": True})

    code = generate_otp()
    now = datetime.utcnow()
    otp_row = OtpCodeModel(
        phone_number=phone_number,
        code_hash=_hash_code(phone_number, code),
        expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES),
        consumed=False,
        attempt_count=0,
        created_at=now,
    )
    db.add(otp_row)
    db.commit()

    # Stand-in for an SMS send. Logged either way so it's visible in server
    # logs during a demo even if DEV_EXPOSE_OTP is later turned off.
    logger.info(f"[OTP] {phone_number} -> {code} (expires in {OTP_EXPIRY_MINUTES}m)")

    return {
        "phone_number": phone_number,
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        "dev_otp": code if DEV_EXPOSE_OTP else None,
    }


MAX_OTP_ATTEMPTS = 5


def verify_otp(db: Session, phone_number: str, code: str) -> tuple[UserModel, str]:
    """Validates the OTP, creates the user on first login, and issues a session token."""
    phone_number = normalize_phone(phone_number)
    now = datetime.utcnow()

    otp_row = (
        db.query(OtpCodeModel)
        .filter(OtpCodeModel.phone_number == phone_number, OtpCodeModel.consumed == False)  # noqa: E712
        .order_by(OtpCodeModel.created_at.desc())
        .first()
    )
    if not otp_row:
        raise ValueError("No pending code for this number. Request a new one.")
    if otp_row.expires_at < now:
        raise ValueError("Code expired. Request a new one.")
    if otp_row.attempt_count >= MAX_OTP_ATTEMPTS:
        raise ValueError("Too many incorrect attempts. Request a new code.")

    if otp_row.code_hash != _hash_code(phone_number, code):
        otp_row.attempt_count += 1
        db.commit()
        raise ValueError("Incorrect code.")

    otp_row.consumed = True

    user = db.query(UserModel).filter(UserModel.phone_number == phone_number).first()
    if not user:
        user = UserModel(phone_number=phone_number, created_at=now)
        db.add(user)
        db.flush()
    user.last_login_at = now

    token = secrets.token_urlsafe(32)
    session = SessionModel(
        token=token,
        user_id=user.user_id,
        created_at=now,
        expires_at=now + timedelta(days=SESSION_EXPIRY_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(user)

    return user, token


def get_user_from_token(db: Session, token: str) -> Optional[UserModel]:
    if not token:
        return None
    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session or session.expires_at < datetime.utcnow():
        return None
    return db.query(UserModel).filter(UserModel.user_id == session.user_id).first()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def optional_auth_dep(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """FastAPI dependency: extracts a bearer token if present, else None. Does not raise."""
    return _extract_bearer_token(authorization)
