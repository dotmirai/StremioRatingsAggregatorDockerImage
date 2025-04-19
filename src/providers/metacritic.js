const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');

const PROVIDER_NAME = 'Metacritic';

// Helper to generate Metacritic URL (direct approach)
function getMetacriticUrl(title, type, year = null) {
    const mediaType = type === 'series' ? 'tv' : 'movie';

    // Format title: lowercase, replace spaces and special chars with hyphens
    const formattedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

    return `${config.sources.metacriticBaseUrl}/${mediaType}/${formattedTitle}`;
}

// Update the scrapeMetacriticPage function
async function scrapeMetacriticPage(url) {
    try {
        logger.debug(`${PROVIDER_NAME}: Scraping page ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': config.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const ratings = [];

        // --- Metascore (Critics) ---
        const criticScoreInfo = $('[data-testid="critic-score-info"]');
        if (criticScoreInfo.length) {
            // Find score element using the new structure
            const criticScore = criticScoreInfo
                .find('.c-siteReviewScore span')
                .first()
                .text()
                .trim();

            // Get review count if needed (optional)
            const criticCountText = criticScoreInfo
                .find('.c-productScoreInfo_reviewsTotal span')
                .text()
                .trim();
            const criticCountMatch = criticCountText.match(/Based on (\d+) Critic/i);
            const criticCount = criticCountMatch ? parseInt(criticCountMatch[1], 10) : null;

            if (criticScore && /^\d+$/.test(criticScore)) {
                logger.debug(`${PROVIDER_NAME}: Found Metascore ${criticScore}/100 (${criticCount} critics)`);
                ratings.push({
                    source: 'MC',
                    type: 'Critics',
                    value: `${criticScore}/100`,
                    count: criticCount,
                    url: url
                });
            }
        }

        // --- User Score ---
        const userScoreInfo = $('[data-testid="user-score-info"]');
        if (userScoreInfo.length) {
            // Find user score using the new structure
            const userScore = userScoreInfo
                .find('.c-siteReviewScore span')
                .first()
                .text()
                .trim();

            // Get user review count if needed (optional)
            const userCountText = userScoreInfo
                .find('.c-productScoreInfo_reviewsTotal span')
                .text()
                .trim();
            const userCountMatch = userCountText.match(/Based on (\d+) User/i);
            const userCount = userCountMatch ? parseInt(userCountMatch[1], 10) : null;

            // User score can be decimal (e.g., "6.1")
            if (userScore && /^\d+(\.\d+)?$/.test(userScore)) {
                logger.debug(`${PROVIDER_NAME}: Found User Score ${userScore}/10 (${userCount} users)`);
                ratings.push({
                    source: 'MC Users',
                    type: 'Users',
                    value: `${userScore}/10`,
                    count: userCount,
                    url: url
                });
            }
        }

        if (ratings.length === 0) {
            logger.debug(`${PROVIDER_NAME}: No valid ratings found on page ${url}`);
        }

        return ratings.length > 0 ? ratings : null;

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
    logger.debug(`${PROVIDER_NAME}: Fetching ratings for ${imdbId} (${type})`);

    try {
        // Check if we have the required stream info
        if (!streamInfo?.name) {
            logger.warn(`${PROVIDER_NAME}: Cannot proceed without title/name for ${imdbId}.`);
            return null;
        }

        // Get direct URL
        const targetUrl = getMetacriticUrl(streamInfo.name, type, streamInfo.year);
        logger.debug(`${PROVIDER_NAME}: Attempting to fetch from ${targetUrl}`);

        const ratings = await scrapeMetacriticPage(targetUrl);

        if (!ratings || ratings.length === 0) {
            logger.debug(`${PROVIDER_NAME}: No ratings found for ${streamInfo.name} at ${targetUrl}`);
            return null;
        }

        return ratings;
    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Unexpected error getting ratings for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};