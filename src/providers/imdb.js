const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');

const PROVIDER_NAME = 'IMDb';

async function getRating(type, imdbId) {
    const baseImdbId = imdbId.split(':')[0]; // Use only the base ID
    logger.debug(`${PROVIDER_NAME}: Fetching rating for ${baseImdbId}`);
    const url = `${config.sources.imdbBaseUrl}/title/${baseImdbId}/`;

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'en-US,en;q=0.9' }, // Added Accept-Language
            timeout: 10000 // Increased timeout for scraping
        });

        const $ = cheerio.load(response.data);

        // Updated selector based on potential IMDb structure (verify if needed)
        const ratingElement = $('[data-testid="hero-rating-bar__aggregate-rating__score"] > span:first-child');
        let rating = ratingElement.text().trim();

        // Simple validation/cleanup
        if (rating && /^\d+(\.\d+)?$/.test(rating)) {
            // Sometimes IMDb duplicates the rating like "8.38.3". Take the first valid part.
            if (rating.length > 4 && rating.substring(0, rating.length / 2) === rating.substring(rating.length / 2)) {
                rating = rating.substring(0, rating.length / 2);
            }

            logger.debug(`${PROVIDER_NAME}: Found rating ${rating}/10 for ${baseImdbId}`);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`,
                url: url,
            };
        } else {
            // Attempt fallback selector if the primary one fails
            const fallbackElement = $('.sc-bde20123-1.cMEQkK span').first(); // Example fallback selector - adjust as needed
            rating = fallbackElement.text().trim();
            if (rating && /^\d+(\.\d+)?$/.test(rating)) {
                logger.debug(`${PROVIDER_NAME}: Found rating ${rating}/10 for ${baseImdbId} (using fallback selector)`);
                return {
                    source: PROVIDER_NAME,
                    value: `${rating}/10`,
                    url: url,
                };
            }

            logger.warn(`${PROVIDER_NAME}: Could not find rating for ${baseImdbId} on page ${url}. Rating found: "${rating}"`);
            return null;
        }
    } catch (error) {
        if (error.response) {
            logger.error(`${PROVIDER_NAME}: HTTP Error fetching rating for ${baseImdbId}: ${error.response.status} ${error.response.statusText}`, { url });
        } else {
            logger.error(`${PROVIDER_NAME}: Network or parsing error fetching rating for ${baseImdbId}: ${error.message}`, { url });
        }
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};