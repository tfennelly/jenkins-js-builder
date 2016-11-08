var fs = require('fs');
var cwd = process.cwd();
var paths = require('./paths');
var path = require('path');
var node_modules = path.resolve(cwd, 'node_modules');
var packageJson = require(cwd + '/package.json');
var logger = require('./logger');
var ModuleSpec = require('@jenkins-cd/js-modules/js/ModuleSpec');
var Version = require('@jenkins-cd/js-modules/js/Version');

exports.getDependency = function(depName) {
    return getDependency(depName, packageJson);
};

exports.getPackageJson = function(packageName) {
    var packageInstallDir = path.resolve(node_modules, packageName);
    var packageJsonFile = path.resolve(packageInstallDir, 'package.json');

    if (fs.existsSync(packageJsonFile)) {
        return require(packageJsonFile);
    }

    return undefined;
};

exports.getDefinedDependantsOf = function(packageName, scopes) {
    var dependants = [];

    if (!scopes) {
        scopes = ['dependencies', 'peerDependencies'];
    } else if (typeof scopes === 'string') {
        scopes = [scopes];
    }

    // Go through all of the deps in the defined scopes, getting their
    // package.json and then iterating those same scopes to see can we find
    // depepdencies on packageName. See inner loop.
    scopes.forEach(function(scope) {
        var depMap = packageJson[scope];
        if (depMap) {
            for (var depPackageName in depMap) {
                if (depMap.hasOwnProperty(depPackageName)) {
                    var depPackageJson = exports.getPackageJson(depPackageName);

                    // Now, go through the package.json of the dependency and
                    // check if it has a dependency on packageName in any of the
                    // defined scopes.
                    for (var i = 0; i < scopes.length; i++) {
                        var depScope = scopes[i];
                        var depDepMap = depPackageJson[depScope];
                        if (depDepMap && depDepMap[packageName]) {
                            dependants.push(new ModuleSpec(depPackageJson.name + '@' + depPackageJson.version));
                            break;
                        }
                    }
                }
            }
        }
    });

    return dependants;
};

exports.getInstalledDependantsOf = function(packageName) {
    var dependants = [];

    // Walk the node_modules dir. We might need to walk down 2 levels in the tree
    // so as to accommodate organization packages .
    paths.walkDirs(node_modules, function(dir) {
        if (dir === node_modules) {
            return true;
        }

        var packageJsonFile = path.resolve(dir, 'package.json');
        if (fs.existsSync(packageJsonFile)) {
            var packageJson = require(packageJsonFile);
            if (getDependency(packageName, packageJson) !== undefined) {
                dependants.push(new ModuleSpec(packageJson.name + '@' + packageJson.version));
            }
        } else if (path.basename(dir).charAt(0) === '@') {
            // The dir does not contain a package.json, but it's name
            // has an organization prefix (i.e. '@' prefix on the dir).
            // In that case, we allow it to recurse down to the next
            // level in the tree.
            return true;
        }
        // Don't recurse down into the parent dir. See above block for exception.
        return false;
    }, 2); // max depth of 2 so as to allow us accommodate organization packages.

    return dependants;
};

exports.hasJenkinsJsModulesDep = function() {
    return (exports.getDependency('@jenkins-cd/js-modules') !== undefined);
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

exports.processExternalizedDependencies = function(builder) {
    if (packageJson.jenkinscd) {
        var imports = packageJson.jenkinscd.import;

        if (!imports && packageJson.jenkinscd.extDependencies) {
            imports = packageJson.jenkinscd.extDependencies;
            logger.logWarn('DEPRECATED use of jenkinscd.extDependencies in package.json. Change to jenkinscd.import.');
        }

        if (imports) {
            for (var i = 0; i < imports.length; i++) {
                var theImport = imports[i];
                if (typeof theImport === 'object') {
                    builder.import(theImport.name, theImport);
                } else {
                    builder.import(theImport);
                }
            }
        }
        var exports = packageJson.jenkinscd.export;
        if (exports) {
            for (var i = 0; i < exports.length; i++) {
                builder.export(exports[i]);
            }
        }
    }
};

/**
 * Get the externalized package metadata for the named NPM dependency.
 * @param depPackageName The NPM dependency package name.
 */
exports.externalizedVersionMetadata = function(depPackageName) {
    var packageDir = cwd + '/node_modules/' + depPackageName;
    var packageJsonFile = packageDir + '/package.json';
    
    if (!fs.existsSync(packageJsonFile)) {
        return undefined;
    }

    var packageJson = require(packageJsonFile);
    
    var metadata = {};
    var declaredDepVersion = exports.getDependency(depPackageName);

    if (!declaredDepVersion) {
        return undefined;
    }

    metadata.packageName = depPackageName;
    metadata.packageDir = packageDir;
    metadata.installedVersion = new Version(packageJson.version);
    metadata.depVersion = new Version(declaredDepVersion.version);
    metadata.normalizedPackageName = exports.normalizePackageName(depPackageName);
    metadata.jsModuleNames = mmpModuleNames(metadata.normalizedPackageName, metadata.installedVersion);
    metadata.importAs = function (scope) {
        var scopedName;
        if (scope) {
            scopedName = metadata.jsModuleNames[scope];
            if (!scopedName) {
                throw new Error('Unknown scope "' + scope + '".');
            }
        } else {
            scopedName = metadata.jsModuleNames.nameFor(metadata.depVersion);
        }

        return metadata.normalizedPackageName + ':' + scopedName;
    };
    
    return metadata;
};

/**
 * Normalize an NPM package name by removing all non alpha numerics and replacing
 * with hyphens.
 * @param packageName The NPM package name.
 * @returns The normalized NPM package name.
 */
exports.normalizePackageName = function(packageName) {
    packageName = packageName.replace(/[^\w.]/g, "-"); // replace non alphanumerics.
    if (packageName.charAt(0) === '-') {
        packageName = packageName.substring(1);
    }
    return packageName;
};

function getDependency(depName, packageJson) {
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
        }
    }

    return undefined;
}

/**
 * Create major, minor and patch (version) module names that can
 * then be used in the .js generation and module exporting. 
 * @param normalizedPackageName The normalized NPM package name.
 * @param fullVersion The full version of the installed NPM package.
 */
function mmpModuleNames(normalizedPackageName, fullVersion) {
    return {
        any: normalizedPackageName + '@any',
        major: normalizedPackageName + '@' + fullVersion.major + '.x',
        minor: normalizedPackageName + '@' + fullVersion.major + '.' + fullVersion.minor + '.x',
        patch: normalizedPackageName + '@' + fullVersion.major + '.' + fullVersion.minor + '.' + fullVersion.patch,
        nameFor: function (depVersion) {
            if (depVersion.minor === 'x') {
                return this.major;
            } else if (depVersion.patch === 'x') {
                return this.minor;
            } else {
                return this.patch;
            }
        },
        filenameFor: function (depVersion) {
            if (depVersion.minor === 'x') {
                return normalizedPackageName + '-' + fullVersion.major + '-x';
            } else if (depVersion.patch === 'x') {
                return normalizedPackageName + '-' + fullVersion.major + '-' + fullVersion.minor + '-x';
            } else {
                return normalizedPackageName + '-' + fullVersion.major + '-' + fullVersion.minor + '-' + fullVersion.patch;
            }
        }
    };
}