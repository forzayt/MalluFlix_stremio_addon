const { createEmbedSource } = require("./embed");

module.exports = createEmbedSource({
    id: "vidcore",
    name: "Vidcore",
    movieBaseUrl: process.env.VIDCORE_MOVIE_BASE_URL || "https://vidcore.io/movie",
    seriesBaseUrl: process.env.VIDCORE_TV_BASE_URL || "https://vidcore.io/tv",
    movieParams: { autoPlay: "true" },
    seriesParams: { autoPlay: "true" }
});
