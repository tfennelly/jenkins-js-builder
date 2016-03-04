var gulp = require('gulp');
var fs = require('fs');
var cwd = process.cwd();
var paths = require('./paths');
var logger = require('./logger');
var hasJsHintConfig = fs.existsSync(cwd + '/../.jshintrc');

exports.exec = function() {
    runJsHint()
};

function runJsHint() {
    var jshint = require('gulp-jshint');
    var jshintConfig;
    
    if (!hasJsHintConfig) {
        logger.logInfo('\t- Using default JSHint configuration (in js-builder). Override by defining a .jshintrc in this folder.');
        jshintConfig = require('../res/default.jshintrc');
    }        
    function _runJsHint(pathSet) {
        for (var i = 0; i < pathSet.length; i++) {
            // TODO: eslint for .jsx and .es6 files.
            gulp.src([pathSet[i] + '/**/*.js'])
                .pipe(jshint(jshintConfig))
                .pipe(jshint.reporter('default'))
                .pipe(jshint.reporter('fail'));
        }
    }
    _runJsHint(paths.srcPaths);
    _runJsHint([paths.testSrcPath]);
}