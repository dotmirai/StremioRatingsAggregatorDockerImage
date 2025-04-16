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
            headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // Updated selector based on the new IMDb structure
        const ratingElement = $('div[data-testid="hero-rating-bar__aggregate-rating__score"] > span.sc-d541859f-1');
        let rating = ratingElement.text().trim();

        // split rating string in half if the string is of 6 characters make it first 3
        rating = rating.length === 6 ? rating.substring(0, 3) : rating;

        // Check if rating is a valid number
        if (rating && !/^\d+(\.\d+)?$/.test(rating)) {
            logger.warn(`${PROVIDER_NAME}: Invalid rating format for ${baseImdbId}: ${rating}`);
            return null;
        }
        

        // Simple validation/cleanup 
        if (rating) {
            logger.debug(`${PROVIDER_NAME}: Found rating ${rating}/10 for ${baseImdbId}`);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`,
                url: url,
            };
        } else {
            logger.warn(`${PROVIDER_NAME}: Could not find rating for ${baseImdbId} on page ${url}.`);
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