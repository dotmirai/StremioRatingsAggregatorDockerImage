const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');

const PROVIDER_NAME = 'Common Sense';

// Helper to generate Common Sense Media direct URL
function getCommonSenseUrl(title, type) {
    // Format title for URL:
    // 1. Convert to lowercase
    // 2. Remove special characters except hyphens and spaces
    // 3. Replace spaces with hyphens
    // 4. Remove consecutive hyphens
    const formattedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    // Determine review type path
    const reviewType = type === 'series' ? 'tv-reviews' : 'movie-reviews';

    return `${config.sources.commonSenseBaseUrl}/${reviewType}/${formattedTitle}`;
}

async function scrapeCommonSensePage(url) {
    try {
        logger.debug(`${PROVIDER_NAME}: Scraping page ${url}`);
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // Updated selector for age rating
        let ageRating = $('span.rating__age').first().text().trim();

        // Clean up "age 10+" -> "10+"
        ageRating = ageRating.replace(/^age\s*/i, '').trim();

        if (ageRating) {
            logger.debug(`${PROVIDER_NAME}: Found Age Rating: ${ageRating}`);
            return {
                source: PROVIDER_NAME,
                type: 'Age Rating',
                value: ageRating,
                url: url,
            };
        } else {
            logger.warn(`${PROVIDER_NAME}: Could not find age rating on page ${url}`);
            return null;
        }
    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`${PROVIDER_NAME}: Page not found (404) at ${url}`);
        } else if (error.response) {
            logger.error(`${PROVIDER_NAME}: HTTP Error scraping page ${url}: ${error.response.status}`);
        } else {
            logger.error(`${PROVIDER_NAME}: Network or parsing error scraping page ${url}: ${error.message}`);
        }
        return null;
    }
}

async function getRating(type, imdbId, streamInfo) {
    logger.debug(`${PROVIDER_NAME}: Fetching rating for ${imdbId} (${type})`);

    try {
        if (!streamInfo?.name) {
            logger.warn(`${PROVIDER_NAME}: Cannot proceed without title/name for ${imdbId}.`);
            return null;
        }

        // Use direct URL construction instead of search
        const targetUrl = getCommonSenseUrl(streamInfo.name, type);

        logger.debug(`${PROVIDER_NAME}: Trying direct URL: ${targetUrl}`);

        const rating = await scrapeCommonSensePage(targetUrl);

        if (!rating) {
            logger.debug(`${PROVIDER_NAME}: No rating found for ${streamInfo.name} at ${targetUrl}`);
            return null;
        }

        return rating;
    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Unexpected error getting rating for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};