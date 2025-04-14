const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const getStreamNameAndYear = require('../utils/getStreamName'); // Use updated utility

const PROVIDER_NAME = 'CringeMDB';

// CringeMDB URL structure seems relatively stable
function getCringeMDBUrl(title, releaseYear) {
    // Format title: lowercase, alphanumeric and space only, replace space with dash
    const formattedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric/space
        .trim() // Trim whitespace
        .replace(/\s+/g, '-'); // Replace spaces with dashes

    if (!formattedTitle || !releaseYear) return null;

    return `${config.sources.cringeMdbBaseUrl}/movie/${formattedTitle}-${releaseYear}`;
}

async function scrapeCringeMDBPage(url) {
    try {
        logger.debug(`${PROVIDER_NAME}: Scraping page ${url}`);
        const response = await axios.get(url, {
            headers: { 'User-Agent': config.userAgent },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const warnings = [];

        // Check verification status
        const isVerifiedSafe = $('.certification .emoji .safe').length > 0;
        const certification = isVerifiedSafe ? '✅ Verified Parent-Safe' : '⚠️ Not Verified Safe';
        warnings.push(certification); // Add certification first

        // Get content warnings (sex, nudity, violence)
        $('.content-warnings .content-flag').each((_, element) => {
            const category = $(element).find('h3').text().trim();
            const value = $(element).find('h4').text().trim(); // Should be 'Yes' or 'No'

            // Map categories to emojis - adjust as needed
            const warningMap = {
                'Sex Scene': '🔞',
                'Nudity': '👁️‍🗨️', // Using a slightly different eye emoji
                'Sexual Violence': '💔',
                'Graphic Violence': '🩸',
                'Drug Use': '💊',
                'Excessive Swearing': '🤬',
            };

            // Add warning if the value is 'Yes'
            if (value.toUpperCase() === 'YES') {
                const emoji = warningMap[category] || '🚩'; // Default flag emoji
                warnings.push(`${emoji} ${category}`);
                logger.debug(`${PROVIDER_NAME}: Found warning: ${category}`);
            }
        });

        // Only return if we have more than just the certification status
        if (warnings.length > 1) {
            return {
                source: PROVIDER_NAME,
                type: 'Content Warnings',
                value: warnings.join('\n'), // Join warnings with newlines
                url: url,
            };
        } else if (warnings.length === 1) {
            // If only certification is found, maybe don't report it unless explicitly desired
            logger.debug(`${PROVIDER_NAME}: Only certification status found, no specific warnings.`);
            return {
                source: PROVIDER_NAME,
                type: 'Certification',
                value: certification,
                url: url,
            }; // Optionally return just certification
            // return null;
        }

        logger.debug(`${PROVIDER_NAME}: No significant warnings found on page ${url}`);
        return null;

    } catch (error) {
        if (error.response?.status === 404) {
            logger.warn(`${PROVIDER_NAME}: Page not found (404) at ${url}`);
        } else if (error.response) {
            logger.error(`${PROVIDER_NAME}: HTTP Error scraping page ${url}: ${error.response.status}`);
        } else {
            logger.error(`${PROVIDER_NAME}: Network or parsing error scraping page ${url}: ${error.message}`);
        }
        return null;
    }
}

async function getRating(type, imdbId) {
    // CringeMDB primarily focuses on movies
    if (type !== 'movie') {
        logger.debug(`${PROVIDER_NAME}: Skipping check, only supports movies.`);
        return null;
    }

    logger.debug(`${PROVIDER_NAME}: Fetching content warnings for ${imdbId}`);

    try {
        const streamInfo = await getStreamNameAndYear(imdbId, type);
        if (!streamInfo?.name || !streamInfo?.year) {
            logger.warn(`${PROVIDER_NAME}: Cannot proceed without title and release year for ${imdbId}.`);
            return null;
        }

        const targetUrl = getCringeMDBUrl(streamInfo.name, streamInfo.year);
        if (!targetUrl) {
            logger.warn(`${PROVIDER_NAME}: Could not construct valid URL for ${streamInfo.name} (${streamInfo.year}).`);
            return null;
        }

        const rating = await scrapeCringeMDBPage(targetUrl);

        if (!rating) {
            logger.debug(`${PROVIDER_NAME}: No content warnings found for ${streamInfo.name} at ${targetUrl}`);
            return null;
        }

        return rating;
    } catch (error) {
        logger.error(`${PROVIDER_NAME}: Unexpected error getting content warnings for ${imdbId}: ${error.message}`);
        return null;
    }
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};