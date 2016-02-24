var fs = require('fs');
var cwd = process.cwd();
var packageJson = require(cwd + '/package.json');

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
    return (exports.getDependency('jenkins-js-modules') !== undefined);
};

exports.hasJenkinsJsExtensionsDep = function() {
    return (exports.getDependency('jenkins-js-extensions') !== undefined);
};

exports.exitOnMissingDependency = function(depName, message) {
    if (!message) {
        message = 'Missing required NPM dependency.';
    }
    exports.logError(message + '\n\t- You must install the ' + depName + ' NPM package i.e. npm install --save ' + depName);
    process.exit(1);
};

exports.assertHasJenkinsJsModulesDependency = function(message) {
    if(!exports.hasJenkinsJsModulesDep()) {
        exports.exitOnMissingDependency('jenkins-js-modules', message);
    }
};

exports.assertHasJenkinsJsExtensionsDependency = function(message) {
    if(!exports.hasJenkinsJsExtensionsDep()) {
        exports.exitOnMissingDependency('jenkins-js-extensions', message);
    }
};
