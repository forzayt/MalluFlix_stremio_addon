/*
 * Stream sources. Every file exports:
 *   { id, name, getStreams({ type, id }) -> Promise<stream[]> }
 * Add new sources here to make them available for every title, not just the
 * MalluFlix catalogs.
 */

module.exports = [
    require("./vidcore")
];
