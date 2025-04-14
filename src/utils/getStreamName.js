const axios = require('axios');
const config = require('../config');
const logger = require('./logger');
const getTmdbId = require('./getTmdbId'); // Use the updated utility

/**
 * Gets the title/name and release date of a movie or series from TMDB using IMDb ID.
 * Essential for scrapers that need the title to build search URLs.
 * @param {string} imdbId - The IMDb ID (e.g., "tt1234567")
 * @param {string} type - Content type ('movie' or 'series')
 * @returns {Promise<{name: string, year: string | null} | null>} Object containing name and year if found, null otherwise. Year might be null.
 */
async function getStreamNameAndYear(imdbId, type) {
    if (!config.tmdb.apiKey) {
        logger.error('TMDB API Key not configured for getStreamNameAndYear.');
        return null; // Return null instead of throwing to allow scrapers to potentially fail gracefully
    }

    try {
        const tmdbId = await getTmdbId(imdbId, type); // Reuse the utility

        if (!tmdbId) {
            logger.warn(`getStreamNameAndYear: Could not find TMDB ID for IMDb ID: ${imdbId}. Cannot fetch metadata.`);
            return null;
        }

        const endpoint = type === 'series' ? 'tv' : 'movie';
        const url = `${config.tmdb.apiUrl}/${endpoint}/${tmdbId}?api_key=${config.tmdb.apiKey}`;

        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;

        const name = data.title || data.name;
        const releaseDate = data.release_date || data.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : null;

        if (name) {
            logger.debug(`getStreamNameAndYear: Found metadata for ${imdbId}: Name="${name}", Year=${year}`);
            return { name, year };
        }

        logger.warn(`getStreamNameAndYear: No name found for ${imdbId} (TMDB ID: ${tmdbId})`);
        return null;

    } catch (error) {
        logger.error(`getStreamNameAndYear: Error getting metadata for ${imdbId}: ${error.message}`);
        return null; // Return null on error
    }
}

module.exports = getStreamNameAndYear; // Renamed export for clarity