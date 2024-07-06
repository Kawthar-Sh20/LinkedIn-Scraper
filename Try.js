const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config({ path: './login.env' });

const scraper = async (jobTitle) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const username = process.env.LINKEDIN_USERNAME;
  const password = process.env.LINKEDIN_PASSWORD;
  ////debug
  console.log("Username:", username);
  console.log("Password:", password);
  ////
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

/////debug
if (typeof username !== 'string' || typeof password !== 'string') {
  console.error("Username and Password must be strings.");
  await browser.close();
  return;
}
//////
  await page.type("#username", username, { delay: 100 });
  await page.type("#password", password, { delay: 100 });
  await page.click(".btn__primary--large");

  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
  } catch (e) {
    console.log("Login navigation timeout:", e);
  }

  ////
  const currentUrl = page.url();
  if (currentUrl.includes("checkpoint")) {
    console.error(
      "LinkedIn is asking for additional verification. Manual login is required."
    );
    await browser.close();
    return;
  }
  ////
  const encodedJobTitle = encodeURIComponent(jobTitle);
 
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodedJobTitle};`
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  
  try {
    await page.waitForSelector(".job-card-container", { timeout: 120000 });
  } catch (e) {
    console.log("Job search page timeout:", e);
    await browser.close();
    return;
  }


  const jobs = await page.evaluate(() => {
    const jobCards = Array.from(
      document.querySelectorAll(".job-card-container")
    );
    return jobCards.map((card) => {
      const jobLink = card.querySelector("a.job-card-list__title");
      const jobPage = jobLink ? jobLink.href : "";
      return {
        title: card.querySelector(".job-card-list__title")?.innerText.trim(),
        company: card
          .querySelector(".job-card-container__company-name")
          ?.innerText.trim(),
        location: card
          .querySelector(".job-card-container__metadata-item")
          ?.innerText.trim(),
        description: card
          .querySelector(".job-card-container__description")
          ?.innerText.trim(),
        datePosted: card
          .querySelector(".job-card-container__footer-job-state")
          ?.innerText.trim(),
        skills: Array.from(
          card.querySelectorAll(".app-aware-link")
        ).map((skill) => skill.innerText.trim()), 
        link: jobPage,
      };
    });
  });
  fs.writeFile("linkedin_jobs.json", JSON.stringify(jobs, null, 2), (err) => {
    if (err) {
      console.error("Error writing JSON to file:", err);
    } else {
      console.log("Job data saved successfully.", jobs);
    }
  });

  await browser.close();
};

scraper("mlOps");