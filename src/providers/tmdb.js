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
        const response = await axios.get(url, { timeout: 5000 });
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

// Fetches details for a specific episode
async function getTmdbEpisodeRatingDetails(seriesTmdbId, seasonNumber, episodeNumber) {
    if (!config.tmdb.apiKey) throw new Error('TMDB API Key not configured');
    const url = `${config.tmdb.apiUrl}/tv/${seriesTmdbId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${config.tmdb.apiKey}`;

    try {
        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;

        if (data && data.vote_average !== undefined && data.vote_average !== 0) { // Check vote_average exists and is not 0
            const rating = data.vote_average.toFixed(1);
            const voteCount = data.vote_count || 0;
            const detailsPage = `https://www.themoviedb.org/tv/${seriesTmdbId}/season/${seasonNumber}/episode/${episodeNumber}`;
            logger.debug(`${PROVIDER_NAME}: Episode S${seasonNumber}E${episodeNumber} (${seriesTmdbId}): ${rating}/10 (${voteCount} votes)`);
            return {
                source: PROVIDER_NAME,
                value: `${rating}/10`,
                // Optional: Include vote count
                // vote_count: voteCount,
                url: detailsPage,
            };
        } else {
            logger.debug(`${PROVIDER_NAME}: No valid rating found for episode S${seasonNumber}E${episodeNumber} (${seriesTmdbId}). Vote avg: ${data?.vote_average}`);
            return null;
        }
    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`${PROVIDER_NAME}: Episode S${seasonNumber}E${episodeNumber} (Series ID ${seriesTmdbId}) not found.`);
            return null;
        }
        logger.error(`${PROVIDER_NAME}: API Error fetching episode S${seasonNumber}E${episodeNumber} (${seriesTmdbId}): ${error.message}`);
        return null; // Return null on error
        // throw error;
    }
}

// Main exported function for this provider
async function getRating(type, imdbId) {
    logger.debug(`${PROVIDER_NAME}: Fetching rating for ${imdbId} (${type})`);

    // Check if it's an episode request (e.g., "tt1234567:1:1")
    if (type === 'series' && imdbId.includes(':')) {
        const parts = imdbId.split(':');
        const baseImdbId = parts[0]; // Needed to find the series TMDB ID
        const seasonNumber = parseInt(parts[1], 10);
        const episodeNumber = parseInt(parts[2], 10);

        if (isNaN(seasonNumber) || isNaN(episodeNumber)) {
            logger.warn(`${PROVIDER_NAME}: Invalid series ID format with episode details: ${imdbId}. Falling back to series rating.`);
            // Fall through to fetch series rating instead
        } else {
            const seriesTmdbId = await getTmdbId(baseImdbId, type); // Use base ID
            if (!seriesTmdbId) {
                logger.warn(`${PROVIDER_NAME}: Cannot get episode rating without TMDB ID for series ${baseImdbId}.`);
                return null; // Can't proceed for episode
            }

            // Try fetching episode rating
            const episodeRating = await getTmdbEpisodeRatingDetails(seriesTmdbId, seasonNumber, episodeNumber);

            // If episode rating found, return it. If not, fall through to get series rating as fallback.
            if (episodeRating) {
                return episodeRating;
            }
            logger.debug(`${PROVIDER_NAME}: Episode rating not found for ${imdbId}. Falling back to series rating.`);
        }
    }

    // Default: Fetch movie rating or overall series rating
    const tmdbId = await getTmdbId(imdbId, type); // Handles stripping season/episode internally
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