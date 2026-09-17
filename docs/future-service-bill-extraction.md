# Future Project: Auto-extract data from service bills & dealer records

**Status:** Pinned for later (post-2.2) · Quota / Super Admin flags scaffolded · No extraction UI yet

---

## Goal

When a user uploads a service bill or dealer record (PDF or photo), offer an **optional** “Extract data” action that decipheres the document and pre-fills a **draft maintenance log** for review/edit. Never auto-create logs.

---

## Decisions (locked in for when we build)

| Item | Decision |
|------|----------|
| **Scope** | Equipment and vehicles |
| **Inputs** | PDFs and photos (paper receipts, screenshots) |
| **Extract** | Full list of items (line items, parts, labor, totals, next service, etc.) |
| **Equipment linking** | When model/serial (or VIN) is detected, suggest linking to existing equipment; user confirms |
| **Optional** | Extraction is optional (user chooses “Extract from this”); Pro feature with monthly quota |
| **Processing** | Backend only (no client-side AI; our server calls the extraction API) |
| **Trust** | Always show extracted data as a draft; user must review/edit before saving |
| **Dealers** | No dealer APIs assumed. Checked: AHW LLC, Sloan Implement — customer portals only, no public API. Extraction from uploads only. |
| **Pipeline** | Single pipeline first (one vendor); keep schema simple |
| **Quota** | Default **25 extractions / farm / month**. Super Admin can set `_extractionQuotaExempt` so a farm may go past that when they ask. |

---

## ChatGPT Plus vs OpenAI API vs Google Document AI

**ChatGPT Plus (consumer subscription) cannot power the app.**

- Plus is a personal ChatGPT.com plan. It does **not** give you a production API key or allow the FarmGuard backend to call OpenAI on behalf of users.
- For the app you need an **OpenAI API account** (pay-as-you-go billing, separate from Plus). Same models (e.g. GPT-4o vision) are available there.

| Option | How we implement | Pros | Cons |
|--------|------------------|------|------|
| **OpenAI API (vision)** | Backend tRPC sends image/PDF URL or bytes → Responses/Chat Completions with vision → JSON schema for draft | Flexible on messy dealer layouts/photos | Variable cost; need API key in server env |
| **Google Document AI / AWS Textract** | Backend sends file → invoice/expense processor → map fields to our schema | Predictable invoice parsing, often cheaper per page | Weaker on odd photos / custom dealer forms |
| **Anthropic Claude vision** | Same pattern as OpenAI | Strong document reasoning | Separate vendor/billing |

**Recommendation:** Start with **OpenAI API vision** (or Claude) for flexibility on farm paperwork; keep a single internal “extracted service record” schema so you can swap to Document AI later without changing the app UI.

**Env:** `OPENAI_API_KEY` (or Document AI credentials) on the **backend only** — never ship Plus session cookies or personal ChatGPT credentials in the app.

---

## Who pays / quota

1. Pro entitlement required to extract.
2. Included quota: **25 / farm / month** (server-tracked).
3. After quota: block with clear message, *unless* farm has `_extractionQuotaExempt === true` (Super Admin toggle in Debug tab — already scaffolded).
4. Optional later: RevenueCat consumable pack to buy more extracts.

Super Admin Usage tab (existing) can show extraction event counts once `trackUsage` events are wired for `bill_extract`.

---

## Technical outline (when we implement)

- **Flow:** User uploads attachment → optional “Extract from this” → backend receives file/URL → calls one extraction API → returns structured draft → user reviews/edits → save as maintenance log.
- **Schema:** date, dealer name, description, total, line items array, model/serial/VIN, next service text; map vendor output to this.
- **Quota check:** before calling vendor, read month count + `getFarmExtractionQuotaExemptFromDb`; if over 25 and not exempt → TRPC error.
- **Equipment matching:** model/serial → suggest link; user confirms.
- **Storage:** Keep raw extracted JSON + provider name for debugging.

---

## References

- Conversation/planning: Feb 2025; updated Sep 2026 for 2.2 quota flag + OpenAI vs Plus clarification.
- Dealers checked: AHW LLC, Sloan Implement — no public APIs.
