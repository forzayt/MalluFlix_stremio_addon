/*
 * Shared factory for embed-style stream sources (Vidcore, VidFast, VidNest,
 * Vidsrc, VixSrc, ...). Each one returns an external player URL for a title:
 *   movie  -> {baseUrl}/movie/{imdbId}
 *   series -> {baseUrl}/tv/{imdbId}/{season}/{episode}
 * Extra query parameters (autoplay, theme, ...) are configured per source.
 */

const MOVIE_ID = /^tt\d+$/;
const SERIES_ID = /^(tt\d+):(\d+):(\d+)$/;

const trimBase = (url) => String(url).replace(/\/+$/, "");

const withParams = (url, params) => {
    const query = new URLSearchParams(params || {}).toString();
    return query ? `${url}?${query}` : url;
};

function createEmbedSource({
    id,
    name,
    movieBaseUrl,
    seriesBaseUrl,
    movieParams = {},
    seriesParams = {}
}) {
    const movieBase = trimBase(movieBaseUrl);
    const seriesBase = trimBase(seriesBaseUrl || movieBaseUrl);

    return {
        id,
        name,
        hosts: { movie: movieBase, series: seriesBase },

        async getStreams({ type, id: mediaId }) {
            if (!mediaId) return [];

            if (type === "movie" && MOVIE_ID.test(mediaId)) {
                return [{
                    externalUrl: withParams(`${movieBase}/${mediaId}`, movieParams),
                    title: name
                }];
            }

            if (type === "series") {
                const match = SERIES_ID.exec(mediaId);
                if (!match) return [];

                const [, imdbId, season, episode] = match;
                return [{
                    externalUrl: withParams(
                        `${seriesBase}/${imdbId}/${season}/${episode}`,
                        seriesParams
                    ),
                    title: name
                }];
            }

            return [];
        }
    };
}

module.exports = { createEmbedSource };
