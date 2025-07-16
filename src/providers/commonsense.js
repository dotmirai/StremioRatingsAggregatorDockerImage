// providers/commonSenseProvider.js
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient'); // Use shared client
const { formatTitleForUrlSlug } = require('../utils/urlFormatter'); // Use shared formatter

const PROVIDER_NAME = 'Common Sense';
const BASE_URL = config.sources.commonSenseBaseUrl;


function getCommonSenseUrl(title, type) {
    if (!title || !BASE_URL) return null;

    const formattedTitle = formatTitleForUrlSlug(title);
    if (!formattedTitle) return null; // Handle empty title after formatting

    const reviewType = type === 'series' ? 'tv-reviews' : 'movie-reviews';
    return `${BASE_URL}/${reviewType}/${formattedTitle}`;
}


function scrapeCommonSensePage(htmlContent, url) {
    try {
        const $ = cheerio.load(htmlContent);

        // Selector targeting the age rating span
        const ageRatingSelector = 'span.rating__age';
        let ageRatingText = $(ageRatingSelector).first().text().trim();

        if (!ageRatingText) {
            logger.debug(`[${PROVIDER_NAME}] Age rating selector ('${ageRatingSelector}') not found on page ${url}`);
            return null;
        }

        // Clean up "age 10+" -> "10+"
        const ageRatingValue = ageRatingText.replace(/^age\s*/i, '').trim();

        if (ageRatingValue) {
            logger.debug(`[${PROVIDER_NAME}] Found Age Rating: ${ageRatingValue} at ${url}`);
            return {
                source: PROVIDER_NAME,
                type: 'Age Rating', // Clarify the type of rating
                value: ageRatingValue,
                url: url,
            };
        } else {
            logger.warn(`[${PROVIDER_NAME}] Found age rating element but text was empty or invalid at ${url}`);
            return null;
        }
    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Cheerio parsing error for ${url}: ${error.message}`);
        return null; // Error during scraping
    }
}


async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Missing title.`);
        return null;
    }
    if (!BASE_URL) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Base URL not configured.`);
        return null;
    }

    const targetUrl = getCommonSenseUrl(streamInfo.name, type);
    if (!targetUrl) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Could not construct URL for title "${streamInfo.name}".`);
        return null;
    }

    logger.debug(`[${PROVIDER_NAME}] Attempting fetch for ${imdbId} from ${targetUrl}`);

    const response = await getPage(targetUrl, PROVIDER_NAME);

    // Handle failed requests (already logged in getPage)
    if (!response || response.status !== 200) {
        // Note: 404 is common and expected if CSM doesn't have a review
        return null;
    }

    // Scrape the HTML content
    const rating = scrapeCommonSensePage(response.data, targetUrl);

    if (!rating) {
        logger.debug(`[${PROVIDER_NAME}] No rating found via scraping for ${imdbId} at ${targetUrl}`);
    }

    return rating; // Return the rating object or null
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};