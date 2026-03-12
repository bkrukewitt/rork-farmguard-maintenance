# Future Project: Auto-extract data from service bills & dealer records

**Status:** Pinned for later · No implementation yet

---

## Goal

When a user uploads a service bill or dealer record (PDF or photo), offer an **optional** “Extract data” action that deciphers the document and pre-fills a **draft maintenance log** for review/edit. Never auto-create logs.

---

## Decisions (locked in for when we build)

| Item | Decision |
|------|----------|
| **Scope** | Equipment and vehicles |
| **Inputs** | PDFs and photos (paper receipts, screenshots) |
| **Extract** | Full list of items (line items, parts, labor, totals, next service, etc.) |
| **Equipment linking** | When model/serial (or VIN) is detected, suggest linking to existing equipment; user confirms |
| **Optional** | Extraction is optional (user chooses “Extract from this”); consider app-paid with usage cap or premium feature |
| **Processing** | Backend only (no client-side AI; our server calls the extraction API) |
| **Trust** | Always show extracted data as a draft; user must review/edit before saving |
| **Dealers** | No dealer APIs assumed. Checked: AHW LLC, Sloan Implement — customer portals only, no public API. Extraction from uploads only. |
| **Pipeline** | Single pipeline first (one vendor); keep schema simple |

---

## Vendor options (who does the extraction)

All are backend-callable; we send file/URL, get structured data back.

| Vendor | Best for | Typical cost (approx.) |
|--------|----------|-------------------------|
| **Google Document AI** | Standard invoices/receipts | ~$0.01/page |
| **AWS Textract** (Analyze Expense) | Invoices/receipts, tables | ~$0.015/page |
| **Azure Document Intelligence** | Same; good if already on Azure | Same ballpark |
| **OpenAI GPT-4 Vision** | Odd layouts, dealer-specific forms, photos | ~$0.01–0.05 per doc |
| **Anthropic Claude (vision)** | Same as above; alternative | Similar |

**Suggestion:** Start with one — either a Document AI (Google/AWS) for standard invoices, or one LLM-with-vision for maximum flexibility.

---

## Who pays for extraction (options)

1. **App absorbs cost** — user gets “Extract from this” at no extra charge; we pay the API.
2. **Usage cap** — e.g. X free extractions per farm/month, then stop or upgrade.
3. **Premium feature** — extraction only in a paid tier.
4. **Per-use fee** — user pays per extraction (more friction).

**Suggestion:** Start with app-paid + soft cap (e.g. 50–100 extractions per farm/month), then add premium or cap if needed.

---

## Technical outline (when we implement)

- **Flow:** User uploads attachment → optional “Extract from this” → backend receives file/URL → calls one extraction API → returns structured draft (date, dealer, line items, total, suggested equipment) → user reviews/edits → save as maintenance log.
- **Schema:** One simple “extracted service record” (date, dealer name, description, total, line items array, model/serial/VIN, next service text); map all vendor output to this.
- **Equipment matching:** Use extracted model/serial/VIN to search existing equipment; suggest “Link to [Unit X]?”; user confirms.
- **Storage:** Keep raw extracted JSON + provider name for debugging and improving prompts/parsers.

---

## References

- Conversation/planning: Feb 2025 (this doc).
- Dealers checked: AHW LLC (ahwllc.com, AHW Online portal), Sloan Implement (sloans.com, Sloan app + John Deere app); no public APIs.
