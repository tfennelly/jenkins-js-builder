var maven = require('./maven');
var logger = require('./logger');
var paths = require('./paths');
var fs = require('fs');
var cwd = process.cwd();
var semver = require('semver');

exports.bundleFor = function(builder, packageName, semverScope) {
    var packageJsonFile = cwd + '/node_modules/' + packageName + '/package.json';
    
    if (!fs.existsSync(packageJsonFile)) {
        throw 'Unable to create Jenkins adjunct based external module bundle for package "' + packageName + '". This package is not installed.';
    }

    var packageJson = require(packageJsonFile);
    var major = semver.major(packageJson.version);
    var minor = semver.minor(packageJson.version);
    var patch = semver.patch(packageJson.version);
    var jsModuleName;
    
    if (semverScope === 'major') {
        jsModuleName = packageJson.name + '-' + major + '.x';
    } else if (semverScope === 'minor') {
        jsModuleName = packageJson.name + '-' + major + '.' + minor + '.x';
    } else if (semverScope === 'patch') {
        jsModuleName = packageJson.name + '-' + major + '.' + minor + '.' + patch;
    } else {
        throw 'Unable to create Jenkins adjunct based external module bundle for package "' + packageName + '". Invalid semver scope "' + semverScope + '".';
    }
    
    var inDir = 'target/classes/org/jenkins/ui/jsmodules/' + packageName;
    
    if (!fs.existsSync(cwd + '/' + inDir + '/' + jsModuleName + '.js')) {
        // We need to generate an adjunct bundle for the package.
        var bundleSrc = generateBundleSrc(packageName, jsModuleName);
        builder.bundle(bundleSrc).inDir(inDir).ignoreGlobalModuleMappings();
    } else {
        // The bundle has already been generated. No need to do it again.
        // For linked modules ... do an rm -rf of the target dir ... sorry :)
        logger.logInfo('Bundle for "' + packageName + '" already created. Delete "target" directory ad run bundle again to recreate.');
    }
    return packageName + ':' + jsModuleName;
};

function generateBundleSrc(packageName, jsModuleName) {
    var srcContent = '';

    srcContent += "//\n";
    srcContent += "// NOTE: This file is generated and should NOT be added to source control.\n";
    srcContent += "//\n";
    srcContent += "\n";
    srcContent += "require('@jenkins-cd/js-modules').export('" + packageName + "', '" + jsModuleName + "', require('" + packageName + "'));\n";
    
    var bundleSrcDir = 'target/js-bundle-src';
    
    paths.mkdirp(bundleSrcDir);
    
    var bundleSrcFile = bundleSrcDir + '/' + jsModuleName + '.js';
    fs.writeFileSync(cwd +  '/' + bundleSrcFile, srcContent);
    return bundleSrcFile;
}
