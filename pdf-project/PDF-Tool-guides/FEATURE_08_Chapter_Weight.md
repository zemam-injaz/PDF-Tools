# Feature 08: Chapter Weight Analyzer

## 📋 Overview

Analyze chapter lengths (weights) based on bookmarks and generate reading plans based on available time.

## 📂 Current Python Code Location

- **File**: `src/chapter_weight_visualizer_tab.py` (complete file)
- **File**: `src/chapter_weight_analyzer.py` (core logic)
- **Methods**: `load_bookmarks()`, `analyze_chapter_weights()`, `generate_reading_plan()`

## 🔌 Required Backend API Endpoints

### 1. Analyze Chapter Weights

**Endpoint**: `POST /api/chapter-weight/analyze`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "chapters": [
      {
        "title": "Chapter 1",
        "start_page": 1,
        "end_page": 25,
        "page_count": 25,
        "percentage": 25.0
      },
      {
        "title": "Chapter 2",
        "start_page": 26,
        "end_page": 50,
        "page_count": 25,
        "percentage": 25.0
      }
    ],
    "total_pages": 100,
    "total_chapters": 4
  }
}
```

### 2. Generate Reading Plan

**Endpoint**: `POST /api/chapter-weight/reading-plan`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "available_days": 30,
  "pages_per_day": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "plan": [
      {
        "day": 1,
        "chapter": "Chapter 1",
        "pages": "1-10",
        "page_count": 10
      },
      {
        "day": 2,
        "chapter": "Chapter 1",
        "pages": "11-20",
        "page_count": 10
      }
    ],
    "total_days": 10,
    "completion_date": "2025-11-10"
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Select PDF] [Analyze]                                     │
├─────────────────────────────────────────────────────────────┤
│  Chapter Weight Distribution:                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Chapter 1 ▓▓▓▓▓▓▓▓▓▓ 25% (25 pages)                │    │
│  │ Chapter 2 ▓▓▓▓▓▓▓▓▓▓ 25% (25 pages)                │    │
│  │ Chapter 3 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 30% (30 pages)           │    │
│  │ Chapter 4 ▓▓▓▓▓▓▓▓ 20% (20 pages)                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Reading Plan Generator:                                     │
│  Available Days: [30] Pages per Day: [10]                   │
│  [Generate Plan]                                             │
│                                                               │
│  Reading Plan:                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Day 1: Chapter 1 (Pages 1-10)                       │    │
│  │ Day 2: Chapter 1 (Pages 11-20)                      │    │
│  │ Day 3: Chapter 1 (Pages 21-25), Chapter 2 (1-5)    │    │
│  └─────────────────────────────────────────────────────┘    │
│  [Export Plan]                                               │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **ChapterWeightChart**: Bar chart showing chapter distribution
2. **ReadingPlanForm**: Input for days and pages per day
3. **ReadingPlanDisplay**: Table showing daily reading schedule
4. **ExportButton**: Export plan to PDF/TXT

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Chapter Weight" | "وزن الفصول" |
| "Analyze" | "تحليل" |
| "Reading Plan" | "خطة القراءة" |
| "Available Days" | "الأيام المتاحة" |
| "Pages per Day" | "صفحات يومياً" |
| "Generate Plan" | "إنشاء خطة" |
| "Export Plan" | "تصدير الخطة" |
| "Day" | "اليوم" |
| "Chapter" | "الفصل" |
| "Pages" | "الصفحات" |

## ✅ Testing Checklist

- [ ] Analyze chapter weights
- [ ] Display chapter distribution chart
- [ ] Generate reading plan
- [ ] Adjust days and pages per day
- [ ] Export reading plan
- [ ] Handle PDFs with no bookmarks
- [ ] Handle uneven chapter lengths

---

**Next Feature**: [FEATURE_09_Page_Operations.md](./FEATURE_09_Page_Operations.md)

