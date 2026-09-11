"""Generate an Ed25519 entitlement signing keypair for Warraq.

Usage:
    python -m scripts.generate_entitlement_keys [--out <private_key_file>] [--env-name <name>]

Behaviour:
  - Creates a NEW random keypair.
  - Writes the base64 PRIVATE key to the given file (default: NOT written,
    only printed) so it can be set as ENTITLEMENT_PRIVATE_KEY on the server.
  - Prints the base64 PUBLIC key to embed in the desktop app via
    VITE_ENTITLEMENT_PUBLIC_KEY.

The private key must NEVER be committed to git or embedded in the desktop app.
It lives only in the production server environment.

Rotation:
  1. Generate a new keypair with this script.
  2. Deploy the new private key to the server (ENV).
  3. Ship a new desktop build with the new VITE_ENTITLEMENT_PUBLIC_KEY.
  4. Existing signed caches from the old key stop verifying after the new
     build ships — users re-verify online and receive freshly signed payloads.
"""
import argparse
import base64
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Warraq entitlement signing keypair")
    parser.add_argument("--out", default=None, help="Path to write the private key file (optional)")
    args = parser.parse_args()

    key = Ed25519PrivateKey.generate()

    private_raw = key.private_bytes(
        serialization.Encoding.Raw,
        serialization.PrivateFormat.Raw,
        serialization.NoEncryption(),
    )
    public_raw = key.public_key().public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    )

    private_b64 = base64.b64encode(private_raw).decode()
    public_b64 = base64.b64encode(public_raw).decode()

    if args.out:
        out = os.path.abspath(args.out)
        os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
        with open(out, "wb") as f:
            f.write(private_raw)
        print(f"[OK] Private key written to {out}")

    print("")
    print("Set these on the production server / build (never commit them):")
    print(f"  ENTITLEMENT_PRIVATE_KEY={private_b64}")
    print("")
    print("Embed this PUBLIC key in the desktop app build:")
    print(f"  VITE_ENTITLEMENT_PUBLIC_KEY={public_b64}")
    print("")


if __name__ == "__main__":
    main()