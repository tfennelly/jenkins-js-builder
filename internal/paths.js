var logger = require('./logger');
var maven = require('./maven');
var path = require('path');
var cwd = process.cwd();

if (maven.isMavenProject) {
    exports.srcPaths = ['src/main/js','src/main/less'];
    exports.testSrcPath = 'src/test/js';    
} else {
    exports.srcPaths = ['./js', './less'];
    exports.testSrcPath = './spec';    
}

/**
 * Get the absolute path to the javascript src root directory.
 */
exports.getAbsoluteJSRoot = function() {
    // The assumption is that the first srcPaths is the one
    // we're interested in :)
    return path.resolve(cwd, exports.srcPaths[0]);
};

/**
 * Get the absolute path to a resource within the javascript root directory.
 * @param jsPath The path to the resource, relative to the javascript src
 * root directory.
 */
exports.toAbsoluteJSPath = function(jsPath) {
    return path.resolve(exports.getAbsoluteJSRoot(), jsPath);
};