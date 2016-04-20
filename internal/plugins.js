/**
 * peer dependencies can define js-builder "plugins" by defining 
 * a @jenkins-cd/js-builder.js file.
 */

var paths = require('./paths');
var path = require('path');
var cwd = process.cwd();
var fs = require('fs');
var dependencies = require('./dependecies');
var logger = require('./logger');

exports.install = function(builder) {
    // Iterate over all of the installed node_modules. If a given dependency
    // is listed as a dependency of "this" package, then lets see if it has
    // a @jenkins-cd/js-builder.js file.
    
    paths.walkDirs(cwd + '/node_modules', function(dir) {
        var packageJsonFile = path.resolve(dir, 'package.json');
        if (fs.existsSync(packageJsonFile)) {
            try {
                var packageJson = require(packageJsonFile);
                if (dependencies.getDependency(packageJson.name)) {
                    var pluginFile = path.resolve(dir, '@jenkins-cd/js-builder.js');
                    if (fs.existsSync(pluginFile)) {
                        logger.logInfo('Running Jenkins js-builder plugin: ' + packageJson.name);
                        var plugin = require(pluginFile);
                        // The plugin impl can execute it's init code at the
                        // top level, or within an install function. Having an
                        // install function can simplify test implementation
                        // for the plugin by giving it some control over its
                        // lifecycle.
                        if (typeof plugin.install === 'function') {
                            plugin.install(builder);
                        }
                    }
                }
            } finally {
                return false; // Don't recurse down inside the top level NPM packages.
            }
        }
    });
};