var maven = require('./maven');
var dependencies = require('./dependecies');
var logger = require('./logger');
var paths = require('./paths');
var args = require('./args');
var fs = require('fs');
var ModuleSpec = require('@jenkins-cd/js-modules/js/ModuleSpec');
var cwd = process.cwd();
var templates = require('./templates');
var exportModuleTemplate = templates.getTemplate('export-module.hbs');
var child_process = require('child_process');

exports.INTERNAL_REQUIRE_FUNC_NAME = '___jenkins_internalJsRequire';

exports.bundleFor = function(builder, packageName, forceBundle) {
    var packageSpec = new ModuleSpec(packageName);

    if (!packageSpec.getLoadBundleFileNamePrefix()) {
        logger.logInfo('Not create Jenkins adjunct based external module bundle for package "' + packageName + '". Is using a non-specific version name.');
        return undefined;
    }

    var extVersionMetadata = dependencies.externalizedVersionMetadata(packageSpec.moduleName);
    
    if (!extVersionMetadata) {
        throw new Error('Unable to create Jenkins adjunct based external module bundle for package "' + packageName + '". This package is not installed, or is not a declared dependency.');
    }

    var normalizedPackageName = extVersionMetadata.normalizedPackageName;
    var jsModuleNames = extVersionMetadata.jsModuleNames;
    var installedVersion = extVersionMetadata.installedVersion;
    var inDir = 'target/classes/org/jenkins/ui/jsmodules/' + normalizedPackageName;

    if (forceBundle === undefined && args.isArgvSpecified('--forceBundle')) {
        forceBundle = true;
    }

    if (forceBundle || args.isArgvSpecified('--forceBundleGen') || !fs.existsSync(cwd + '/' + inDir + '/' + jsModuleNames.filenameFor(installedVersion) + '.js')) {
        // We need to generate an adjunct bundle for the package.
        var bundleSrc = generateBundleSrc(extVersionMetadata);
        builder.bundle(bundleSrc, packageName + '@' + installedVersion.asBaseVersionString())
            .inDir(inDir)
            .ignoreGlobalExportMappings()
            .noEmptyModuleExport();
    } else {
        // The bundle has already been generated. No need to do it again.
        // For linked modules ... do an rm -rf of the target dir ... sorry :)
        logger.logInfo('Bundle for "' + packageName + '" already created. Delete "target" directory and run bundle again to recreate.');
    }

    return extVersionMetadata.importAs();
};

function generateBundleSrc(extVersionMetadata) {
    var packageName = extVersionMetadata.packageName;
    var normalizedPackageName = extVersionMetadata.normalizedPackageName;
    var jsModuleNames = extVersionMetadata.jsModuleNames;
    var depVersion = extVersionMetadata.depVersion;
    var jsFiles = getPackageFiles(extVersionMetadata);
    var srcContent = '';

    // remove the first entry in the list because it's actually
    // the package version. It's there because it needs to get serialized
    // and we did not add it as a property simply so as to keep diffs simple.
    jsFiles.shift();

    srcContent += "//\n";
    srcContent += "// NOTE: This file is generated and should NOT be added to source control.\n";
    srcContent += "//\n";
    srcContent += "\n";
    srcContent += exportModuleTemplate({
        packageName: packageName,
        normalizedPackageName: normalizedPackageName,
        jsModuleNames: jsModuleNames,
        jsFiles: jsFiles,
        internalRequireFuncName: exports.INTERNAL_REQUIRE_FUNC_NAME
    });
    
    var bundleSrcDir = 'target/js-bundle-src';
    
    paths.mkdirp(bundleSrcDir);
    
    var bundleSrcFile = bundleSrcDir + '/' + jsModuleNames.filenameFor(depVersion) + '.js';
    fs.writeFileSync(cwd +  '/' + bundleSrcFile, srcContent);
    return bundleSrcFile;
}

function getPackageFiles(extVersionMetadata) {
    var packageName = extVersionMetadata.packageName;
    var packageDir = extVersionMetadata.packageDir;
    var installedVersion = extVersionMetadata.installedVersion.raw;
    var packagesDir = './npm-pkg-manifests/';

    // Resolving this list of files can be heavy duty so we do not want to be doing it
    // for every run of the build. For that reason, we keep a record of them as part of
    // the source. Lets see if we have that and if it's the right version etc.
    // Generate/regenerate if not.
    var packageFilesFile = packagesDir + extVersionMetadata.normalizedPackageName + '.json';
    if (fs.existsSync(packageFilesFile)) {
        var packageFilesFileList = JSON.parse(fs.readFileSync(packageFilesFile, 'utf8'));

        // The first entry in the list is the version. We use a list so as to maintain
        // order Vs having weird diffs as can happen if using a map.
        var version = packageFilesFileList[0];
        if (version === installedVersion) {
            // Same version, therefore we can use this list i.e. no need to go through
            // the possibly lengthy process of figuring it out.
            return packageFilesFileList;
        }
        logger.logInfo('*** Regenerating NPM package manifest file ' + packageFilesFile);
    } else {
        logger.logInfo('*** Generating NPM package manifest file ' + packageFilesFile);
    }
    logger.logInfo('\tthis can take a bit of time so sit tight !!! ...');
    logger.logInfo('\t(once completed, be sure to commit the file to source)');

    // Okay, we need to figure it out.
    var startMillis = Date.now();
    var jsFiles = [];

    function isBundleable(jsFile) {
        // let's make sure it's a bundleable commonjs module
        try {
            var result = child_process.spawnSync('./node_modules/.bin/browserify', [jsFile]);
            return (result.status === 0);
        } catch (e) {
            // ignore that file
        }
        return false;
    }

    paths.walkDirs(packageDir, function(dir) {
        var relDirPath = dir.replace(packageDir, '');

        // Do not go into the node_modules dir
        if (relDirPath === '/node_modules') {
            return false;
        } else if (relDirPath.charAt(0) === '/') {
            relDirPath = relDirPath.substring(1);
        }

        if (relDirPath.length > 0) {
            relDirPath += '/';
        }

        var files = fs.readdirSync(dir);
        if (files) {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.endsWith('.js') || file.endsWith('.jsx')) {
                    if (isBundleable(dir + '/' + file)) {
                        jsFiles.push(packageName + '/' + relDirPath + file);
                    }
                }
            }
        }
    });

    // Sort the files so as to ensure they always appear in the same order
    // in the source, maintaining diffs.
    jsFiles.sort();

    // Add the version as the first entry in the list. See earlier block and how
    // this is used in subsequent builds.
    jsFiles = [installedVersion].concat(jsFiles);

    // And cache the list in the source tree so we can use it later.
    if (!fs.existsSync(packagesDir)) {
        paths.mkdirp(packagesDir);
        // Write a simple readme.
        fs.writeFileSync(packagesDir + '/README.md', fs.readFileSync(__dirname + '/templates/npm-packages.md', 'utf8'), 'utf8');
    }
    fs.writeFileSync(packageFilesFile, JSON.stringify(jsFiles, undefined, 2), 'utf8');

    var endMillis = Date.now();
    logger.logInfo('\tdone ... took ' + (endMillis - startMillis) + ' ms.');

    return jsFiles;
}