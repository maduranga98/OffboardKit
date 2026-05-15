const { join } = require("path");

/**
 * Store the downloaded Chromium inside the functions directory so it is
 * uploaded with the deploy bundle. Without this, Cloud Functions cannot
 * find the browser at runtime and PDF generation fails.
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
