# Backlog

This is a prioritized project backlog, not a claim that all items are approved for immediate implementation. Follow the user's request and [WORKFLOW.md](WORKFLOW.md) when selecting work.

## P0 — Reader and comments enhancements

Track implementation and acceptance criteria in [REVIEW_ENHANCEMENTS_PLAN.md](REVIEW_ENHANCEMENTS_PLAN.md).

- [ ] Render visible PDF pages plus a small buffer instead of mounting the entire document.
- [ ] Add direct page navigation, fit-width/fit-page, and continuous/single/two-page layouts.
- [ ] Preserve page position when zoom or layout changes; persist last-read location and reader preferences.
- [ ] Ensure text selection/copy works when annotation tools are inactive.
- [ ] Add synchronized thumbnail and document-bookmark navigation.
- [ ] Add passage selection, highlight/underline/note, and a navigable comments panel.
- [ ] Add stable passage anchors and backwards-compatible persistence.
- [ ] Export portable PDF-native annotations while retaining an explicit flattened export option where supported.
- [ ] Check RTL layout, Arabic selection order, keyboard navigation, and save/error states.

## P1 — Existing product roadmap

These items are gathered from existing planning documents and need current product prioritization before implementation:

- [ ] Batch processing.
- [ ] Native/local OCR options and improved Arabic OCR workflow.
- [ ] PDF to Word/Excel/CSV conversion improvements.
- [ ] PDF form filling and form creation.
- [ ] Digital signatures.
- [ ] PDF comparison.
- [ ] Table of contents generation and improved document navigation.
- [ ] Additional page operations and editing tools (crop, reverse, blank page, headers/footers).

## Backlog maintenance

- Add a concise item with a user outcome and acceptance criteria.
- Link multi-step work to a plan document.
- Move completed items out of active sections and summarize them in [STATUS.md](STATUS.md).
- Avoid duplicating implementation details across this file and the detailed plan.
