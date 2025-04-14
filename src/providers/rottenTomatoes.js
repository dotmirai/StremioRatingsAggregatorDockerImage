// Placeholder for Rotten Tomatoes provider
// Scraping Rotten Tomatoes is notoriously difficult due to Cloudflare and
// dynamically loaded content. Their internal/undocumented API changes frequently.

const logger = require('../utils/logger');
const PROVIDER_NAME = 'Rotten Tomatoes';

async function getRating(type, imdbId) {
    logger.debug(`${PROVIDER_NAME}: Provider not implemented.`);
    // Implementation would likely involve:
    // 1. Searching RT using the title/year.
    // 2. Finding the correct movie/show URL.
    // 3. Scraping the target page (Puppeteer often required).
    // 4. Extracting Tomatometer score/count and Audience score/count.
    return null;
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};