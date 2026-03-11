# Biblioteca — Automated Library Cataloguing

> A Playwright-powered automation script that bulk-registers digitised periodical records into the [e-acad.biblacad.ro](https://e-acad.biblacad.ro) academic library catalogue — handling bibliographic data entry, cover image uploads, and PDF attachment in one unattended run.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Excel Data Format](#excel-data-format)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Script](#running-the-script)
- [Progress Tracking & Crash Recovery](#progress-tracking--crash-recovery)
- [Tech Stack](#tech-stack)

---

## Overview

Manually entering hundreds of digitised newspaper issues into an online library catalogue is tedious and error-prone. This project automates the entire process:

1. Reads a structured Excel spreadsheet containing bibliographic metadata for each issue.
2. Logs into the catalogue system once.
3. For every pending row, opens a new browser tab, fills in all required fields, uploads the cover image and PDF file, and saves the record.
4. Writes the result (`OK` or an error message) back to the spreadsheet immediately — so the run is fully resumable after any interruption.

The initial use-case is the digitisation of the *Argus* newspaper (1923), but the script is structured to accommodate any periodical series.

---

## How It Works

```
exemplare.xlsx  ──►  script.spec.ts  ──►  e-acad.biblacad.ro
  (metadata)          (Playwright)          (catalogue UI)
       ▲                                          │
       └──────────── status written back ◄────────┘
```

### Step-by-step flow

| Step | What happens |
|------|-------------|
| **1. Read** | The script reads `data/exemplare.xlsx` and filters rows where `status` is not `OK` and both `luna` (month) and `zi` (day) are filled in. |
| **2. Login** | A single login session is established at the start; all records share the same authenticated context. |
| **3. Per-record loop** | For each pending row a new browser tab is opened via the *"Adaugă înregistrare nouă"* link. |
| **4. Bibliographic fields** | The script fills in: publication year/month/day, title, material type, subtitle, issue numbering, place of publication, publisher, frequency, optional notes, and subject headings (vedete de intrare). |
| **5. Multimedia** | Switches to the multimedia tab, uploads the cover image, then attaches the PDF with its title, description, and tags. |
| **6. Save & confirm** | Clicks Save, handles any duplicate-warning popup, and confirms the success dialog. |
| **7. Status update** | Writes `OK` to the row's `status` cell instantly. On any error, writes `EROARE: <message>` and continues with the next record. |

### String construction

The PDF filename encodes all key metadata using the convention:

```
ARGUS_14_1923_3133.pdf
  │     │   │    └── issue number
  │     │   └──────── year (Arabic)
  │     └──────────── volume / year (Arabic, converted to Roman for display)
  └────────────────── publication title
```

From this single filename the script derives the full bibliographic strings required by the catalogue's form fields.

---

## Project Structure

```
Biblioteca/
├── tests/
│   └── script.spec.ts      # Main automation script
├── data/
│   └── exemplare.xlsx      # Source spreadsheet (tracked in git)
├── public/
│   └── <year>/             # PDF files and cover images, organised by year
│       ├── ARGUS_14_1923_3133.pdf
│       ├── ARGUS_14_1923_3133.jpg
│       └── ...
├── credentials.json        # Login credentials — NOT committed to git
├── playwright.config.js    # Playwright configuration
├── package.json
└── README.md
```

---

## Excel Data Format

The spreadsheet `data/exemplare.xlsx` must contain the following columns (order does not matter, names must match exactly):

| Column | Type | Description |
|--------|------|-------------|
| `luna` | Number (1–12) | Publication month |
| `zi` | Number | Publication day |
| `material_general` | String | General material designator |
| `alte_informatii_titlu` | String | Other title information / subtitle |
| `locul_publicarii` | String | Place of publication |
| `edituri` | String | Publisher name |
| `frecventa` | String | Publication frequency |
| `Nota` | String | Optional note (field 300) |
| `vedeta_intrare` | String | Subject headings, comma-separated (e.g. `Economie,Politică,Finanțe`) |
| `fisier_coperta` | String | Absolute or relative path to the cover image file |
| `fisier_pdf` | String | Absolute or relative path to the PDF file |
| `descriere` | String | Description text for the multimedia record |
| `taguri` | String | Tags for the multimedia record |
| `j-cota` | String | Shelf mark / call number |
| `status` | String | Managed by the script: empty = pending, `OK` = done, `EROARE: ...` = failed |

> **Important:** Rows where `luna` or `zi` are empty are automatically skipped. This allows you to prepare data incrementally and run the script safely at any point.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | 18 or later |
| npm | Bundled with Node.js |
| A Chromium-compatible browser | Installed automatically by Playwright |
| Access credentials for e-acad.biblacad.ro | Required |

---

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/Biblioteca.git
cd Biblioteca
```

**2. Install dependencies**

```bash
npm install
```

**3. Install Playwright browsers**

```bash
npx playwright install chromium
```

---

## Configuration

Create a `credentials.json` file in the project root. This file is listed in `.gitignore` and will never be committed.

```json
{
  "utilizator": "your_username",
  "parola": "your_password"
}
```

Ensure your PDF files and cover images are placed under `public/<year>/` and that the paths in the `fisier_pdf` and `fisier_coperta` columns of the spreadsheet point to them correctly.

---

## Running the Script

**Standard run (headless — no browser window)**

```bash
npm test
```

**With a visible browser window** — useful for debugging or demonstration

```bash
npx playwright test --headed
```

**Run a specific file**

```bash
npx playwright test tests/script.spec.ts
```

**View the HTML run report** — generated automatically after each run

```bash
npx playwright show-report
```

---

## Progress Tracking & Crash Recovery

The script is designed to be **safe to interrupt and resume at any time**:

- After each successful record, `OK` is written to the `status` column and the file is saved to disk immediately.
- If the script crashes or is stopped, simply run it again — already-processed rows are skipped automatically.
- Failed rows are marked `EROARE: <reason>` and are retried on the next run.
- Rows with missing `luna` or `zi` data are silently skipped without modifying their status.

---

## Tech Stack

| Technology | Role |
|------------|------|
| [TypeScript](https://www.typescriptlang.org/) | Type-safe scripting language |
| [Playwright](https://playwright.dev/) `^1.58` | Browser automation framework |
| [SheetJS / xlsx](https://sheetjs.com/) `^0.18` | Reading and writing `.xlsx` files |
| [Node.js](https://nodejs.org/) | Runtime environment |
| Chromium | Headless browser used for automation |

---

*Built to save hours of manual data entry and ensure consistent, accurate cataloguing of digitised cultural heritage materials.*
