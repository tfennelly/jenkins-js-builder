var maven = require('./maven');
var dependencies = require('./dependecies');
var logger = require('./logger');
var paths = require('./paths');
var fs = require('fs');
var ModuleSpec = require('@jenkins-cd/js-modules/js/ModuleSpec');
var cwd = process.cwd();
var templates = require('./templates');
var exportModuleTemplate = templates.getTemplate('export-module.hbs');
var child_process = require('child_process');

exports.INTERNAL_REQUIRE_FUNC_NAME = '___jenkins_internalJsRequire';

exports.bundleFor = function(builder, packageName) {
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
    
    if (!fs.existsSync(cwd + '/' + inDir + '/' + jsModuleNames.filenameFor(installedVersion) + '.js')) {
        // We need to generate an adjunct bundle for the package.
        var bundleSrc = generateBundleSrc(extVersionMetadata);
        builder.bundle(bundleSrc, packageName + '@' + installedVersion.asBaseVersionString())
            .inDir(inDir)
            .ignoreGlobalExportMappings()
            .doIgnoreMissing()
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
    var packageDir = extVersionMetadata.packageDir;
    var normalizedPackageName = extVersionMetadata.normalizedPackageName;
    var jsModuleNames = extVersionMetadata.jsModuleNames;
    var depVersion = extVersionMetadata.depVersion;
    var srcContent = '';
    var jsFiles = [];

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
                    jsFiles.push(packageName + '/' + relDirPath + file);
                }
            }
        }
    });

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