var dependencies = require('./dependecies');
var fs = require('fs');
var cwd = process.cwd();

var jsExtensionsYAMLFile = cwd + '/src/main/resources/jenkins-js-extension.yaml';
var hasJenkinsJSExtensionsFile = fs.existsSync(jsExtensionsYAMLFile);

exports.readYAMLFile = function(file) {
    if (!fs.existsSync(file)) {
        return undefined;
    }
    var rawYAML = fs.readFileSync(file, "utf-8");
    return require('js-yaml').load(rawYAML);
};

exports.getJSExtensions = function() {
    return exports.readYAMLFile(jsExtensionsYAMLFile);
};

exports.yamlToJSON = function(sourceFile, targetFile) {
    var asJSON = exports.readYAMLFile(sourceFile);
    fs.writeFileSync(targetFile, JSON.stringify(asJSON, undefined, 4));
};

exports.transformToJSON = function() {
    // If there's a jenkins-js-extensions.yaml, transform it to jenkins-js-extensions.json
    // in the target/classes dir, making it easier to consume on the backend (HPI extension discovery).
    if (hasJenkinsJSExtensionsFile) {
        dependencies.assertHasJenkinsJsExtensionsDependency('Your project defines a jenkins-js-extensions.yaml file (' + jsExtensionsYAMLFile + ').');
        var jsExtensionsJSONFile = cwd + '/target/classes/jenkins-js-extension.json';
        
        exports.yamlToJSON(jsExtensionsYAMLFile, jsExtensionsJSONFile);
    }
};