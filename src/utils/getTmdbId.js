const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Finds TMDB ID from an IMDb ID for movies or series
 * @param {string} imdbId - The IMDb ID to lookup (e.g., "tt1234567" or "tt1234567:1:1")
 * @param {string} type - Content type ('movie' or 'series')
 * @returns {Promise<number|null>} TMDB ID if found, null otherwise
 * @throws {Error} If API key is not configured or API request fails unexpectedly
 */
async function getTmdbId(imdbId, type) {
    if (!config.tmdb.apiKey) {
        logger.error('TMDB API Key not configured.');
        throw new Error('TMDB API Key not configured');
    }

    // Ensure we only use the base IMDb ID (remove season/episode)
    const baseImdbId = imdbId.split(':')[0];

    const url = `${config.tmdb.apiUrl}/find/${baseImdbId}?api_key=${config.tmdb.apiKey}&external_source=imdb_id`;

    try {
        const response = await axios.get(url); // Added timeout

        let tmdbId = null;
        let results = [];

        if (type === 'series') {
            results = response.data.tv_results || [];
        } else if (type === 'movie') {
            results = response.data.movie_results || [];
        }

        if (results.length > 0) {
            tmdbId = results[0].id;
            logger.debug(`TMDB Found: TMDB ID ${tmdbId} for IMDb ID ${baseImdbId} (${type})`);
        } else {
            logger.warn(`TMDB Not Found: Could not find TMDB ID for IMDb ID ${baseImdbId} (${type})`);
        }
        return tmdbId;

    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`TMDB Error 404: IMDb ID ${baseImdbId} not found via /find endpoint.`);
            return null;
        }
        // Log other errors but don't necessarily throw unless critical
        logger.error(`TMDB API Error finding TMDB ID for ${baseImdbId} (${type}): ${error.message}`, { url });
        // Depending on strategy, you might return null or re-throw
        return null; // Return null on error to avoid breaking aggregation
        // throw error; // Or re-throw if this lookup is critical
    }
}

module.exports = getTmdbId;