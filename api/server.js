const express = require('express');
const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

const app = express();
const port = 3000;

app.use(express.json());

app.get('/api/scrape', async (req, res) => {
  const { url, intervals, skipCheck } = req.query;

  if (!url || !intervals) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const intervalArray = intervals.split(',').map(Number);
  const fullUrl = `${url}&intervals=${intervals}`;
  console.log(`Received request: url=${fullUrl}, intervals=${intervals}`);

  try {
    const browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(
        `https://github.com/Sparticuz/chromium/releases/download/v132.0.0/chromium-v132.0.0-pack.tar`
      ),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    console.log(`Navigating to: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle0' });

    // Wait for a while to allow the JavaScript to execute and elements to load
    await page.waitForTimeout(55000); // Wait for max 55 seconds

    // Log the HTML content of the page
    const htmlContent = await page.content();
    console.log(htmlContent);

    if (skipCheck === 'true') {
      console.log('Skipping checks as skipCheck is set to true');
      await browser.close();
      return res.json({ message: 'Scraping skipped', results: [] });
    }

    const results = [];
    for (let interval of intervalArray) {
      const result = await page.evaluate((interval) => {
        const elements = Array.from(document.querySelectorAll('body *'));
        const element = elements.find(el => el.innerText.includes(`[*[***]*]Request made at ${interval}s:`));

        if (element) {
          const startIndex = element.innerText.indexOf(`[*[***]*]Request made at ${interval}s:`);
          if (startIndex !== -1) {
            const resultText = element.innerText.substring(startIndex, startIndex + 30);
            return { elementText: resultText, foundElement: true };
          }
        }

        return { elementText: 'null', foundElement: false };
      }, interval);

      // Log result for debugging
      console.log(`Interval: ${interval}, Result: ${JSON.stringify(result)}`);

      results.push({ interval, resultSnippet: result.elementText });
    }

    await browser.close();
    res.json({ message: 'Scraping completed', results });
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
