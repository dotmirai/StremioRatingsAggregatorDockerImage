const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'Common Sense';
const BASE_URL = config.sources.commonSenseBaseUrl;

function getCommonSenseUrl(title, type) {
    if (!title || !BASE_URL) return null;
    const slug = formatTitleForUrlSlug(title);
    const path = type === 'series' ? 'tv-reviews' : 'movie-reviews';
    return slug ? `${BASE_URL}/${path}/${slug}` : null;
}

function scrapeAgeRating(html, url) {
    const $ = cheerio.load(html);
    const raw = $('span.rating__age').first().text().trim();

    if (!raw) return null;

    const cleaned = raw.replace(/^age\s*/i, '').trim();
    return cleaned ? {
        source: PROVIDER_NAME,
        value: cleaned,
        url,
    } : null;
}

async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name || !BASE_URL) return null;

    const url = getCommonSenseUrl(streamInfo.name, type);
    if (!url) return null;

    logger.debug(`[${PROVIDER_NAME}] Fetching ${url}`);
    const res = await getPage(url, PROVIDER_NAME);
    if (!res || res.status !== 200) return null;

    return scrapeAgeRating(res.data, url);
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};
