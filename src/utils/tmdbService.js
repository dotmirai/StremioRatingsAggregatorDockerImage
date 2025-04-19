const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Fetches TMDB ID, title/name, and year for a given IMDb ID and content type
 * using only the /find endpoint.
 *
 * @param {string} imdbId   - IMDb ID, possibly with :S:E suffix (e.g. "tt1234567:1:1")
 * @param {'movie'|'series'} type
 * @returns {Promise<{ tmdbId: number|null, name: string|null, date: string|null }>}
 */
async function getTmdbData(imdbId, type) {
    if (!config.tmdb.apiKey) {
        logger.error('TMDB API key not configured.');
        throw new Error('TMDB API key not configured');
    }

    // strip off any season/episode suffix
    const baseImdb = imdbId.split(':')[0];
    const url = `${config.tmdb.apiUrl}/find/${baseImdb}` +
        `?api_key=${config.tmdb.apiKey}&external_source=imdb_id`;

    try {
        const { data } = await axios.get(url, { timeout: 5000 });
        const results = type === 'series' ? data.tv_results : data.movie_results;

        if (Array.isArray(results) && results.length > 0) {
            const item = results[0];
            const tmdbId = item.id;
            // movies use .title/.release_date, TV uses .name/.first_air_date
            const name = item.title || item.name || null;
            const date = item.release_date || item.first_air_date || null;
            logger.debug(
                `TMDB Data: IMDb=${baseImdb}, Type=${type} → ID=${tmdbId}, Name="${name}", Date="${date}"`
            );

            return { tmdbId, name , date};
        }

        logger.warn(`No TMDB results for IMDb=${baseImdb} (type=${type}).`);
        return { tmdbId: null, name: null, date: null };

    } catch (err) {
        if (err.response?.status === 404) {
            logger.warn(`TMDB 404 for IMDb=${baseImdb}.`);
            return { tmdbId: null, name: null, date: null };
        }

        logger.error(
            `TMDB API error for IMDb=${baseImdb}: ${err.message}`,
            { url }
        );
        return { tmdbId: null, name: null, date: null };
    }
}

module.exports = { getTmdbData };
