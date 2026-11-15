const { createEmbedSource } = require("./embed");

// https://vidfast.vc/
module.exports = createEmbedSource({
    id: "vidfast",
    name: "VidFast",
    movieBaseUrl: process.env.VIDFAST_MOVIE_BASE_URL || "https://vidfast.vc/movie",
    seriesBaseUrl: process.env.VIDFAST_TV_BASE_URL || "https://vidfast.vc/tv",
    movieParams: { autoPlay: "true" },
    seriesParams: { autoPlay: "true" }
});
