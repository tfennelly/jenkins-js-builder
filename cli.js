#!/usr/bin/env node

/**
 * js-builder CLI.
 * Installed as command "jjsbuilder".
 */

var args = require('./internal/args');
var fs = require('fs');
var cwd = process.cwd();
var GulpRunner = require('gulp-runner');
var gulpfilePath;

if (fs.existsSync('gulpfile.js')) {
    gulpfilePath = 'gulpfile.js';
} else {
    gulpfilePath = __dirname + '/res/cli-gulpfile.js';
}

var gulp = new GulpRunner(gulpfilePath);

var tasks = args.argvValue('--tasks');
if (tasks) {
    tasks = tasks.split(',');
} else {
    tasks = 'default';
}

gulp.on('log', function(data) {
    process.stdout.write(data);
});

gulp.on('error', function(err) {
    process.stderr.write(err);
});

gulp.on('failed', function(err) {
    process.exit(err);
});

gulp.run(tasks, {
    cwd: cwd
});
