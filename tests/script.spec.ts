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
  an: string;
  luna: string;
  zi: string;
  titlu: string;
  material_general: string;
  alte_informatii_titlu: string;
  numarul_unei_parti: string;
  numerotare_spec_data: string;
  locul_publicarii: string;
  edituri: string;
  data_publicarii: string;
  frecventa: string;
  nr_inregistrare_autoritate: string;
  vedeta_intrare: string;
  fisier_coperta: string;
  fisier_pdf: string;
  denumire_completa: string;
  descriere: string;
  taguri: string;
  status: string;
}

const EXCEL_PATH = path.join(__dirname, '../data/exemplare.xlsx');

function readExcel(): { rows: ExemplarRow[]; workbook: XLSX.WorkBook; sheetName: string } {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExemplarRow>(sheet, { defval: '' });
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
    console.log(`\n--- [${index + 1}/${rows.length}] ${row.denumire_completa} ---`);

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
      await newPage.locator("//input[@id='TextField_0']").fill(row.an);
      await newPage.locator("//input[@id='TextField_1']").fill(row.luna);
      await newPage.locator("//input[@id='TextField_2']").fill(row.zi);

      // 200 - Titlu
      await newPage.locator("//input[@id='TextField_4']").fill(row.titlu);
      await newPage.locator("//input[@id='TextField_5']").fill(row.material_general);
      await newPage.locator("//input[@id='TextField_6']").fill(row.alte_informatii_titlu);
      await newPage.locator("//input[@id='TextField_7']").fill(row.numarul_unei_parti);

      // 207 - Numerotare
      await newPage.locator("//img[@id='Any_75']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator("//input[@id='TextField_9']").fill(row.numerotare_spec_data);

      // 210 - Publicatie
      await newPage.locator("//input[@id='TextField_10']").fill(row.locul_publicarii);
      await newPage.locator("//input[@id='TextField_11']").fill(row.edituri);
      await newPage.locator("//input[@id='TextField_12']").fill(row.data_publicarii);

      // 326 - Frecventa
      await newPage.locator("//input[@id='TextField_14']").fill(row.frecventa);

      // 606 - Subiect
      await newPage.locator("//select[@id='PropertySelection_1_13']").selectOption({ value: '1' });
      await newPage.waitForTimeout(500);
      await newPage.locator("//img[@id='Any_200']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator("//input[@id='TextField_30']").fill(row.nr_inregistrare_autoritate);
      await newPage.locator("//select[@id='PropertySelection_1_13']").selectOption({ value: '4' });
      await newPage.waitForTimeout(500);
      await newPage.locator("//img[@id='Any_200']").click();
      await newPage.waitForTimeout(500);
      await newPage.locator("//input[@id='TextField_31']").fill(row.vedeta_intrare);
      await newPage.waitForTimeout(500);

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
      await newPage.locator('#browse-local-button-html5').waitFor({ state: 'visible', timeout: 10000 });
      await newPage.waitForTimeout(500);
      const [fileChooser] = await Promise.all([
        newPage.waitForEvent('filechooser'),
        newPage.locator('#browse-local-button-html5').click()
      ]);
      await fileChooser.setFiles(row.fisier_pdf);
      await newPage.locator('#TextField_1').fill(row.denumire_completa);
      await newPage.locator('#TextArea').fill(row.descriere);
      await newPage.locator('#TextField_2').fill(row.taguri);
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
