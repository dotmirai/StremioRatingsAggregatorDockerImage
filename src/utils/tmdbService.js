// utils/tmdbService.js
const config = require('../config');
const logger = require('./logger');
const { getPage } = require('./httpClient');

function normalizeImdbId(imdbId) {
    return imdbId?.split(':')[0];
}

async function getTmdbData(imdbId, type) {
    const baseImdb = normalizeImdbId(imdbId);

    if (!config.tmdb.apiKey) {
        logger.error('TMDB API key not configured.');
        return { tmdbId: null, name: null, date: null };
    }

    const url = `${config.tmdb.apiUrl}/find/${baseImdb}?api_key=${config.tmdb.apiKey}&external_source=imdb_id`;

    try {
        const response = await getPage(url, 'TMDB');

        if (!response || response.status !== 200) {
            return { tmdbId: null, name: null, date: null };
        }

        const data = response.data;
        const results = type === 'series' ? data.tv_results : data.movie_results;

        if (Array.isArray(results) && results.length > 0) {
            const item = results[0];
            const tmdbId = item.id;
            const name = item.title || item.name || null;
            const date = item.release_date || item.first_air_date || null;

            logger.debug(
                `TMDB Data: IMDb=${baseImdb}, Type=${type} → ID=${tmdbId}, Name="${name}", Date="${date}"`
            );

            return { tmdbId, name, date };
        }

        logger.warn(`No TMDB results for IMDb=${baseImdb} (type=${type}).`);
        return { tmdbId: null, name: null, date: null };

    } catch (err) {
        logger.error(`TMDB API error for IMDb=${baseImdb}: ${err.message}`, { url });
        return { tmdbId: null, name: null, date: null };
    }
}

module.exports = { getTmdbData };
