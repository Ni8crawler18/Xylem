#!/usr/bin/env python3
"""
Aadhaar Verifiable Credential (SD-JWT) Extractor

Parses an Aadhaar Selective-Disclosure JSON Web Token issued by UIDAI Pehchaan
(pehchaan.uidai.gov.in) and prints a normalized JSON document containing the
JWT header, payload, signature metadata, and the decoded disclosures.

Usage
-----
  Read from file:
      python3 extract_aadhaar_jwt.py path/to/aadhaar.jwt

  Read from stdin:
      cat aadhaar.jwt | python3 extract_aadhaar_jwt.py

  Output structured claims only (useful for ZKP circuit inputs):
      python3 extract_aadhaar_jwt.py path/to/aadhaar.jwt --claims-only

SD-JWT Format
-------------
An SD-JWT looks like::

    <header>.<payload>.<signature>~<disclosure1>~<disclosure2>~...

Where:
  * header    : base64url-encoded JSON header
  * payload   : base64url-encoded JSON payload containing an ``_sd`` array of
                SHA-256 hashes, one per hidden claim
  * signature : RSA signature over ``<header>.<payload>``
  * disclosureN : base64url-encoded JSON array ``[salt, claim_name, value]``

This script verifies each disclosure hash against the ``_sd`` array to confirm
that a disclosure was part of the issued credential.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any


def b64url_decode(data: str) -> bytes:
    """Decode a base64url string with implicit padding."""
    pad = (-len(data)) % 4
    return base64.urlsafe_b64decode(data + ("=" * pad))


def b64url_decode_json(data: str) -> Any:
    return json.loads(b64url_decode(data).decode("utf-8"))


def sha256_b64url(data: str) -> str:
    """Return SHA-256 of a string as base64url (unpadded)."""
    digest = hashlib.sha256(data.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ──────────────────────────────────────────────────────────────────────────────


@dataclass
class Disclosure:
    raw: str
    salt: str
    claim_name: str
    claim_value: Any
    sha256: str
    sd_index: int  # -1 if not found in _sd array


@dataclass
class ParsedSdJwt:
    header: dict
    payload: dict
    signature_b64: str
    signature_bytes: int
    disclosures: list
    hidden_claims_count: int


# ──────────────────────────────────────────────────────────────────────────────


def parse_sd_jwt(raw_token: str) -> ParsedSdJwt:
    """Parse a full SD-JWT (JWT + disclosures) into structured form."""
    raw_token = raw_token.strip()
    parts = raw_token.split("~")
    jwt_part = parts[0]
    disclosure_parts = [p for p in parts[1:] if p]

    segments = jwt_part.split(".")
    if len(segments) != 3:
        raise ValueError(
            f"Invalid JWT structure: expected 3 segments, got {len(segments)}"
        )
    header_b64, payload_b64, signature_b64 = segments

    header = b64url_decode_json(header_b64)
    payload = b64url_decode_json(payload_b64)

    # Parse disclosures
    sd_array = payload.get("_sd") or []
    disclosures: list[Disclosure] = []
    for raw_disclosure in disclosure_parts:
        try:
            decoded = b64url_decode_json(raw_disclosure)
        except (UnicodeDecodeError, ValueError):
            # Binary payloads (e.g. photo bytes) are skipped silently
            continue
        except Exception as exc:  # noqa: BLE001
            print(
                f"warning: failed to decode disclosure: {exc}",
                file=sys.stderr,
            )
            continue

        if not isinstance(decoded, list) or len(decoded) < 3:
            continue

        salt, claim_name, claim_value = decoded[0], decoded[1], decoded[2]
        sha = sha256_b64url(raw_disclosure)
        sd_index = sd_array.index(sha) if sha in sd_array else -1

        disclosures.append(
            Disclosure(
                raw=raw_disclosure,
                salt=salt,
                claim_name=claim_name,
                claim_value=claim_value,
                sha256=sha,
                sd_index=sd_index,
            )
        )

    hidden = max(0, len(sd_array) - len(disclosures))

    return ParsedSdJwt(
        header=header,
        payload=payload,
        signature_b64=signature_b64,
        signature_bytes=len(b64url_decode(signature_b64)),
        disclosures=disclosures,
        hidden_claims_count=hidden,
    )


# ──────────────────────────────────────────────────────────────────────────────


def normalize_claims(parsed: ParsedSdJwt) -> dict:
    """
    Extract structured credential claims suitable for ZKP circuit inputs.
    Returns a dict with keys used by the Xylem circuits:
      name, dateOfBirth (YYYY-MM-DD), aadhaarNumber, pincode, stateCode, gender
    """
    out: dict[str, Any] = {}

    for d in parsed.disclosures:
        if not isinstance(d.claim_value, str):
            continue

        name = d.claim_name.lower() if d.claim_name else ""
        value = d.claim_value

        if name == "dob" or "birth" in name:
            match = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
            if match:
                out["dateOfBirth"] = f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

        if "address" in name or "addr" in name:
            match = re.search(r"\b(\d{6})\b", value)
            if match:
                out["pincode"] = match.group(1)
                out["stateCode"] = match.group(1)[:2]

        if name == "pincode" or name == "pin":
            match = re.search(r"\b(\d{6})\b", value)
            if match:
                out["pincode"] = match.group(1)
                out["stateCode"] = match.group(1)[:2]

        if name == "residentname" or name == "name" or "fullname" in name:
            out["name"] = value

        if "aadhaar" in name or name == "uid" or name == "uidref":
            match = re.search(r"\b(\d{12})\b", value)
            if match:
                out["aadhaarNumber"] = match.group(1)

        if name == "gender" or name == "sex":
            out["gender"] = value.upper()[:1]

    return out


def format_timestamp(ts: Any) -> str:
    if not isinstance(ts, (int, float)):
        return str(ts)
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def to_output_dict(parsed: ParsedSdJwt) -> dict:
    """Build a comprehensive output document."""
    sd_array = parsed.payload.get("_sd") or []
    iat = parsed.payload.get("iat")
    exp = parsed.payload.get("exp")

    return {
        "header": parsed.header,
        "payload": {
            "iss": parsed.payload.get("iss"),
            "id": parsed.payload.get("id"),
            "iat": iat,
            "iat_human": format_timestamp(iat),
            "exp": exp,
            "exp_human": format_timestamp(exp),
            "cnf": parsed.payload.get("cnf", {}),
            "_sd_alg": parsed.payload.get("_sd_alg"),
            "_sd_count": len(sd_array),
        },
        "signature": {
            "algorithm": parsed.header.get("alg"),
            "key_id": parsed.header.get("kid"),
            "type": parsed.header.get("typ"),
            "bytes": parsed.signature_bytes,
            "bits": parsed.signature_bytes * 8,
        },
        "disclosures": [
            {
                "claim_name": d.claim_name,
                "claim_value": d.claim_value,
                "salt": d.salt,
                "sha256": d.sha256,
                "sd_index": d.sd_index,
                "verified": d.sd_index >= 0,
            }
            for d in parsed.disclosures
        ],
        "hidden_claims_count": parsed.hidden_claims_count,
        "extracted_claims": normalize_claims(parsed),
    }


# ──────────────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract and decode an Aadhaar Pehchaan SD-JWT.",
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="Path to a file containing the SD-JWT. If omitted, reads from stdin.",
    )
    parser.add_argument(
        "--claims-only",
        action="store_true",
        help="Output only the extracted credential claims (suitable for Xylem circuit inputs).",
    )
    args = parser.parse_args()

    if args.input:
        with open(args.input, "r", encoding="utf-8") as fh:
            raw = fh.read()
    else:
        raw = sys.stdin.read()

    if not raw.strip():
        print("error: empty input", file=sys.stderr)
        return 1

    try:
        parsed = parse_sd_jwt(raw)
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.claims_only:
        json.dump(normalize_claims(parsed), sys.stdout, indent=2)
    else:
        json.dump(to_output_dict(parsed), sys.stdout, indent=2, default=str)

    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
