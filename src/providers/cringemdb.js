// providers/cringeMdbProvider.js
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'CringeMDB';
const BASE_URL = config.sources.cringeMdbBaseUrl;

/**
 * Constructs the CringeMDB URL.
 * @param {string} title - Movie title.
 * @param {string} releaseYear - Movie release year.
 * @returns {string|null} The URL or null if data is missing.
 */
function getCringeMDBUrl(title, releaseYear) {
    if (!title || !releaseYear || !BASE_URL) return null;

    // CringeMDB uses a slightly different slug (no spaces, alphanumeric only)
    const formattedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Keep spaces temporarily
        .trim()
        .replace(/\s+/g, '-'); // Replace spaces with hyphens

    if (!formattedTitle) return null;

    return `${BASE_URL}/movie/${formattedTitle}-${releaseYear}`;
}

/**
 * Scrapes the CringeMDB page for content warnings.
 * @param {string} htmlContent - The HTML content.
 * @param {string} url - The scraped URL.
 * @returns {object|null} Object with { source, type, value, url } or null.
 */
function scrapeCringeMDBPage(htmlContent, url) {
    try {
        const $ = cheerio.load(htmlContent);
        const warnings = [];

        // --- Certification Status ---
        // Selectors based on current CringeMDB structure (may change)
        const certificationSelector = '.certification .emoji'; // General area
        const safeEmojiSelector = '.safe'; // Emoji for safe
        const isVerifiedSafe = $(`${certificationSelector} ${safeEmojiSelector}`).length > 0;
        const certificationText = isVerifiedSafe ? '✅ Parent-Safe' : '⚠️ Not Parent Safe';
        // Always add certification status
        warnings.push({ category: 'Certification', text: certificationText });
        logger.debug(`[${PROVIDER_NAME}] Found Certification: ${certificationText}`);

        // --- Specific Content Warnings ---
        const warningSelector = '.content-warnings .content-flag';
        const categorySelector = 'h3';
        const valueSelector = 'h4'; // Contains 'Yes' or 'No'

        const warningMap = { // Emojis for categories
            'Sex Scene': '🔞',
            'Nudity': '👁️‍🗨️',
            'Sexual Violence': '💔',
            'Graphic Violence': '🩸',
            'Drug Use': '💊',
            'Excessive Swearing': '🤬',
            // Add more mappings as needed
        };

        $(warningSelector).each((_, element) => {
            const category = $(element).find(categorySelector).text().trim();
            const value = $(element).find(valueSelector).text().trim();

            if (value.toUpperCase() === 'YES') {
                const emoji = warningMap[category] || '🚩'; // Default flag
                const warningText = `${emoji} ${category}`;
                warnings.push({ category: category, text: warningText });
                logger.debug(`[${PROVIDER_NAME}] Found Warning: ${category}`);
            }
        });

        // Format the result
        if (warnings.length > 0) {
            // Separate Certification from Warnings for clarity if desired
            const cert = warnings.find(w => w.category === 'Certification')?.text || '';
            const contentWarns = warnings.filter(w => w.category !== 'Certification').map(w => w.text);

            let combinedValue = cert;
            if (contentWarns.length > 0) {
                combinedValue += (cert ? '\n' : '') + contentWarns.join('\n');
            }

            return {
                source: PROVIDER_NAME,
                type: 'Content Warnings',
                value: combinedValue.trim(), // Combine certification and warnings
                url: url,
            };
        }

        logger.debug(`[${PROVIDER_NAME}] No significant warnings or certification found on page ${url}`);
        return null;

    } catch (error) {
        logger.error(`[${PROVIDER_NAME}] Cheerio parsing error for ${url}: ${error.message}`);
        return null;
    }
}

/**
 * Fetches content warnings from CringeMDB.
 * @param {'movie'|'series'} type - Content type (only 'movie' supported).
 * @param {string} imdbId - IMDb ID (for logging).
 * @param {object} streamInfo - Object containing { name: string, year: string }.
 * @returns {Promise<object|null>} A rating/warning object or null.
 */
async function getRating(type, imdbId, streamInfo) {
    // CringeMDB primarily focuses on movies
    if (type !== 'movie') {
        logger.debug(`[${PROVIDER_NAME}] Skipping ${imdbId}: Only supports movies.`);
        return null;
    }
    if (!streamInfo?.name || !streamInfo?.year) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Missing title or year.`);
        return null;
    }
    if (!BASE_URL) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Base URL not configured.`);
        return null;
    }

    const targetUrl = getCringeMDBUrl(streamInfo.name, streamInfo.year);
    if (!targetUrl) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: Could not construct URL for "${streamInfo.name}" (${streamInfo.year}).`);
        return null;
    }

    logger.debug(`[${PROVIDER_NAME}] Attempting fetch for ${imdbId} from ${targetUrl}`);

    const response = await getPage(targetUrl, PROVIDER_NAME);

    if (!response || response.status !== 200) {
        return null;
    }

    const warnings = scrapeCringeMDBPage(response.data, targetUrl);

    if (!warnings) {
        logger.debug(`[${PROVIDER_NAME}] No warnings found via scraping for ${imdbId} at ${targetUrl}`);
    }

    return warnings;
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};