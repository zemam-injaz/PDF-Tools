"""Enhanced Security Service - Check, Remove, and Add PDF Security"""
import os
from typing import Dict, Any, Optional
import fitz  # pymupdf


class SecurityService:
    """Comprehensive security operations for PDF files"""

    # PyMuPDF permission flags
    PERMISSION_FLAGS = {
        "printing": fitz.PDF_PERM_PRINT,
        "high_res_print": fitz.PDF_PERM_PRINT,  # Same in PyMuPDF
        "copying": fitz.PDF_PERM_COPY,
        "editing": fitz.PDF_PERM_MODIFY,
        "annotations": fitz.PDF_PERM_ANNOTATE,
        "form_fill": fitz.PDF_PERM_FORM,
        "accessibility": fitz.PDF_PERM_ACCESSIBILITY,
        "assemble": fitz.PDF_PERM_ASSEMBLE,
    }

    @staticmethod
    def check_security(pdf_path: str) -> Dict[str, Any]:
        """
        Check comprehensive security status of PDF.
        
        Returns detailed information about encryption, password requirements,
        and permission restrictions.
        """
        try:
            doc = fitz.open(pdf_path)

            is_encrypted = doc.is_encrypted
            needs_password = bool(doc.needs_pass)
            is_unlocked = not needs_password

            # Get metadata even if encrypted (if not accessible, metadata is None)
            doc_metadata = doc.metadata or {}
            metadata = {
                "title": doc_metadata.get("title", ""),
                "author": doc_metadata.get("author", ""),
                "creator": doc_metadata.get("creator", ""),
                "producer": doc_metadata.get("producer", ""),
                "page_count": doc.page_count
            }

            # Check permissions (only meaningful if document is encrypted)
            permissions = {}
            restrictions = []
            
            if is_encrypted:
                perm_value = doc.permissions
                for name, flag in SecurityService.PERMISSION_FLAGS.items():
                    allowed = (perm_value & flag) > 0
                    permissions[name] = allowed
                    if not allowed:
                        restrictions.append(name)
            else:
                # No encryption means all permissions
                for name in SecurityService.PERMISSION_FLAGS.keys():
                    permissions[name] = True

            doc.close()

            # Determine security level
            if not is_encrypted:
                security_level = "none"
                security_description = "No security applied"
            elif needs_password:
                security_level = "high"
                security_description = "Password protected (requires password to open)"
            elif restrictions:
                security_level = "medium"
                security_description = f"Restrictions applied: {', '.join(restrictions)}"
            else:
                security_level = "low"
                security_description = "Encrypted but no restrictions"

            return {
                "is_encrypted": is_encrypted,
                "needs_password": needs_password,
                "is_unlocked": is_unlocked,
                "security_level": security_level,
                "security_description": security_description,
                "permissions": permissions,
                "restrictions": restrictions,
                "metadata": metadata
            }
        except fitz.PasswordNeeded:
            return {
                "is_encrypted": True,
                "needs_password": True,
                "is_unlocked": False,
                "security_level": "high",
                "security_description": "Password required to open document",
                "permissions": {},
                "restrictions": ["all"],
                "metadata": {}
            }
        except Exception as e:
            raise Exception(f"Security check failed: {str(e)}")

    @staticmethod
    def remove_security(pdf_path: str, output_path: str, 
                        password: Optional[str] = None) -> Dict[str, Any]:
        """
        Remove all security from PDF.
        
        Args:
            pdf_path: Source PDF
            output_path: Output unsecured PDF
            password: Password if required to open
        """
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            # Try to open with password if provided
            doc = fitz.open(pdf_path)
            
            was_encrypted = doc.is_encrypted
            needed_password = doc.needs_pass

            if needed_password:
                if password:
                    success = doc.authenticate(password)
                    if not success:
                        doc.close()
                        raise Exception("Invalid password provided")
                else:
                    doc.close()
                    raise Exception("PDF requires a password to unlock")

            # Save without encryption
            doc.save(output_path, encryption=fitz.PDF_ENCRYPT_NONE)
            doc.close()

            return {
                "was_encrypted": was_encrypted,
                "security_removed": True,
                "output_path": output_path
            }
        except Exception as e:
            raise Exception(f"Remove security failed: {str(e)}")

    @staticmethod
    def add_security(pdf_path: str, output_path: str,
                     user_password: str = "",
                     owner_password: str = "",
                     allow_printing: bool = True,
                     allow_copying: bool = True,
                     allow_editing: bool = False,
                     allow_annotations: bool = True,
                     encryption_method: str = "AES-256") -> Dict[str, Any]:
        """
        Add security/encryption to PDF.
        
        Args:
            pdf_path: Source PDF
            output_path: Output secured PDF
            user_password: Password required to open (empty = no open password)
            owner_password: Password for full access/modifications
            allow_printing: Allow document printing
            allow_copying: Allow text/image copying
            allow_editing: Allow content modifications
            allow_annotations: Allow adding annotations
            encryption_method: AES-256, AES-128, or RC4-128
        """
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            doc = fitz.open(pdf_path)
            perm = 0
            if allow_printing:
                perm |= fitz.PDF_PERM_PRINT
            if allow_copying:
                perm |= fitz.PDF_PERM_COPY
            if allow_editing:
                perm |= fitz.PDF_PERM_MODIFY
            if allow_annotations:
                perm |= fitz.PDF_PERM_ANNOTATE
            # Add accessibility by default
            perm |= fitz.PDF_PERM_ACCESSIBILITY

            # Select encryption method
            encrypt_map = {
                "AES-256": fitz.PDF_ENCRYPT_AES_256,
                "AES-128": fitz.PDF_ENCRYPT_AES_128,
                "RC4-128": fitz.PDF_ENCRYPT_RC4_128,
            }
            encrypt_method = encrypt_map.get(encryption_method, fitz.PDF_ENCRYPT_AES_256)

            # Ensure owner password is set if user password is set
            if user_password and not owner_password:
                owner_password = user_password + "_owner"

            doc.save(
                output_path,
                encryption=encrypt_method,
                owner_pw=owner_password,
                user_pw=user_password,
                permissions=perm
            )
            doc.close()

            return {
                "security_added": True,
                "has_open_password": bool(user_password),
                "encryption_method": encryption_method,
                "permissions": {
                    "printing": allow_printing,
                    "copying": allow_copying,
                    "editing": allow_editing,
                    "annotations": allow_annotations
                },
                "output_path": output_path
            }
        except Exception as e:
            raise Exception(f"Add security failed: {str(e)}")

    @staticmethod
    def unlock_pdf(pdf_path: str, output_path: str, password: str) -> Dict[str, Any]:
        """
        Unlock PDF with password and save as unencrypted.
        Same as remove_security but specifically for password-protected PDFs.
        """
        return SecurityService.remove_security(pdf_path, output_path, password)

    @staticmethod
    def change_password(pdf_path: str, output_path: str,
                        current_password: str,
                        new_user_password: str = "",
                        new_owner_password: str = "") -> Dict[str, Any]:
        """
        Change passwords on encrypted PDF.
        
        Args:
            pdf_path: Source PDF
            output_path: Output PDF with new passwords
            current_password: Current owner or user password
            new_user_password: New user/open password (empty to remove)
            new_owner_password: New owner password
        """
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            doc = fitz.open(pdf_path)

            if doc.needs_pass:
                success = doc.authenticate(current_password)
                if not success:
                    doc.close()
                    raise Exception("Invalid current password")

            # Get current permissions if encrypted
            if doc.is_encrypted:
                perm = doc.permissions
            else:
                perm = -1  # All permissions

            if new_owner_password or new_user_password:
                # Save with new password(s)
                doc.save(
                    output_path,
                    encryption=fitz.PDF_ENCRYPT_AES_256,
                    owner_pw=new_owner_password or new_user_password + "_owner",
                    user_pw=new_user_password,
                    permissions=perm
                )
            else:
                # Remove all passwords
                doc.save(output_path, encryption=fitz.PDF_ENCRYPT_NONE)

            doc.close()
            return {
                "password_changed": True,
                "has_new_user_password": bool(new_user_password),
                "has_new_owner_password": bool(new_owner_password)
            }
        except Exception as e:
            raise Exception(f"Change password failed: {str(e)}")
