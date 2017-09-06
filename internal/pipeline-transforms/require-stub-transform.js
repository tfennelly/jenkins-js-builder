/**
 * A Buffer transform that consumes a js-modules bundle and rewrites the
 * bundle map entries (source stubs and deps) to get the module export from
 * js-modules.
 */

var through = require('through2');
var unpack = require('browser-unpack');
var browserifyTree = require('browserify-tree');
var ModuleSpec = require('@jenkins-cd/js-modules/js/ModuleSpec');
var logger = require('../logger');
var cwd = process.cwd();
var pathPrefix = cwd + '/';
var node_modules_path = cwd + '/node_modules/';
var args = require('../args');
var paths = require('../paths');
var maven = require('../maven');
var adjunctexternal = require('../adjunctexternal');
var templates = require('../templates');
var doImportPackEntrySourceTemplate = templates.getTemplate('doImport-pack-entry-source.hbs');
var moduleRequireTemplate = templates.getTemplate('module-require.hbs');

function pipelinePlugin(bundleDef, bundleOutFile) {
    return through.obj(function (bundle, encoding, callback) {
        if (!(bundle instanceof Buffer)) {
            callback(new Error('Sorry, this transform only supports Buffers.'));
            return;
        }

        var bundleContent = bundle.toString('utf8');
        var packEntries  = unpack(bundleContent);

        var metadata = updateBundleStubs(packEntries, bundleDef.moduleMappings, true);
        metadata = fullPathsToTruncatedPaths(metadata);
        var bundleInfo = {
            jsModulesId: bundleDef.asModuleSpec.importAs(),
            created: Date.now(),
            jsBuilderVer: getBuilderVersion()
        };
        if (maven.isHPI()) {
            bundleInfo.hpiPluginId = maven.getArtifactId();
        }
        bundleInfo.moduleDefs = metadata.modulesDefs;

        // Dump data that can be used by tooling.
        // .json file can't be loaded as an adjunct (ffs :) )
        paths.mkdirp(paths.parentDir(bundleOutFile));
        require('fs').writeFileSync(bundleOutFile + '-info.js', JSON.stringify(bundleInfo));
        require('fs').writeFileSync(bundleOutFile + '-packEntries.js', JSON.stringify(metadata.packEntries));

        // We told updateBundleStubs (above) to skipFullPathToIdRewrite,
        // so we need to do that before going further.
        if (!args.isArgvSpecified('--full-paths')) {
            fullPathsToIds(metadata);
        }

        this.push(JSON.stringify(packEntries));
        callback();
    });
}

function updateBundleStubs(packEntries, moduleMappings, skipFullPathToIdRewrite) {
    var metadata = extractBundleMetadata(packEntries);
    var jsModulesPackEntry = metadata.getJSModulesPackEntry();

    if (!jsModulesPackEntry) {
        // If @jenkins-cd/js-modules is not present in the pack, then
        // the earlier require transformers must not have found require
        // statements for the modules defined in the supplied moduleMappings.
        // In that case, nothing to be done so exit out.
    } else {
        for (var i = 0; i < moduleMappings.length; i++) {
            var moduleMapping = moduleMappings[i];
            var toSpec = new ModuleSpec(moduleMapping.to);
            var importAs = toSpec.importAs();

            if (!moduleMapping.fromSpec) {
                moduleMapping.fromSpec = new ModuleSpec(moduleMapping.from);
            }

            mapByPackageName(moduleMapping.fromSpec.moduleName, importAs);

            // And check are there aliases that can be mapped...
            if (moduleMapping.config && moduleMapping.config.aliases) {
                var aliases = moduleMapping.config.aliases;
                var newSource = "module.exports = require('@jenkins-cd/js-modules').requireModule('" + importAs + "');";
                for (var ii = 0; ii < aliases.length; ii++) {
                    mapByNodeModulesPath(aliases[ii], importAs, newSource, {
                        '@jenkins-cd/js-modules': jsModulesPackEntry.id
                    });
                }
            }
        }

        // Add the doImport pack entry to the bundle.
        var doImportPackEntry = {
            id: '____jenkins_doImport',
            source: doImportPackEntrySourceTemplate({
                internalRequireFuncName: adjunctexternal.INTERNAL_REQUIRE_FUNC_NAME
            }),
            deps: {
                '@jenkins-cd/js-modules': jsModulesPackEntry.id
            }
        };
        metadata.packEntries.push(doImportPackEntry);
        metadata.modulesDefs['____jenkins_doImport'] = {
            id: '____jenkins_doImport'
        };
    }

    function mapByPackageName(packageName, packageId) {
        var packEntries = metadata.getPackEntriesByName(packageName);
        if (packEntries.length > 0) {
            for (var i = 0; i < packEntries.length; i++) {
                var packEntry = packEntries[i];
                var moduleDef = metadata.getModuleDefById(packEntry.id);
                if (moduleDef) {
                    var newSource = moduleRequireTemplate({
                        packageId: packageId,
                        moduleName: moduleDef.node_module
                    });
                    setPackSource(packEntry, packageId, newSource, {
                        '____jenkins_doImport': '____jenkins_doImport'
                    });
                }
            }
        } else {
            // This can happen if the pack with that ID was already removed
            // because it's no longer being used (has nothing depending on it).
            // See removeDependant and how it calls removePackEntryById.
        }
    }
    function mapByNodeModulesPath(node_modules_path, importModule, newSource, deps) {
        var packEntry = metadata.getPackEntriesByNodeModulesPath(node_modules_path);
        if (packEntry) {
            setPackSource(packEntry, importModule, newSource, deps);
        }
    }
    function setPackSource(packEntry, importModule, newSource, deps) {
        var moduleDef = metadata.modulesDefs[packEntry.id];

        if (moduleDef) {
            var originalDeps = packEntry.deps;

            packEntry.source = newSource;
            packEntry.deps = deps;

            // Mark the moduleDef with info that helps us recognise that it
            // was stubbed.
            moduleDef.stubbed = {
                importModule: importModule
            };
            moduleDef.size = packEntry.source.length;
            // console.log('**** stubbing ' + packEntry.id + ' to import ' + importModule, moduleDef);

            // Need to look at all the original dependencies and
            // remove them if nothing else is depending on them.
            removeUnusedDeps(metadata, originalDeps);
        }
    }

    // Scan the bundle again now and remove all unused stragglers.
    const unusedModules = browserifyTree.getUnusedModules(metadata.packEntries);
    unusedModules.forEach(function(moduleId) {
        if (!hasDeps(moduleId, metadata, unusedModules)) {
            removePackEntryById(metadata, moduleId);
        }
    });

    verifyDepsOkay(metadata);

    if (!skipFullPathToIdRewrite && !args.isArgvSpecified('--full-paths')) {
        metadata = fullPathsToIds(metadata);
    }

    // Keeping as it's handy for debug purposes.
    //require('fs').writeFileSync('./target/bundlepack.json', JSON.stringify(packEntries, undefined, 4));

    return metadata;
}

function verifyDepsOkay(metadata) {
    for (var i in metadata.packEntries) {
        var packEntry = metadata.packEntries[i];

        for (var module in packEntry.deps) {
            if (packEntry.deps.hasOwnProperty(module)) {
                var entryDepId = packEntry.deps[module];
                if (!metadata.modulesDefs[entryDepId]) {
                    console.log('[WARNING] Unexpected bundling error: packEntry ' + packEntry.id + ' depends on ' + entryDepId + ' but there is no moduleDef for that.');
                }
            }
        }
    }
}

function hasDeps(moduleName, metadata, ignoring) {
    for (var i in metadata.packEntries) {
        var packEntry = metadata.packEntries[i];

        if (ignoring && ignoring.indexOf(packEntry.id)) {
            // Don't include this pack entry
            // as one to check.
            continue;
        }

        for (var module in packEntry.deps) {
            if (packEntry.deps.hasOwnProperty(module)) {
                var entryDepId = packEntry.deps[module];
                if (entryDepId === moduleName) {
                    // this pack depends on that module.
                    return packEntry.id;
                }
            }
        }
    }
    return undefined;
}

function extractBundleMetadata(packEntries) {
    var modulesDefs = extractModuleDefs(packEntries);
    var metadata = {
        packEntries: packEntries,
        modulesDefs: modulesDefs,
        getPackEntryById: function(id) {
            return getPackEntryById(this.packEntries, id);
        },
        getJSModulesPackEntry: function() {
            return getJSModulesPackEntry(this);
        },
        getPackEntriesByName: function(name) {
            return getPackEntriesByName(this, name);
        },
        getPackEntriesByNodeModulesPath: function(node_modules_path) {
            return getPackEntriesByNodeModulesPath(this, node_modules_path);
        },
        getModuleDefById: function(id) {
            return modulesDefs[id];
        },
        getModuleDefByName: function(name) {
            return modulesDefs[name];
        }
    };

    addKnownAsToDefs(metadata);

    return metadata;
}

function extractModuleDefs(packEntries) {
    var modulesDefs = {};

    // Create a moduleDef for each pack entry
    for (var i = 0; i < packEntries.length; i++) {
        var packEntry = packEntries[i];
        var modulePath = packEntry.id;
        var moduleDef = {
            id: modulePath,
            entry: packEntry.entry,
            packageInfo: getPackageInfoFromModulePath(modulePath),
            knownAs: [],
            size: packEntry.source.length,
            isKnownAs: function(name) {
                // Note that we need to be very careful about how we
                // use this. Relative module names may obviously
                // resolve to different pack entries, depending on
                // the context,
                return (this.knownAs.indexOf(name) !== -1);
            }
        };

        if (typeof modulePath === 'string') {
            moduleDef.node_module = nodeModulesRelPath(modulePath);
        }

        modulesDefs[modulePath] = moduleDef;
    }

    return modulesDefs;
}

function getPackageInfoFromModulePath(modulePath) {
    if (typeof modulePath === 'string') {
        var packageJsonFile = paths.findClosest('package.json', paths.parentDir(modulePath));
        if (packageJsonFile) {
            var packageJson = require(packageJsonFile);
            return {
                name: packageJson.name,
                version: packageJson.version,
                path: toRelativePath(paths.parentDir(packageJsonFile)),
                repository: packageJson.repository,
                gitHead: packageJson.gitHead
            };
        }
    }
    return undefined;
}

function addKnownAsToDefs(metadata) {
    for (var i = 0; i < metadata.packEntries.length; i++) {
        var packEntry = metadata.packEntries[i];

        for (var module in packEntry.deps) {
            if (packEntry.deps.hasOwnProperty(module)) {
                var entryDepId = packEntry.deps[module];
                var moduleDef = metadata.modulesDefs[entryDepId];
                if (!moduleDef || moduleDef.entry) {
                    continue;
                }
                if (moduleDef.knownAs.indexOf(module) === -1) {
                    moduleDef.knownAs.push(module);
                }
            }
        }
    }
}

function nodeModulesRelPath(absoluteModulePath) {
    if (absoluteModulePath.indexOf(node_modules_path) === 0) {
        return absoluteModulePath.substring(node_modules_path.length);
    }
    return absoluteModulePath;
}

function getPackEntryById(packEntries, id) {
    for (var i in packEntries) {
        if (packEntries[i].id.toString() === id.toString()) {
            return packEntries[i];
        }
    }
    return undefined;
}

function getJSModulesPackEntry(metadata) {
    var packEntries = getPackEntriesByName(metadata, '@jenkins-cd/js-modules');

    for (var i = 0; packEntries.length; i++) {
        var packEntry = packEntries[i];
        var modulesDef = metadata.modulesDefs[packEntry.id];

        if (modulesDef.isKnownAs('@jenkins-cd/js-modules')) {
            return packEntry;
        }
    }

    return undefined;
}

function getPackEntriesByName(metadata, name) {
    var packEntries = [];

    for (var packId in metadata.modulesDefs) {
        if (metadata.modulesDefs.hasOwnProperty(packId)) {
            var modulesDef = metadata.modulesDefs[packId];
            if (modulesDef.packageInfo.name === name) {
                var packEntry = metadata.getPackEntryById(packId);
                if (packEntry) {
                    packEntries.push(packEntry);
                }
            }
        }
    }

    return packEntries;
}

function getPackEntriesByNodeModulesPath(metadata, node_modules_path) {
    for (var packId in metadata.modulesDefs) {
        if (metadata.modulesDefs.hasOwnProperty(packId)) {
            var modulesDef = metadata.modulesDefs[packId];
            if (modulesDef.node_module && (modulesDef.node_module === node_modules_path || modulesDef.node_module === node_modules_path + '.js')) {
                var packEntry = metadata.getPackEntryById(packId);
                if (packEntry) {
                    return packEntry;
                }
            }
        }
    }

    return undefined;
}

function removePackEntryById(metadata, id) {
    delete metadata.modulesDefs[id];
    for (var i = 0; i < metadata.packEntries.length; i++) {
        var packEntry = metadata.packEntries[i];
        if (packEntry.id.toString() === id.toString()) {
            // Remove that pack entry from the bundle.
            metadata.packEntries.splice(i, 1);
            // Need to look at all the dependencies of the remove
            // pack entry, and recursively remove any of them where
            // there's no longer anything depending on them.
            removeUnusedDeps(metadata, packEntry.deps);
            return;
        }
    }
}

function removeUnusedDeps(metadata, deps) {
    for (var dep in deps) {
        if (deps.hasOwnProperty(dep)) {
            var depId = deps[dep];
            if (!hasDeps(depId, metadata)) {
                // No longer anythying depending on it, so
                // remove it from the bundle
                removePackEntryById(metadata, depId);
            }
        }
    }
}

function fullPathsToTruncatedPaths(metadata) {
    for (var i in metadata.packEntries) {
        if (metadata.packEntries.hasOwnProperty(i)) {
            var packEntry = metadata.packEntries[i];
            var currentPackId = packEntry.id;
            var truncatedPackId = toRelativePath(currentPackId);

            mapDependencyId(currentPackId, truncatedPackId, metadata);
            packEntry.id = truncatedPackId;
        }
    }

    return metadata;
}

function fullPathsToIds(metadata) {
    var nextPackId = 1;

    for (var i in metadata.packEntries) {
        if (metadata.packEntries.hasOwnProperty(i)) {
            var packEntry = metadata.packEntries[i];
            var currentPackId = packEntry.id;

            mapDependencyId(currentPackId, nextPackId, metadata);
            packEntry.id = nextPackId;

            // And inc...
            nextPackId++;
        }
    }

    return metadata;
}

function toRelativePath(path) {
    if (path === cwd) {
        return '';
    } else if (path.indexOf(pathPrefix) === 0) {
        return path.substring(pathPrefix.length);
    }
    return path;
}

function mapDependencyId(from, to, metadata) {
    var dedupeSourceFrom = 'arguments[4]["' + from + '"][0].apply(exports,arguments)';
    var dedupeSourceTo;

    if (typeof to === 'number') {
        dedupeSourceTo = 'arguments[4][' + to + '][0].apply(exports,arguments)';
    } else {
        dedupeSourceTo = 'arguments[4]["' + to + '"][0].apply(exports,arguments)';
    }

    // Fixup the pack entries
    for (var i in metadata.packEntries) {
        if (metadata.packEntries.hasOwnProperty(i)) {
            var packEntry = metadata.packEntries[i];
            var packDeps = packEntry.deps;

            for (var dep in packDeps) {
                if (packDeps.hasOwnProperty(dep) && packDeps[dep] === from) {
                    packDeps[dep] = to;
                }
            }

            // Check the pack entry source for it being a dedupe,
            // translating it if required.
            if (packEntry.source === dedupeSourceFrom) {
                packEntry.source = dedupeSourceTo;
            }
        }
    }

    // Fixup the moduleDef
    var moduleDef = metadata.modulesDefs[from];
    if (moduleDef) {
        // Remove the moduleDef from the id it's currently known as.
        delete metadata.modulesDefs[from];
        // And reset the id 'to' the new id
        moduleDef.id = to;
        metadata.modulesDefs[to] = moduleDef;
    }
}

function listAllModuleNames(modulesDefs) {
    var names = [];

    for (var packId in modulesDefs) {
        if (modulesDefs.hasOwnProperty(packId)) {
            var modulesDef = modulesDefs[packId];
            for (var nameIdx in modulesDef.knownAs) {
                var name = modulesDef.knownAs[nameIdx];
                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            }
        }
    }

    return names;
}

function getBuilderVersion() {
    var path = require('path');
    var builderPackageJson = require(path.join(__dirname, '../../package.json'));
    return builderPackageJson.version;
}

exports.pipelinePlugin = pipelinePlugin;
exports.updateBundleStubs = updateBundleStubs;