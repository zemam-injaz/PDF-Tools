"""Ed25519 signing of entitlement payloads.

The server signs every entitlement it returns. The desktop app verifies the
signature with an embedded public key before trusting any offline cache, so a
user editing the local cache cannot forge a premium entitlement.
"""
import base64
import json
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature


def _canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


class EntitlementSigner:
    def __init__(self):
        self._key = self._load_or_create_key()
        self.public_key_b64 = base64.b64encode(self._key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )).decode()

    def _load_or_create_key(self) -> Ed25519PrivateKey:
        env_b64 = os.getenv("ENTITLEMENT_PRIVATE_KEY")
        env_file = os.getenv("ENTITLEMENT_PRIVATE_KEY_FILE")

        # Fail fast in production: never fall back to the dev keypair.
        if os.environ.get("ENVIRONMENT", "").strip().lower() == "production" and not env_b64 and not env_file:
            raise RuntimeError(
                "Production requires ENTITLEMENT_PRIVATE_KEY (or ENTITLEMENT_PRIVATE_KEY_FILE); "
                "refusing to start with the dev signing key"
            )

        if env_b64:
            return Ed25519PrivateKey.from_private_bytes(base64.b64decode(env_b64))

        env_file = os.getenv("ENTITLEMENT_PRIVATE_KEY_FILE")
        candidates = []
        if env_file:
            candidates.append(env_file)
        candidates.append(os.path.join(os.path.expanduser("~"), ".pdf-tools", "entitlement_ed25519.key"))
        candidates.append(os.path.join(os.path.dirname(__file__), "..", ".entitlement_ed25519.key"))

        for path in candidates:
            if os.path.exists(path):
                with open(path, "rb") as f:
                    return Ed25519PrivateKey.from_private_bytes(f.read())

        # Dev mode: generate and persist so the app keeps a stable identity
        key = Ed25519PrivateKey.generate()
        seed = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
        path = candidates[1]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(seed)
        print(f"[ENTITLEMENT] Generated dev signing key at {path}")
        return key

    def sign(self, payload: dict) -> str:
        """Returns a base64 Ed25519 signature over the canonical JSON payload."""
        message = _canonical(payload).encode("utf-8")
        return base64.b64encode(self._key.sign(message)).decode()

    def verify(self, payload: dict, signature_b64: str, public_key_b64: str | None = None) -> bool:
        """Verifies a signature against the payload. Public key defaults to this key's public key."""
        pub_b64 = public_key_b64 or self.public_key_b64
        try:
            pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(pub_b64))
            message = _canonical(payload).encode("utf-8")
            pub.verify(base64.b64decode(signature_b64), message)
            return True
        except (InvalidSignature, ValueError, TypeError):
            return False


entitlement_signer = EntitlementSigner()