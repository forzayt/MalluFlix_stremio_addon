const { createEmbedSource } = require("./embed");

// https://vidnest.fun/
module.exports = createEmbedSource({
    id: "vidnest",
    name: "VidNest",
    movieBaseUrl: process.env.VIDNEST_MOVIE_BASE_URL || "https://vidnest.fun/movie",
    seriesBaseUrl: process.env.VIDNEST_TV_BASE_URL || "https://vidnest.fun/tv",
    movieParams: { autoPlay: "true" },
    seriesParams: { autoPlay: "true" }
});
