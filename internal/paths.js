var logger = require('./logger');
var maven = require('./maven');

exports.srcPaths;
exports.testSrcPath;

if (maven.isMavenProject) {
    exports.srcPaths = ['src/main/js','src/main/less'];
    exports.testSrcPath = 'src/test/js';    
} else {
    exports.srcPaths = ['./js', './less'];
    exports.testSrcPath = './spec';    
}
