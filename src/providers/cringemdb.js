const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'CringeMDB';
const BASE_URL = config.sources.cringeMdbBaseUrl;

function getCringeMDBUrl(title, year) {
    if (!title || !year || !BASE_URL) return null;

    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    return slug ? `${BASE_URL}/movie/${slug}-${year}` : null;
}

function scrapeWarnings(html, url) {
    const $ = cheerio.load(html);
    const warnings = [];

    // Certification
    const isSafe = $('.certification .emoji .safe').length > 0;
    const certText = isSafe ? '✅ Parent-Safe' : '⚠️ Not Parent Safe';
    warnings.push({ category: 'Certification', text: certText });
    logger.debug(`[${PROVIDER_NAME}] Certification: ${certText}`);

    // Flags
    const emojiMap = {
        'Sex Scene': '🔞',
        'Nudity': '👁️‍🗨️',
        'Sexual Violence': '💔',
        // 'Graphic Violence': '🩸',
        // 'Drug Use': '💊',
        // 'Excessive Swearing': '🤬',
    };

    $('.content-warnings .content-flag').each((_, el) => {
        const category = $(el).find('h3').text().trim();
        const value = $(el).find('h4').text().trim();

        if (value.toUpperCase() === 'YES') {
            const emoji = emojiMap[category] || '🚩';
            warnings.push({ category, text: `${emoji} ${category}` });
            logger.debug(`[${PROVIDER_NAME}] Flagged: ${category}`);
        }
    });

    if (warnings.length === 0) return null;

    const cert = warnings.find(w => w.category === 'Certification')?.text;
    const others = warnings.filter(w => w.category !== 'Certification').map(w => w.text);

    return {
        source: PROVIDER_NAME,
        value: [cert, ...others].filter(Boolean).join('\n'),
        url,
    };
}

async function getRating(type, imdbId, streamInfo) {
    if (type !== 'movie') return null;
    if (!streamInfo?.name || !streamInfo?.year || !BASE_URL) return null;

    const url = getCringeMDBUrl(streamInfo.name, streamInfo.year);
    if (!url) return null;

    logger.debug(`[${PROVIDER_NAME}] Fetching ${url}`);
    const res = await getPage(url, PROVIDER_NAME);
    if (!res || res.status !== 200) return null;

    return scrapeWarnings(res.data, url);
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};
