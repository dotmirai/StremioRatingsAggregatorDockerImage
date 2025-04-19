const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const getTmdbId = require('../utils/getTmdbId'); // Use updated utility

const PROVIDER_NAME = 'TMDb';

// Fetches details for a movie or the entire series
async function getTmdbRatingDetails(tmdbId, type) {
    if (!config.tmdb.apiKey) throw new Error('TMDB API Key not configured');
    const endpoint = type === 'series' ? 'tv' : 'movie';
    const url = `${config.tmdb.apiUrl}/${endpoint}/${tmdbId}?api_key=${config.tmdb.apiKey}`;

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'en-US,en;q=0.9' }, // Added Accept-Language
            // timeout: 5000 // 
        });
        const data = response.data;

        if (data && data.vote_average !== undefined && data.vote_average !== 0) { // Check vote_average exists and is not 0
            const rating = data.vote_average.toFixed(1);
            const voteCount = data.vote_count || 0;
            const detailsPage = `https://www.themoviedb.org/${type}/${tmdbId}`;
            logger.debug(`${PROVIDER_NAME}: Rating for ${tmdbId} (${type}): ${rating}/10 (${voteCount} votes)`);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`,
                // Optional: Include vote count if needed later
                // vote_count: voteCount,
                url: detailsPage,
            };
        } else {
            logger.debug(`${PROVIDER_NAME}: No valid rating found for ${tmdbId} (${type}). Vote avg: ${data?.vote_average}`);
            return null;
        }
    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`${PROVIDER_NAME}: TMDB ID ${tmdbId} (${type}) not found.`);
            return null;
        }
        logger.error(`${PROVIDER_NAME}: API Error fetching details for ${tmdbId} (${type}): ${error.message}`);
        // Throwing here might stop aggregation, returning null is safer
        return null;
        // throw error;
    }
}

// Main exported function for this provider
async function getRating(type, imdbId , streamInfo ,tmdbId) {
    logger.debug(`${PROVIDER_NAME}: Fetching rating for ${imdbId} (${type})`);

    // Default: Fetch movie rating or overall series rating
    if (!tmdbId) {
        logger.warn(`${PROVIDER_NAME}: Cannot proceed without TMDB ID for ${imdbId}.`);
        return null;
    }
    return getTmdbRatingDetails(tmdbId, type);
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};