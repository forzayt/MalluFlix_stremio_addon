/*
 * Vidcore stream source.
 *
 * Mirrors https://github.com/forzayt/Vidcore_Stremio_Addon: instead of hosting
 * files it hands Stremio an external URL for the requested title.
 *   movie  -> {VIDCORE_MOVIE_BASE_URL}/{imdbId}
 *   series -> {VIDCORE_TV_BASE_URL}/{imdbId}/{season}/{episode}?autoPlay=true
 */

const MOVIE_BASE_URL = (process.env.VIDCORE_MOVIE_BASE_URL || "https://vidcore.io/movie").replace(/\/+$/, "");
const TV_BASE_URL = (process.env.VIDCORE_TV_BASE_URL || "https://vidcore.io/tv").replace(/\/+$/, "");

const MOVIE_ID = /^tt\d+$/;
const SERIES_ID = /^(tt\d+):(\d+):(\d+)$/;

function externalStream(url) {
    return {
        externalUrl: url,
        title: url
    };
}

function movieStream(id) {
    if (!MOVIE_ID.test(id)) return [];
    return [externalStream(`${MOVIE_BASE_URL}/${id}`)];
}

function seriesStream(id) {
    const match = SERIES_ID.exec(id);
    if (!match) return [];

    const [, seriesId, season, episode] = match;
    return [externalStream(`${TV_BASE_URL}/${seriesId}/${season}/${episode}?autoPlay=true`)];
}

module.exports = {
    id: "vidcore",
    name: "Vidcore",

    async getStreams({ type, id }) {
        if (!id) return [];

        if (type === "movie") return movieStream(id);
        if (type === "series") return seriesStream(id);

        return [];
    }
};
