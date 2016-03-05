var gulp = require('gulp');
var fs = require('fs');
var cwd = process.cwd();
var paths = require('./paths');
var logger = require('./logger');
var args = require('./args');
var hasJsHintConfig = fs.existsSync(cwd + '/.jshintrc');
var hasEsLintConfig = fs.existsSync(cwd + '/.eslintrc');

var hasJSX = paths.hasSourceFiles('jsx');
var hasES6 = paths.hasSourceFiles('es6');

exports.exec = function(langConfig, lintConfig) {
    if (lintConfig.level === 'none') {
        logger.logInfo('Code linting is disabled.');
        return;
    }
    
    if (hasJsHintConfig) {
        runJsHint(lintConfig);
    } else if (hasEsLintConfig || hasJSX || hasES6) {
        runEslint(lintConfig);
    } else {
        if (langConfig.ecmaVersion === 5) {
            runJsHint(lintConfig);
        } else if (langConfig.ecmaVersion === 6) {
            runEslint(lintConfig);
        }
    }
};

function runJsHint(lintConfig) {
    var jshint = require('gulp-jshint');
    var jshintConfig;
    
    if (!hasJsHintConfig) {
        logger.logInfo('\t- Using default JSHint configuration (in js-builder). Override by defining a .jshintrc in this folder.');
        jshintConfig = require('../res/default.jshintrc');
    }        
    function _runJsHint(pathSet) {
        for (var i = 0; i < pathSet.length; i++) {
            // TODO: eslint for .jsx and .es6 files.
            gulp.src(['./index.js', pathSet[i] + '/**/*.js'])
                .pipe(jshint(jshintConfig))
                .pipe(jshint.reporter('default'))
                .pipe(jshint.reporter('fail'));
        }
    }
    if (lintConfig.src) {
        _runJsHint(paths.srcPaths);
    }
    if (lintConfig.tests) {
        _runJsHint([paths.testSrcPath]);
    }
}

function runEslint(lintConfig) {
    var eslint = require('gulp-eslint');
    var eslintConfig;
    
    if (!hasEsLintConfig) {
        logger.logInfo('\t- Using default eslint configuration (from Airbnb). Override by defining a .eslintrc in this folder.');
        
        // See https://www.npmjs.com/package/eslint-config-airbnb
        if (hasJSX) {
            eslintConfig = require('eslint-config-airbnb');
        } else {
            eslintConfig = require('eslint-config-airbnb/base');
        }
    }
    
    function _runEsLint(pathSet) {
        for (var i = 0; i < pathSet.length; i++) {
            gulp.src(['./index.js', pathSet[i] + '/**/*.js', pathSet[i] + '/**/*.jsx', pathSet[i] + '/**/*.es6'])
                .pipe(eslint(eslintConfig))
                .pipe(eslint.format())
                .pipe(eslint.result(function (result) {}))
                .pipe(eslint.results(function (results) {
                    if (results.errorCount > 0 || results.warningCount > 0) {
                        logger.logWarn('Oops, there are some eslint errors/warnings:');
                        if (results.warningCount > 0) {
                            logger.logWarn('\tWarnings: ' + results.warningCount);
                        }
                        if (results.errorCount > 0) {
                            logger.logError('\tErrors:   ' + results.errorCount);
                            if (!args.isArgvSpecified('--continueOnLint')) {
                                logger.logError('There are eslint errors. Failing the build now. (--continueOnLint to continue on lint errors)');
                                process.exit(1);
                            }
                        }
                    } else {
                        logger.logInfo('There are no eslint errors/warnings. Nice work!!!');
                    }
                })                    
                );
        }
    }
    if (lintConfig.src) {
        _runEsLint(paths.srcPaths);
    }
    if (lintConfig.tests) {
        _runEsLint([paths.testSrcPath]);
    }
}