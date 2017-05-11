#!/usr/bin/env node

/**
 * js-builder CLI.
 * Installed as command "jjsbuilder".
 */

// Prepend the local node_modules to NODE_PATH so as to
// pick up peer deps. Will not work otherwise.
const path = require('path');
process.env.NODE_PATH='./node_modules' + path.delimiter + process.env.NODE_PATH;

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

// Lets pass on the options supplied, stripping off the
// leading '--'.
var options = {};
var lastOpt;
for (var i = 0; i < process.argv.length; i++) {
    var opt = process.argv[i];
    if (opt.indexOf('--') === 0) {
        opt = opt.substring(2);
        options[opt] = true;
        lastOpt = opt;
    } else if (lastOpt) {
        options[lastOpt] = opt;
        lastOpt = undefined; // clear it so we don't assign again.
    }
}
delete options.tasks;
options.cwd = cwd;

gulp.run(tasks, options, function(error) {
    if (error) {
        process.exitCode = 1;
    }
});
