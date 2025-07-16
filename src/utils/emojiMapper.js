module.exports = {
    getEmojiForSource(source) {
        return {
            'TMDb': '🎥',
            'IMDb': '⭐',
            'MC': 'Ⓜ️',
            'MC Users': '👤',
            'RT': '🍅',
            'RT Users': '👥',
            'Letterboxd': '📝',
            'Common Sense': '👶',
            'CringeMDB': '⚠️',
            'Certification': '✅',
        }[source] || '📊';
    }
};
