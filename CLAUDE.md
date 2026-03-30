# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the automation script
npm test
# or directly:
npx playwright test

# Run with headed browser (visible UI)
npx playwright test --headed

# Run a specific test file
npx playwright test tests/script.spec.ts

# View the HTML test report
npx playwright show-report
```

## Architecture

This is a **Playwright-based browser automation** project that bulk-registers library records into the e-acad.biblacad.ro catalog system.

### Data flow

1. **`data/exemplare.xlsx`** — the source of truth. Each row is one record to register. The `status` column tracks progress: empty = pending, `OK` = done, `EROARE: ...` = failed.
2. **`credentials.json`** — login credentials (`{ "utilizator": "...", "parola": "..." }`). Not committed to git.
3. **`public/<year>/`** — PDF files referenced by the `fisier_pdf` column in the Excel sheet. Cover images are referenced by `fisier_coperta`.

### How the script works (`tests/script.spec.ts`)

- Reads `exemplare.xlsx` and filters rows where `status !== 'OK'`
- Logs in once to the catalog web app
- For each pending row, opens a new browser tab via "Adaugă înregistrare nouă" and fills in bibliographic fields (date, title, publisher, subject headings, etc.) using XPath and ARIA locators
- Uploads a cover image and a PDF via the multimedia tab
- On success, writes `OK` back to the Excel file immediately (so progress survives crashes)
- On failure, writes the error message to the `status` cell

### Key details

- `test.setTimeout(0)` — no timeout; the test runs until all rows are processed
- Workers are set to 1 and `fullyParallel: false` — intentional, the script is sequential
- The Excel file is read fresh at the start and updated row-by-row in place after each record
- Field IDs (`TextField_0`, `TextField_1`, etc.) are positional and specific to the target web app's form layout
- `fisier_pdf` filename must follow the pattern `TITLU_anArab_an_nr.ext` (e.g. `ARGUS_14_1923_3133.pdf`); `parseFisierPdf` derives title, year, and issue number from this
- `vedeta_intrare` column holds comma-separated subject headings; the script dynamically clones the 606 field once per heading beyond the first
- Field 300 (Nota) and field 326 (Frecventa) both target `TextField_14` — Nota is filled only when non-empty, then Frecventa unconditionally overwrites it; this reflects the current form layout
- Rows are skipped at startup if `luna` or `zi` is empty (in addition to `status === 'OK'`)
- `playwright.config.js` uses ES module syntax (`import`/`export default`) despite `package.json` having `"type": "commonjs"` — do not change this without testing
