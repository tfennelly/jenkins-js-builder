var maven = require('./maven');
var dependencies = require('./dependecies');
var logger = require('./logger');
var paths = require('./paths');
var fs = require('fs');
var cwd = process.cwd();

exports.bundleFor = function(builder, packageName) {
    var packageJsonFile = cwd + '/node_modules/' + packageName + '/package.json';
    
    if (!fs.existsSync(packageJsonFile)) {
        throw 'Unable to create Jenkins adjunct based external module bundle for package "' + packageName + '". This package is not installed.';
    }

    var packageJson = require(packageJsonFile);
    var installedVersion = parseVersion(packageJson.version);
    var depVersion = parseVersion(dependencies.getDependency(packageName).version);
    var jsModuleNames = mmpModuleNames(packageName, installedVersion);
    var inDir = 'target/classes/org/jenkins/ui/jsmodules/' + packageName;
    
    if (!fs.existsSync(cwd + '/' + inDir + '/' + jsModuleNames.nameFor(depVersion) + '.js')) {
        // We need to generate an adjunct bundle for the package.
        var bundleSrc = generateBundleSrc(packageName, depVersion, jsModuleNames);
        builder.bundle(bundleSrc).inDir(inDir).namespace(packageName).noEmptyModuleExport().ignoreGlobalModuleMappings();
    } else {
        // The bundle has already been generated. No need to do it again.
        // For linked modules ... do an rm -rf of the target dir ... sorry :)
        logger.logInfo('Bundle for "' + packageName + '" already created. Delete "target" directory ad run bundle again to recreate.');
    }
    return packageName + ':' + jsModuleNames.nameFor(depVersion);
};

function generateBundleSrc(packageName, depVersion, jsModuleNames) {
    var srcContent = '';

    srcContent += "//\n";
    srcContent += "// NOTE: This file is generated and should NOT be added to source control.\n";
    srcContent += "//\n";
    srcContent += "\n";
    // Export for each compatible version scope of the installed package,
    // allowing it to be shared where compatible and so avoiding loading of
    // multiple versions of the same lib where possible.
    srcContent += "require('@jenkins-cd/js-modules').export('" + packageName + "', '" + jsModuleNames.patch + "', require('" + packageName + "'));\n";
    srcContent += "require('@jenkins-cd/js-modules').export('" + packageName + "', '" + jsModuleNames.minor + "', require('" + packageName + "'));\n";
    srcContent += "require('@jenkins-cd/js-modules').export('" + packageName + "', '" + jsModuleNames.major + "', require('" + packageName + "'));\n";
    
    var bundleSrcDir = 'target/js-bundle-src';
    
    paths.mkdirp(bundleSrcDir);
    
    var bundleSrcFile = bundleSrcDir + '/' + jsModuleNames.nameFor(depVersion) + '.js';
    fs.writeFileSync(cwd +  '/' + bundleSrcFile, srcContent);
    return bundleSrcFile;
}

function parseVersion(version) {
    // remove anything that's not a digit, a dot or an x.
    version = version.replace(/[^\d.x]/g, '');
    
    var versionTokens = version.split('.');
    var parsedVer = {};
    
    if (versionTokens.length >= 3) {
        parsedVer.patch = versionTokens[2]
    }
    if (versionTokens.length >= 2) {
        parsedVer.minor = versionTokens[1]
    }
    if (versionTokens.length >= 1) {
        parsedVer.major = versionTokens[0]
    }
    
    return parsedVer;
}

/**
 * Create major, minor and patch (version) module names that can
 * then be used in the .js generation and module exporting. 
 * @param packageName The NPM package name.
 * @param fullVersion The full version of the installed NPM package.
 */
function mmpModuleNames(packageName, fullVersion) {
    return {
        major: packageName + '-' + fullVersion.major + '.x',
        minor: packageName + '-' + fullVersion.major + '.' + fullVersion.minor + '.x',
        patch: packageName + '-' + fullVersion.major + '.' + fullVersion.minor + '.' + fullVersion.patch,
        nameFor: function (depVersion) {
            if (depVersion.minor === 'x') {
                return this.major;
            } else if (depVersion.patch === 'x') {
                return this.minor;
            } else {
                return this.patch;
            }
        }
    };
}