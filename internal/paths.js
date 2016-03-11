var logger = require('./logger');
var maven = require('./maven');
var path = require('path');
var fs = require('fs');
var cwd = process.cwd();

if (maven.isMavenProject) {
    exports.srcPaths = ['src/main/js','src/main/less'];
    exports.testSrcPath = 'src/test/js';    
} else {
    exports.srcPaths = ['./js', './less'];
    exports.testSrcPath = './spec';    
}

/**
 * Get the parent directory of the supplied file/directory.
 * @param file The file/directory.
 * @returns The parent directory.
 */
exports.parentDir = function(file) {
    return path.dirname(file);
};

/**
 * Find the jenkins-js-extension.yaml file in the src paths.
 */
exports.findExtensionsYAMLFile = function() {
    for (var i = 0; i < exports.srcPaths.length; i++) {
        var srcPath = path.resolve(cwd, exports.srcPaths[i]);
        var extFile = path.resolve(srcPath, 'jenkins-js-extension.yaml');
        if (fs.existsSync(extFile)) {
            return extFile;
        }
    }
    
    return undefined;
};

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

/**
 * Create the directory path, including missing parent dirs.
 * <p>
 * Equivalent to <code>mkdir -p</code>.
 * 
 * @param thePath The dir path to create.
 */
exports.mkdirp = function(thePath) {
    if (!path.isAbsolute(thePath)) {
        thePath = path.resolve(cwd, thePath);
    }
    if (!fs.existsSync(thePath)) {
        var parentDir = path.dirname(thePath);
        if (!fs.existsSync(parentDir)) {
            exports.mkdirp(parentDir);
        }
        fs.mkdirSync(thePath);
    }
};

/**
 * Do files with the specified extension exist in any of the src directories.
 */
exports.hasSourceFiles = function(ext) {
    var glob = require('glob');
    var hasFiles = false;
    var options = {
        nodir: true
    };

    function _hasFiles(path) {
        var files = glob.sync(path + "**/*." + ext, options);
        hasFiles = (files && files.length > 0);
    }

    for (var i = 0; hasFiles === false && i < exports.srcPaths.length; i++) {
        _hasFiles(exports.srcPaths[i]);
    }
    if (hasFiles === false) {
        _hasFiles(exports.testSrcPath);
    }
    
    return hasFiles;
};

/**
 * Search back through the directory hierarchy looking for the named file,
 * starting at the {@code startDir}, or the current working directory if
 * not {@code startDir} is not specific.
 * @param fileName The file name to look for.
 * @param startDir The directory to start looking from.
 * @returns The closest directory containing the file, or {@code undefined} if no
 * such file was found in the hierarchy.
 */
exports.findClosest = function(fileName, startDir) {
    var lookInDir = (startDir || cwd);
    var existsCheckPath = path.resolve(lookInDir, fileName);
    
    if (fs.existsSync(existsCheckPath)) {
        return existsCheckPath;
    }
    
    var parentDir = exports.parentDir(lookInDir);
    if (parentDir && parentDir !== lookInDir) {
        return exports.findClosest(fileName, parentDir);
    }
    
    return undefined;
};