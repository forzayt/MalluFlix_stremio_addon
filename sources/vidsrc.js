const { createEmbedSource } = require("./embed");

// https://vidsrc.sh/
module.exports = createEmbedSource({
    id: "vidsrc",
    name: "Vidsrc",
    movieBaseUrl: process.env.VIDSRC_MOVIE_BASE_URL || "https://vidsrc.sh/movie",
    seriesBaseUrl: process.env.VIDSRC_TV_BASE_URL || "https://vidsrc.sh/tv",
    movieParams: { autoPlay: "true" },
    seriesParams: { autoPlay: "true" }
});
