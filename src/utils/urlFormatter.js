function formatTitleForUrlSlug(title) {
    if (!title) return '';

    const formatted = title
        .toLowerCase()
        .replace(/[:_'/()\[\]&@!$%\^*+=?.,"]+/g, '-')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return formatted;
}

module.exports = {
    formatTitleForUrlSlug,
};