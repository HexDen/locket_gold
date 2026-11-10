"""
=============================================================================
👑 HEXDEN ROOT CA GENERATOR - TỰ ĐỘNG SINH CHỨNG CHỈ GỐC CHO LOCKET GOLD
Tác giả: HexDen (Văn Nguyên)
Hỗ trợ: https://www.facebook.com/van.nguyen.407297
=============================================================================
"""

import os
import base64
from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_root_ca(output_dir="certs", org_name="HexDen LocketGold", common_name="HexDen Root CA"):
    os.makedirs(output_dir, exist_ok=True)
    key_path = os.path.join(output_dir, "ca.key")
    cert_path = os.path.join(output_dir, "ca.crt")
    
    # 1. Tạo private key RSA 2048-bit
    print("🔑 Đang tạo RSA Private Key cho Root CA...")
    ca_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    with open(key_path, "wb") as f:
        f.write(ca_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    print(f"✅ Đã lưu CA Private Key: {key_path}")

    # 2. Tạo chứng chỉ X.509 Root CA (Thời hạn 10 năm)
    print("📜 Đang tạo chứng chỉ Root CA X.509 (Thời hạn 10 năm)...")
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, org_name),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
    ])
    
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650)) # 10 năm
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )
    
    pem_bytes = cert.public_bytes(serialization.Encoding.PEM)
    with open(cert_path, "wb") as f:
        f.write(pem_bytes)
    print(f"✅ Đã lưu CA Certificate: {cert_path}")
    
    # 3. Xuất dạng Base64 cho .mobileconfig
    b64_str = base64.b64encode(pem_bytes).decode("ascii")
    b64_path = os.path.join(output_dir, "ca_base64.txt")
    with open(b64_path, "w") as f:
        f.write(b64_str)
    print(f"✅ Đã xuất chuỗi Base64 cho .mobileconfig: {b64_path}")
    
    return ca_key, cert, b64_str

if __name__ == "__main__":
    generate_root_ca()

