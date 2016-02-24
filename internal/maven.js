var fs = require('fs');
var cwd = process.cwd();

exports.isMavenProject = fs.existsSync(cwd + '/pom.xml');

if (exports.isMavenProject) {
    var xmlParser = require('xml2js').parseString;
    var pomXML = fs.readFileSync('pom.xml', "utf-8");

    xmlParser(pomXML, function (err, parseResult) {
        exports.pom = parseResult;
    });
}

exports.getArtifactId = function() {
    assertIsMavenProject();
    return exports.pom.project.artifactId[0];
};

exports.getPackaging = function() {
    assertIsMavenProject();
    return exports.pom.project.packaging[0];
};

exports.isHPI = function() {
    assertIsMavenProject();
    return (exports.getPackaging() === 'hpi');
};

function assertIsMavenProject(preamble) {
    if (!exports.isMavenProject) {
        if (preamble) {
            throw preamble + ' - This is not a maven project.';
        } else {
            throw 'This is not a maven project.';
        }
    }
}


