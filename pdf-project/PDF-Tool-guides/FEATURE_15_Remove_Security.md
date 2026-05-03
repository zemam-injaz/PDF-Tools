# Feature 15: Remove Security

## 📋 Overview

Remove password protection and restrictions from PDF files to enable editing, printing, and copying.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `PDFSecurityRemovalTab` (lines 11375-11558)
- **Methods**: `remove_security()` (line 4600)

## 🔌 Required Backend API Endpoints

### 1. Check PDF Security

**Endpoint**: `GET /api/security/check`

**Query Parameters**: `pdf_path`

**Response**:
```json
{
  "success": true,
  "data": {
    "is_encrypted": true,
    "has_user_password": false,
    "has_owner_password": true,
    "restrictions": {
      "printing": false,
      "copying": false,
      "editing": false,
      "annotations": true
    }
  }
}
```

### 2. Remove Security

**Endpoint**: `POST /api/security/remove`

**Request**:
```json
{
  "pdf_path": "C:/protected.pdf",
  "output_path": "C:/unprotected.pdf",
  "password": ""
}
```

**Response**:
```json
{
  "success": true,
  "message": "Security removed successfully",
  "restrictions_removed": ["printing", "copying", "editing"]
}
```

### 3. Unlock with Password

**Endpoint**: `POST /api/security/unlock`

**Request**:
```json
{
  "pdf_path": "C:/protected.pdf",
  "output_path": "C:/unlocked.pdf",
  "password": "user_password"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PDF unlocked successfully"
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Remove PDF Security                                         │
│  [Select PDF]                                                │
│  File: C:/Users/Documents/protected.pdf                     │
├─────────────────────────────────────────────────────────────┤
│  Security Status:                                            │
│  🔒 This PDF is protected                                   │
│                                                               │
│  Restrictions:                                               │
│  ❌ Printing: Disabled                                       │
│  ❌ Copying: Disabled                                        │
│  ❌ Editing: Disabled                                        │
│  ✅ Annotations: Enabled                                     │
│                                                               │
│  Password (if required): [__________]                        │
│                                                               │
│  Output: [C:/unprotected.pdf] [Browse]                      │
│  [Remove Security]                                           │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Note: This tool removes restrictions from PDFs you own. │
│  Do not use it to bypass copyright protection.              │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **FileSelector**: PDF file picker
2. **SecurityStatus**: Display encryption and restrictions
3. **PasswordInput**: Password field (if needed)
4. **OutputSelector**: Output file path
5. **RemoveButton**: Execute security removal
6. **WarningMessage**: Legal disclaimer

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Remove Security" | "إزالة الحماية" |
| "Security Status" | "حالة الحماية" |
| "Protected" | "محمي" |
| "Unprotected" | "غير محمي" |
| "Restrictions" | "القيود" |
| "Printing" | "الطباعة" |
| "Copying" | "النسخ" |
| "Editing" | "التحرير" |
| "Annotations" | "التعليقات" |
| "Password" | "كلمة المرور" |
| "Enabled" | "مفعّل" |
| "Disabled" | "معطّل" |

## ✅ Testing Checklist

- [ ] Check PDF security status
- [ ] Display restrictions correctly
- [ ] Remove security from unprotected PDF
- [ ] Remove security from owner-protected PDF
- [ ] Unlock user-protected PDF with password
- [ ] Handle incorrect password
- [ ] Verify all restrictions removed
- [ ] Test printing after removal
- [ ] Test copying after removal
- [ ] Test editing after removal

---

**Next Feature**: [FEATURE_16_Comments_Annotations.md](./FEATURE_16_Comments_Annotations.md)

