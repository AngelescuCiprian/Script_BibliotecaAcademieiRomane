import { test, expect } from '@playwright/test';

test('test', async ({ page, context }) => {
  test.setTimeout(120000);
  await page.goto('https://e-acad.biblacad.ro/logon');
  await page.getByRole('textbox', { name: 'Nume utilizator' }).fill('student1');
  await page.getByRole('textbox', { name: 'Parolă' }).fill('12345');
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await page.waitForLoadState('networkidle');

  for (let i = 0; i < 2; i++) {
    console.log(`\n--- Iteratia ${i + 1}/2 ---`);
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Adaugă înregistrare nouă' }).click()
    ]);

    
    await newPage.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await newPage.getByRole('link', { name: 'Selectează' }).click();
    await newPage.waitForTimeout(1000);

    //109
    await newPage.locator("//input[@id='TextField_0']").fill('2024'); //an
    await newPage.locator("//input[@id='TextField_1']").fill('01'); //luna
    await newPage.locator("//input[@id='TextField_2']").fill('23'); //zi

    //200
    await newPage.locator("//input[@id='TextField_4']").fill("Argus"); //titlu
    await newPage.locator("//input[@id='TextField_5']").fill("periodic"); //material general
    await newPage.locator("//input[@id='TextField_6']").fill("organ test zilnic al comerţului, industriei şi finanţei"); //alte informatii la titlu
    await newPage.locator("//input[@id='TextField_7']").fill("Anul 14, nr. 2922 (17 Ianuarie 1923)") //numarul unei parti

    //207
    await newPage.locator("//img[@id='Any_75']").click();
    await newPage.waitForTimeout(500);
    await newPage.locator("//input[@id='TextField_9']").fill("Anul XIII, No. 2917, 6 Ianuarie 1923"); //Numerotare: specificarea datei şi volumului

    //210
    await newPage.locator("//input[@id='TextField_10']").fill("Bucuresti") //locul publicarii
    await newPage.locator("//input[@id='TextField_11']").fill(`Atelierele "Adevěrul" `) //nume editura
    await newPage.locator("//input[@id='TextField_12']").fill("1923");// data publicarii

    //326
    await newPage.locator("//input[@id='TextField_14']").fill("Zilnic");

    //606
    await newPage.locator("//select[@id='PropertySelection_1_13']").selectOption({ value: '1' });
    await newPage.waitForTimeout(500);
    await newPage.locator("//img[@id='Any_200']").click();
    await newPage.waitForTimeout(500);
    await newPage.locator("//input[@id='TextField_30']").fill("109");
    await newPage.locator("//select[@id='PropertySelection_1_13']").selectOption({ value: '4' });
    await newPage.waitForTimeout(500);
    await newPage.locator("//img[@id='Any_200']").click();
    await newPage.waitForTimeout(500);
    await newPage.locator("//input[@id='TextField_31']").fill("Industrie");
    await newPage.waitForTimeout(500);

    //salvare
    await newPage.locator("//span[@id='Insert_30']").click();

    // Asteapta sa apara popup-ul de duplicate (max 5 secunde)
    const continua = newPage.locator("//a[@id='continueSave']");
    try {
      await continua.waitFor({ state: 'visible', timeout: 5000 });
      await continua.click();
    } catch {
      // Popup-ul nu a aparut, salvarea s-a facut direct
    }
    const ok = newPage.locator("//a[@id='closeMessageDialog']");
    try {
      await ok.waitFor({ state: 'visible', timeout: 5000 });
      await ok.click();
    } catch {
      // Popup-ul OK nu a aparut
    }

    //multimedia
    await newPage.locator("//a[@id='multimediaTab']").click();
    await newPage.waitForTimeout(500);
    await newPage.locator("//a[@id='DirectLink_1_0']").click();//coperta
    await newPage.waitForTimeout(500);
    await newPage.waitForTimeout(1000);

    //upload coperta
    await newPage.locator('#coverUpload').setInputFiles('public/1923/coperti/ARGUS_13_1923_2913_page1.jpg');

    await newPage.locator("//a[@id='DirectLink_2']").click(); //incarca

    await newPage.locator('#fileTypeModel').selectOption('1');

    await newPage.locator('#browse-local-button-html5').waitFor({ state: 'visible', timeout: 10000 });
    await newPage.waitForTimeout(500);
    const [fileChooser] = await Promise.all([
      newPage.waitForEvent('filechooser'),
      newPage.locator('#browse-local-button-html5').click()
    ]);
    await fileChooser.setFiles('public/1923/ARGUS_13_1923_2913.pdf');
    await newPage.locator('#TextField_1').fill('Argus nr. 2913/1923');
    await newPage.locator('#TextArea').fill('Periodic');
    await newPage.locator('#TextField_2').fill('taguri');
    await newPage.getByRole('link', { name: 'Salvează' }).click();

    await newPage.waitForTimeout(2000);
    console.log(`Cartea ${i + 1} salvata cu succes.`);
    await newPage.close();
    await page.waitForTimeout(1000);
  }
});
