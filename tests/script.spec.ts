import { test } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface Credentials {
  utilizator: string;
  parola: string;
}

const credentials: Credentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../credentials.json'), 'utf-8')
);

interface ExemplarRow {
  luna: string;
  zi: string;
  material_general: string;
  alte_informatii_titlu: string;
  locul_publicarii: string;
  edituri: string;
  frecventa: string;
  Nota: string;
  vedeta_intrare: string;
  fisier_coperta: string;
  fisier_pdf: string;
  descriere: string;
  taguri: string;
  status: string;
  'j-cota': string;
}

function parseFisierPdf(fisierPdf: string): { titlu: string; anArab: number; an: string; nr: string } {
  const basename = path.basename(fisierPdf, path.extname(fisierPdf));
  const parts = basename.split('_');
  return {
    titlu: parts[0].charAt(0) + parts[0].slice(1).toLowerCase(),
    anArab: parseInt(parts[1], 10),
    an: parts[2],
    nr: parts[3],
  };
}

function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

const LUNI = ['', 'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
              'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

const EXCEL_PATH = path.join(__dirname, '../data/exemplare.xlsx');

function readExcel(): { rows: ExemplarRow[]; workbook: XLSX.WorkBook; sheetName: string } {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows = raw.map(r => Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, String(v)])
  )) as unknown as ExemplarRow[];
  return { rows, workbook, sheetName };
}

function updateStatus(workbook: XLSX.WorkBook, sheetName: string, rowIndex: number, status: string): void {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExemplarRow>(sheet, { defval: '' });
  rows[rowIndex].status = status;
  const newSheet = XLSX.utils.json_to_sheet(rows);
  workbook.Sheets[sheetName] = newSheet;
  XLSX.writeFile(workbook, EXCEL_PATH);
}

test('inregistrare exemplare biblioteca', async ({ page, context }) => {
  test.setTimeout(0);

  const { rows, workbook, sheetName } = readExcel();
  const pending = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status !== 'OK');

  console.log(`Total rânduri: ${rows.length} | De procesat: ${pending.length}`);

  if (pending.length === 0) {
    console.log('Toate exemplarele au fost deja înregistrate.');
    return;
  }

  // Login
  await page.goto('https://e-acad.biblacad.ro/logon');
  await page.getByRole('textbox', { name: 'Nume utilizator' }).fill(credentials.utilizator);
  await page.getByRole('textbox', { name: 'Parolă' }).fill(credentials.parola);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await page.waitForLoadState('networkidle');

  for (const { row, index } of pending) {
    const { titlu, anArab, an, nr } = parseFisierPdf(row.fisier_pdf);
    const lunaText = LUNI[parseInt(row.luna, 10)];
    const numarul_unei_parti = `Anul ${anArab}, nr. ${nr} (${row.zi} ${lunaText} ${an})`;
    const numerotare_spec_data = `Anul ${toRoman(anArab)}, No. ${nr}, ${row.zi} ${lunaText} ${an}`;
    const denumire_completa = `${titlu} nr. ${nr}/${an}`;

    console.log(`\n--- [${index + 1}/${rows.length}] ${denumire_completa} ---`);

    try {
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        page.getByRole('link', { name: 'Adaugă înregistrare nouă' }).click()
      ]);

      await newPage.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await newPage.getByRole('link', { name: 'Selectează' }).click();
      await newPage.waitForTimeout(1000);

      // 109 - Data
      await newPage.locator("//input[@id='TextField_0']").fill(an);
      await newPage.locator("//input[@id='TextField_1']").fill(row.luna);
      await newPage.locator("//input[@id='TextField_2']").fill(row.zi);

      // 200 - Titlu
      await newPage.locator("//input[@id='TextField_4']").fill(titlu);
      await newPage.locator("//input[@id='TextField_5']").fill(row.material_general);
      await newPage.locator("//input[@id='TextField_6']").fill(row.alte_informatii_titlu);
      await newPage.locator("//input[@id='TextField_7']").fill(numarul_unei_parti);

      // 207 - Numerotare
      await newPage.locator("//img[@id='Any_75']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator("//input[@id='TextField_9']").fill(numerotare_spec_data);

      // 210 - Publicatie
      await newPage.locator("//input[@id='TextField_10']").fill(row.locul_publicarii);
      await newPage.locator("//input[@id='TextField_11']").fill(row.edituri);
      await newPage.locator("//input[@id='TextField_12']").fill(an);
      
      //300-Nota
      if (row.Nota) {
        await newPage.locator("//img[@id='Any_110']").click();
        await newPage.waitForTimeout(500);
        await newPage.locator("//input[@id='TextField_14']").fill(row.Nota);
      }

      // 326 - Frecventa
      await newPage.locator("//input[@id='TextField_14']").fill(row.frecventa);

      // 606 - Subiect (3 vedete de intrare din coloana vedeta_intrare, separate prin virgula)
      const vedete = row.vedeta_intrare.split(',').map(v => v.trim());

      // Configureaza primul field (deja existent): selecteaza optiunea 4 si adauga subfieldul vedeta_intrare
      await newPage.locator("//select[@id='PropertySelection_1_13']").selectOption({ value: '4' });
      await newPage.waitForTimeout(500);
      await newPage.locator("//img[@id='Any_200']").click();
      await newPage.waitForTimeout(500);

      // Copiaza primul field configurat inca de (vedete.length - 1) ori
      for (let i = 0; i < vedete.length - 1; i++) {
        await newPage.locator("//img[@id='Any_5_10']").click();
        await newPage.waitForTimeout(500);
      }
      // Completeaza cele 3 campuri vedeta_intrare generate
      for (let i = 0; i < vedete.length; i++) {
        await newPage.locator(`//input[@id='TextField_${30 + i}']`).fill(vedete[i]);
        await newPage.waitForTimeout(500);
      }
      
      // j-cota
      await newPage.locator("//input[@id='TextField_47']").fill(row['j-cota']);

      // Salvare
      await newPage.locator("//span[@id='Insert_30']").click();

      // Popup duplicate
      const continua = newPage.locator("//a[@id='continueSave']");
      try {
        await continua.waitFor({ state: 'visible', timeout: 5000 });
        await continua.click();
      } catch {
        // Nu a apărut popup-ul de duplicate
      }

      // Popup OK
      const ok = newPage.locator("//a[@id='closeMessageDialog']");
      try {
        await ok.waitFor({ state: 'visible', timeout: 5000 });
        await ok.click();
      } catch {
        // Nu a apărut popup-ul OK
      }

      // Multimedia - copertă
      await newPage.locator("//a[@id='multimediaTab']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator("//a[@id='DirectLink_1_0']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator('#coverUpload').setInputFiles(row.fisier_coperta);

      // Multimedia - PDF
      await newPage.locator("//a[@id='DirectLink_2']").click();
      await newPage.locator('#fileTypeModel').selectOption('1');
      await newPage.locator("//a[@id='browse-local-button-html5']").waitFor({ state: 'visible', timeout: 10000 });
      await newPage.waitForTimeout(500);
      const [fileChooser] = await Promise.all([
        newPage.waitForEvent('filechooser'),
        newPage.locator("//a[@id='browse-local-button-html5']").click()
      ]);
      await fileChooser.setFiles(row.fisier_pdf);
      await newPage.waitForSelector('span.plural:has-text("file")', { timeout: 60000 });
      await newPage.locator('#TextField_1').fill(denumire_completa);
      await newPage.locator('#TextArea').fill(row.descriere);
      await newPage.locator('#TextField_2').fill(row.taguri);
      await newPage.waitForTimeout(2000)
      await newPage.getByRole('link', { name: 'Salvează' }).click();

      await newPage.waitForTimeout(2000);
      await newPage.close();
      await page.waitForTimeout(1000);

      updateStatus(workbook, sheetName, index, 'OK');
      console.log(`  ✓ Salvat cu succes.`);

    } catch (err) {
      const mesaj = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Eroare: ${mesaj}`);
      updateStatus(workbook, sheetName, index, `EROARE: ${mesaj.slice(0, 100)}`);
    }
  }

  console.log('\nFinalizat!');
});
