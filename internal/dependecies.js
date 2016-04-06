var fs = require('fs');
var cwd = process.cwd();
var packageJson = require(cwd + '/package.json');
var logger = require('./logger');

exports.getDependency = function(depName) {
    function findDep(onDepMap) {
        if (onDepMap) {
            return onDepMap[depName];
        }
        return undefined;
    }
    
    var version = findDep(packageJson.dependencies);
    if (version) {
        return {
            type: 'runtime',
            version: version
        };
    } else {
        version = findDep(packageJson.devDependencies);
        if (version) {
            return {
                type: 'dev',
                version: version
            };
        } else {
            version = findDep(packageJson.peerDependencies);
            if (version) {
                return {
                    type: 'peer',
                    version: version
                };
            }
            // TODO: bundled and optional deps?
        }
    }
    
    return undefined;
};

exports.hasJenkinsJsModulesDep = function() {
    return (exports.getDependency('@jenkins-cd/js-modules') !== undefined);
};

exports.hasJenkinsJsExtensionsDep = function() {
    return (exports.getDependency('@jenkins-cd/js-extensions') !== undefined);
};

exports.exitOnMissingDependency = function(depName, message) {
    if (!message) {
        message = 'Missing required NPM dependency.';
    }
    logger.logError(message + '\n\t- You must install the ' + depName + ' NPM package i.e. "npm install --save ' + depName + '" (use "--save-dev" to add as a devDependency)');
    process.exit(1);
};

exports.warnOnMissingDependency = function(depName, message) {
    if (exports.getDependency(depName)) {
        // It's there.
        return;
    }
    if (!message) {
        message = 'Missing NPM dependency "' + depName + '" (may be required).';
    }
    logger.logWarn(message + '\n\t- To install the ' + depName + ' NPM package, run "npm install --save ' + depName + '" (use "--save-dev" to add as a devDependency)');
};

exports.assertHasJenkinsJsModulesDependency = function(message) {
    if(!exports.hasJenkinsJsModulesDep()) {
        exports.exitOnMissingDependency('@jenkins-cd/js-modules', message);
    }
};

exports.assertHasJenkinsJsExtensionsDependency = function(message) {
    if(!exports.hasJenkinsJsExtensionsDep()) {
        exports.exitOnMissingDependency('@jenkins-cd/js-extensions', message);
    }
};

exports.processExternalizedDependencies = function(builder) {
    if (packageJson.jenkinscd && packageJson.jenkinscd.extDependencies) {
        var extDependencies = packageJson.jenkinscd.extDependencies;
        if (extDependencies.length) {
            for (var i = 0; i < extDependencies.length; i++) {
                builder.withExternalModuleMapping(extDependencies[i]);
            }
        }
    }
};
