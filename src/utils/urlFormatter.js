// utils/urlFormatter.js

/**
 * Formats a title into a URL-friendly slug.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 * @param {string} title - The original title.
 * @returns {string} The formatted URL slug.
 */
function formatTitleForUrlSlug(title) {
    if (!title) return '';

    const formatted = title
        .toLowerCase()
        // Replace common punctuation/separators with hyphen BEFORE removing others
        .replace(/[:_'/()\[\]&@!$%\^*+=?.,"]+/g, '-')
        // Keep alphanumeric and hyphens, remove others
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        // Replace whitespace sequences with a single hyphen
        .replace(/\s+/g, '-')
        // Collapse consecutive hyphens into one
        .replace(/-+/g, '-')
    // Remove leading/trailing hyphens (optional, some sites might need them)
    // .replace(/^-|-$/g, '');

    return formatted;
}

module.exports = {
    formatTitleForUrlSlug,
};