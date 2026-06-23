import os
import pytest
from services.security_service import SecurityService

def test_check_security_unencrypted(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "unsecured.pdf")
    create_dummy_pdf(pdf_path, num_pages=2)
    
    sec = SecurityService.check_security(pdf_path)
    assert sec["is_encrypted"] is False
    assert sec["needs_password"] is False
    assert sec["is_unlocked"] is True
    assert sec["security_level"] == "none"
    assert all(sec["permissions"].values()) # All permitted

def test_add_and_check_security_encrypted(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "unsecured.pdf")
    secured_path = os.path.join(temp_dir, "secured.pdf")
    create_dummy_pdf(pdf_path, num_pages=2)
    
    # Restrict editing, copying, and require open password "pass123"
    res = SecurityService.add_security(
        pdf_path, secured_path,
        user_password="pass123",
        owner_password="ownerpass123",
        allow_copying=False,
        allow_editing=False,
        allow_printing=True
    )
    assert os.path.exists(secured_path)
    
    # Try checking security without password
    sec_info = SecurityService.check_security(secured_path)
    assert sec_info["is_encrypted"] is True
    assert sec_info["needs_password"] is True
    assert sec_info["is_unlocked"] is False # locked because we didn't open with user password
    
    # Now check removing security with incorrect password (should fail)
    with pytest.raises(Exception, match="Invalid password"):
        SecurityService.remove_security(secured_path, os.path.join(temp_dir, "unlocked_fail.pdf"), password="wrong")
        
    # Remove security with correct password
    unlocked_path = os.path.join(temp_dir, "unlocked.pdf")
    unlocked_res = SecurityService.remove_security(secured_path, unlocked_path, password="pass123")
    assert unlocked_res["security_removed"] is True
    
    # Verify unlocked is clean
    sec_unlocked = SecurityService.check_security(unlocked_path)
    assert sec_unlocked["is_encrypted"] is False
    assert sec_unlocked["is_unlocked"] is True

def test_change_password(temp_dir, create_dummy_pdf):
    pdf_path = os.path.join(temp_dir, "source.pdf")
    out_pdf = os.path.join(temp_dir, "changed_pass.pdf")
    create_dummy_pdf(pdf_path, num_pages=2, encrypt_password="old_password")
    
    # Change password
    success = SecurityService.change_password(
        pdf_path, out_pdf,
        current_password="old_password",
        new_user_password="new_password",
        new_owner_password="new_owner_password"
    )
    assert success["password_changed"] is True
    assert os.path.exists(out_pdf)
    
    # Try opening with old password (should fail)
    with pytest.raises(Exception, match="Invalid password"):
        SecurityService.remove_security(out_pdf, os.path.join(temp_dir, "unlocked_fail.pdf"), password="old_password")
        
    # Try opening with new password (should succeed)
    res = SecurityService.remove_security(out_pdf, os.path.join(temp_dir, "unlocked_success.pdf"), password="new_password")
    assert res["security_removed"] is True
