const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const PROVIDER_NAME = 'TMDb';
const API_KEY = config.tmdb.apiKey;
const API_URL = config.tmdb.apiUrl;

const tmdbApiClient = axios.create({
    baseURL: API_URL,
    timeout: config.http.requestTimeoutMs || 8000,
    headers: { 'User-Agent': config.userAgent },
    params: { api_key: API_KEY },
    validateStatus: status => status >= 200 && status < 500,
});

async function getTmdbRatingDetails(tmdbId, type) {
    const endpoint = type === 'series' ? 'tv' : 'movie';
    const url = `/${endpoint}/${tmdbId}`;

    try {
        logger.debug(`[${PROVIDER_NAME}] Fetching ${url}`);

        const res = await tmdbApiClient.get(url);
        const { vote_average, vote_count } = res.data || {};

        if (res.status === 404) {
            logger.warn(`[${PROVIDER_NAME}] 404 Not Found for TMDb ID: ${tmdbId}`);
            return null;
        }

        if (res.status === 401) {
            logger.error(`[${PROVIDER_NAME}] 401 Unauthorized. Check TMDB_API_KEY.`);
            return null;
        }

        if (res.status !== 200) {
            logger.error(`[${PROVIDER_NAME}] Unexpected status ${res.status} for ID ${tmdbId}`);
            return null;
        }

        if (vote_average && vote_count) {
            const rating = parseFloat(vote_average).toFixed(1);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`,
                count: vote_count,
                url: `https://www.themoviedb.org/${type}/${tmdbId}`,
            };
        }

        logger.debug(`[${PROVIDER_NAME}] No valid rating data for TMDb ID ${tmdbId}`);
        return null;
    } catch (err) {
        logger.error(`[${PROVIDER_NAME}] Request error: ${err.message}`);
        return null;
    }
}

async function getRating(type, _imdbId, _streamInfo, tmdbId) {
    if (!tmdbId) return null;
    return getTmdbRatingDetails(tmdbId, type);
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};
