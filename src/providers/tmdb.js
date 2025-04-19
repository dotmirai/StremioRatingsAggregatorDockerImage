// providers/tmdbProvider.js
const axios = require('axios'); // Keep direct axios use for specific API client if preferred
const config = require('../config');
const logger = require('../utils/logger');

const PROVIDER_NAME = 'TMDb';
const API_KEY = config.tmdb.apiKey;
const API_URL = config.tmdb.apiUrl;

// Optional: Create a dedicated Axios instance for TMDB API
const tmdbApiClient = axios.create({
    baseURL: API_URL,
    timeout: config.http.requestTimeoutMs || 8000, // Slightly shorter timeout for API?
    headers: { 'User-Agent': config.userAgent },
    params: { api_key: API_KEY }, // Automatically include API key
    validateStatus: (status) => status >= 200 && status < 500, // Handle 4xx as non-errors for checks
});


/**
 * Fetches rating details directly from the TMDB API for a movie or series.
 * @param {number} tmdbId - The Movie Database ID.
 * @param {'movie'|'series'} type - The content type.
 * @returns {Promise<object|null>} Rating object { source, value, url } or null.
 */
async function getTmdbRatingDetails(tmdbId, type) {
    if (!API_KEY) {
        // This should have been caught at startup, but double-check
        logger.error(`[${PROVIDER_NAME}] API Key missing.`);
        return null;
    }
    if (!tmdbId) {
        logger.warn(`[${PROVIDER_NAME}] Cannot fetch details without TMDB ID.`);
        return null;
    }

    const endpoint = type === 'series' ? 'tv' : 'movie';
    const url = `/${endpoint}/${tmdbId}`; // Relative URL for baseURL instance

    try {
        logger.debug(`[${PROVIDER_NAME}] API GET: ${API_URL}${url} (ID: ${tmdbId})`);
        // Use the dedicated client instance
        const response = await tmdbApiClient.get(url, {
            // Add specific params if needed, e.g., language
            // params: { language: 'en-US' }
        });

        const data = response.data;

        // Handle non-200 status explicitly
        if (response.status === 404) {
            logger.warn(`[${PROVIDER_NAME}] API request failed: 404 Not Found for ${type} ID ${tmdbId}.`);
            return null;
        } else if (response.status === 401) {
            logger.error(`[${PROVIDER_NAME}] API request failed: 401 Unauthorized. Check API Key.`);
            return null; // Don't retry if key is bad
        } else if (response.status !== 200) {
            logger.error(`[${PROVIDER_NAME}] API request failed: ${response.status} for ${type} ID ${tmdbId}.`);
            return null;
        }


        // Check if rating data is valid and meaningful
        if (data && data.vote_average !== undefined && data.vote_average > 0 && data.vote_count > 0) {
            // Only consider ratings with at least one vote and non-zero average
            const rating = data.vote_average.toFixed(1); // Keep one decimal place
            const voteCount = data.vote_count;
            const detailsPage = `https://www.themoviedb.org/${type}/${tmdbId}`;

            logger.debug(`[${PROVIDER_NAME}] Found rating ${rating}/10 (${voteCount} votes) for ${type} ID ${tmdbId}`);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`, // Standardized format
                count: voteCount, // Include count optionally
                url: detailsPage,
            };
        } else {
            logger.debug(`[${PROVIDER_NAME}] No meaningful rating found for ${type} ID ${tmdbId}. Avg: ${data?.vote_average}, Count: ${data?.vote_count}`);
            return null;
        }
    } catch (error) {
        // Handle network errors, timeouts etc. from the API client itself
        logger.error(`[${PROVIDER_NAME}] Network/Client Error fetching details for ${type} ID ${tmdbId}: ${error.message}`);
        return null;
    }
}

/**
 * Main exported function for the TMDB provider. Gets the rating using the TMDB ID.
 * @param {'movie'|'series'} type - Content type.
 * @param {string} imdbId - IMDb ID (mainly for logging context).
 * @param {object} streamInfo - Stream info object (not directly used here).
 * @param {number} tmdbId - The Movie Database ID (required).
 * @returns {Promise<object|null>} Rating object or null.
 */
async function getRating(type, imdbId, streamInfo, tmdbId) {
    logger.debug(`[${PROVIDER_NAME}] Getting rating for IMDb ${imdbId} using TMDB ID ${tmdbId}`);

    if (!tmdbId) {
        // This check is slightly redundant as getTmdbRatingDetails also checks, but good for clarity
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Missing TMDB ID.`);
        return null;
    }
    return getTmdbRatingDetails(tmdbId, type);
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};