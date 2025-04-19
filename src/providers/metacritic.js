// providers/metacriticProvider.js
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'Metacritic';
const BASE_URL = config.sources.metacriticBaseUrl;

/**
 * Generates the Metacritic URL.
 * @param {string} title - Content title.
 * @param {'movie'|'series'} type - Content type.
 * @returns {string|null} The URL or null if data missing.
 */
function getMetacriticUrl(title, type) {
    if (!title || !BASE_URL) return null;

    const mediaType = type === 'series' ? 'tv' : 'movie';
    const formattedTitle = formatTitleForUrlSlug(title);
    if (!formattedTitle) return null;

    return `${BASE_URL}/${mediaType}/${formattedTitle}`;
}

/**
 * Scrapes the Metacritic page for Metascore and User Score.
 * @param {string} htmlContent - HTML content.
 * @param {string} url - Scraped URL.
 * @returns {Array<object>|null} Array of rating objects or null.
 */
function scrapeMetacriticPage(htmlContent, url) {
    try {
        const $ = cheerio.load(htmlContent);
        const ratings = [];

        // --- Metascore (Critics) ---
        // Selectors based on current Metacritic structure (data-testid seems robust)
        const criticScoreSelector = '[data-testid="critic-score-info"] .c-siteReviewScore span';
        const criticCountSelector = '[data-testid="critic-score-info"] .c-productScoreInfo_reviewsTotal span';

        const criticScoreText = $(criticScoreSelector).first().text().trim();
        if (criticScoreText && /^\d+$/.test(criticScoreText)) {
            const criticScore = parseInt(criticScoreText, 10);
            if (criticScore >= 0 && criticScore <= 100) {
                // Extract count (optional)
                const criticCountText = $(criticCountSelector).text().trim();
                const criticCountMatch = criticCountText.match(/Based on (\d+) Critic/i);
                const criticCount = criticCountMatch ? parseInt(criticCountMatch[1], 10) : null;

                logger.debug(`[${PROVIDER_NAME}] Found Metascore ${criticScore}/100` + (criticCount ? ` (${criticCount} critics)` : ''));
                ratings.push({
                    source: 'MC', // Distinguish source
                    type: 'Critics',
                    value: `${criticScore}/100`,
                    count: criticCount, // Optional count
                    url: url
                });
            } else {
                logger.warn(`[${PROVIDER_NAME}] Parsed critic score ${criticScore} is outside 0-100 range at ${url}.`);
            }
        } else if (criticScoreText) {
            logger.warn(`[${PROVIDER_NAME}] Found critic score text "${criticScoreText}" but failed validation at ${url}.`);
        } // If selector not found, it just doesn't push.

        // --- User Score ---
        const userScoreSelector = '[data-testid="user-score-info"] .c-siteReviewScore span';
        const userCountSelector = '[data-testid="user-score-info"] .c-productScoreInfo_reviewsTotal span';

        const userScoreText = $(userScoreSelector).first().text().trim();
        // User score can be 'tbd' or decimal
        if (userScoreText && /^\d+(\.\d+)?$/.test(userScoreText)) {
            const userScore = parseFloat(userScoreText);
            if (userScore >= 0 && userScore <= 10) {
                // Extract count (optional)
                const userCountText = $(userCountSelector).text().trim();
                const userCountMatch = userCountText.match(/Based on (\d+) User/i);
                const userCount = userCountMatch ? parseInt(userCountMatch[1], 10) : null;

                logger.debug(`[${PROVIDER_NAME}] Found User Score ${userScore}/10` + (userCount ? ` (${userCount} users)` : ''));
                ratings.push({
                    source: 'MC Users', // Distinguish source
                    type: 'Users',
                    value: `${userScore}/10`,
                    count: userCount, // Optional count
                    url: url
                });
            } else {
                logger.warn(`[${PROVIDER_NAME}] Parsed user score ${userScore} is outside 0-10 range at ${url}.`);
            }
        } else if (userScoreText && userScoreText.toLowerCase() !== 'tbd') {
            logger.warn(`[${PROVIDER_NAME}] Found user score text "${userScoreText}" but failed validation at ${url}.`);
        } // Ignore 'tbd' scores silently

        if (ratings.length === 0) {
            logger.debug(`[${PROVIDER_NAME}] No valid Metacritic ratings found via scraping on page ${url}`);
            return null;
        }

        return ratings;

    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Cheerio parsing error for ${url}: ${error.message}`);
        return null;
    }
}

/**
 * Fetches ratings from Metacritic.
 * @param {'movie'|'series'} type - Content type.
 * @param {string} imdbId - IMDb ID (for logging).
 * @param {object} streamInfo - Object containing { name: string, year?: string }.
 * @returns {Promise<Array<object>|null>} An array of rating objects or null.
 */
async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Missing title.`);
        return null;
    }
    if (!BASE_URL) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Base URL not configured.`);
        return null;
    }

    const targetUrl = getMetacriticUrl(streamInfo.name, type);
    if (!targetUrl) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Could not construct URL for "${streamInfo.name}".`);
        return null;
    }

    logger.debug(`[${PROVIDER_NAME}] Attempting fetch for ${imdbId} from ${targetUrl}`);

    const response = await getPage(targetUrl, PROVIDER_NAME);

    if (!response || response.status !== 200) {
        // Common for Metacritic to 404 if title match isn't exact
        return null;
    }

    const ratings = scrapeMetacriticPage(response.data, targetUrl);

    if (!ratings) {
        logger.debug(`[${PROVIDER_NAME}] No ratings found via scraping for ${imdbId} at ${targetUrl}`);
    }

    return ratings; // Return array or null
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};