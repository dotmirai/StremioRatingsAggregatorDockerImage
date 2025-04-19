// providers/imdbProvider.js
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');

const PROVIDER_NAME = 'IMDb';
const BASE_URL = config.sources.imdbBaseUrl;

/**
 * Scrapes the IMDb page to extract the user rating.
 * @param {string} htmlContent - The HTML content of the page.
 * @param {string} url - The URL scraped (for logging and result).
 * @param {string} imdbId - The IMDb ID (for logging).
 * @returns {object|null} The rating object { source, value, url } or null if not found.
 */
function scrapeIMDbPage(htmlContent, url, imdbId) {
    try {
        const $ = cheerio.load(htmlContent);

        // Selector based on IMDb's current structure for the main rating score
        const ratingSelector = 'div[data-testid="hero-rating-bar__aggregate-rating__score"] > span';
        // Target the first span within the score section
        let ratingText = $(ratingSelector).first().text().trim();

        if (!ratingText) {
            logger.warn(`[${PROVIDER_NAME}] Rating selector ('${ratingSelector}') not found or empty for ${imdbId} at ${url}.`);
            return null;
        }

        // IMDb sometimes includes "/10" directly, sometimes just the number.
        // Also handle potential thousands separators if scraping non-English pages.
        const ratingMatch = ratingText.match(/^(\d+(\.\d+)?)/); // Match starting digits/decimal
        const ratingValue = ratingMatch ? ratingMatch[1] : null;


        if (ratingValue && /^\d+(\.\d+)?$/.test(ratingValue)) {
            // Check if rating is within a reasonable range (0-10)
            const ratingNum = parseFloat(ratingValue);
            if (ratingNum >= 0 && ratingNum <= 10) {
                logger.debug(`[${PROVIDER_NAME}] Found rating ${ratingValue}/10 for ${imdbId}`);
                return {
                    source: PROVIDER_NAME,
                    value: `${ratingValue}/10`, // Standardize format
                    url: url,
                };
            } else {
                logger.warn(`[${PROVIDER_NAME}] Parsed rating ${ratingNum} for ${imdbId} is outside expected 0-10 range.`);
                return null;
            }
        } else {
            logger.warn(`[${PROVIDER_NAME}] Could not parse valid rating number from text "${ratingText}" for ${imdbId} at ${url}`);
            return null;
        }
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Cheerio parsing error for ${imdbId} at ${url}: ${error.message}`);
        return null; // Error during scraping
    }
}


/**
 * Fetches the user rating from IMDb.
 * @param {'movie'|'series'} type - Content type (movie or series).
 * @param {string} imdbId - IMDb ID (e.g., tt1234567 or tt1234567:1:1).
 * @returns {Promise<object|null>} A rating object or null.
 */
async function getRating(type, imdbId) {
    const baseImdbId = imdbId.split(':')[0]; // Use only the base ID (tt1234567)
    if (!BASE_URL) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${baseImdbId}: Base URL not configured.`);
        return null;
    }

    const targetUrl = `${BASE_URL}/title/${baseImdbId}/`;
    logger.debug(`[${PROVIDER_NAME}] Attempting fetch for ${baseImdbId} from ${targetUrl}`);

    // Use shared client, force English page with headers if possible
    const response = await getPage(targetUrl, PROVIDER_NAME, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' }
    });

    if (!response || response.status !== 200) {
        // 404 or other errors logged by getPage
        return null;
    }

    const rating = scrapeIMDbPage(response.data, targetUrl, baseImdbId);

    if (!rating) {
        logger.debug(`[${PROVIDER_NAME}] No rating found via scraping for ${baseImdbId}`);
    }

    return rating;
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};