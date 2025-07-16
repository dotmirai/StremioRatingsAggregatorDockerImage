const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');

const PROVIDER_NAME = 'Rotten Tomatoes';
const BASE_URL = config.sources.rottentomatoesBaseUrl;

function formatSlug(title) {
    return title?.toLowerCase()
        .replace(/[:_]/g, ' ')
        .replace(/['’]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || '';
}

function buildCandidateUrls(title, type, year) {
    const path = type === 'series' ? 'tv' : 'm';
    const slug = formatSlug(title);

    const urls = [];

    if (year) {
        urls.push(`${BASE_URL}/${path}/${slug}_${year}`);        // first: movie_2024
    }

    urls.push(`${BASE_URL}/${path}/${slug}`);                    // second: movie

    if (year) {
        urls.push(`${BASE_URL}/${path}/${slug}_${year}_2`);      // third: movie_2024_2
    }

    return urls;
}


function parseJsonLd($) {
    const ratings = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html());

            if (json.aggregateRating?.ratingValue) {
                const val = parseInt(json.aggregateRating.ratingValue.toString().replace('%', ''), 10);
                if (!isNaN(val)) ratings.push({ source: 'RT', value: `${val}/100`, type: 'Critics' });
            }

            if (json.audience?.audienceScore) {
                const val = parseInt(json.audience.audienceScore.toString().replace('%', ''), 10);
                if (!isNaN(val)) ratings.push({ source: 'RT Users', value: `${val}/100`, type: 'Audience' });
            }
        } catch { /* ignore bad JSON */ }
    });

    return ratings;
}

function scrapeDom($) {
    const ratings = [];

    const critic = $('rt-text[slot="criticsScore"]').first().text().trim();
    const user = $('rt-text[slot="audienceScore"]').first().text().trim();

    if (/^\d+$/.test(critic)) ratings.push({ source: 'RT', value: `${critic}/100`, type: 'Critics' });
    if (/^\d+$/.test(user)) ratings.push({ source: 'RT Users', value: `${user}/100`, type: 'Audience' });

    return ratings;
}

function scrape(html, url) {
    try {
        const $ = cheerio.load(html);
        const all = [...parseJsonLd($), ...scrapeDom($)];

        const seen = new Set();
        const unique = all.filter(r => {
            if (seen.has(r.source)) return false;
            seen.add(r.source);
            return true;
        });

        return unique.length ? unique.map(r => ({ ...r, url })) : null;
    } catch (err) {
        logger.error(`[${PROVIDER_NAME}] Scrape error for ${url}: ${err.message}`);
        return null;
    }
}

async function tryFetch(url) {
    logger.debug(`[${PROVIDER_NAME}] Trying URL: ${url}`);
    const res = await getPage(url, PROVIDER_NAME, {
        headers: {
            Referer: BASE_URL,
            Accept: 'text/html,application/xhtml+xml'
        }
    });

    if (res?.status === 200) return scrape(res.data, url);
    return null;
}

async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name || !BASE_URL) return null;

    const year = streamInfo.year || (streamInfo.date?.split('-')[0] || '');
    const urls = buildCandidateUrls(streamInfo.name, type, year);

    for (const url of urls) {
        const result = await tryFetch(url);
        if (result) return result;
    }

    logger.debug(`[${PROVIDER_NAME}] No valid ratings found for ${imdbId}`);
    return null;
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};
