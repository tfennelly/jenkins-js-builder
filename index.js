var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var jasmineReporters = require('jasmine-reporters');
var browserify = require('browserify');
var source = require('vinyl-source-stream');

var bundleModule;
var bundleOutputFile;
var bundleToAdjunctPackageDir;
var bundleAsJenkinsModule = false;

var adjunctBasePath = './target/generated-adjuncts/';
var jsmodulesBasePath = './src/main/webapp/jsmodules/';

var srcPath = './js';
var testSrcPath = './spec';
var lessSrcPath = undefined;

exports.defineTasks = function(tasknames) {
    if (!tasknames) {
        tasknames = ['test'];
    }
    
    var defaults = [];
    
    for (var i = 0; i < tasknames.length; i++) {
        var taskname = tasknames[i];
        var gulpTask = tasks[taskname];
        
        if (!gulpTask) {
            throw "Unknown gulp task '" + taskname + "'.";
        }
        
        gulp.task(taskname, gulpTask);
        if (taskname === 'test' || taskname === 'bundle') {
            defaults.push(taskname);
        }
    }
    
    if (defaults.length > 0) {
        exports.logInfo('Setting defaults');
        gulp.task('default', defaults);
    }    
};

exports.src = function(path) {
    if (!path) {
        throw "Error: you can't unset the src path.";
    }
    srcPath = path;
};

exports.tests = function(path) {
    testSrcPath = path;
};

exports.less = function(path) {
    lessSrcPath = path;
};

exports.bundle = function(module, as) {
    if (!as) {
        gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + module + "'. You must specify an 'as' arg (the name of the JavaScript bundle file)."));
        throw "'bundle' registration failed. See error above.";
    }
    
    bundleModule = module;
    bundleOutputFile = as;
    
    return {
        asAdjunctResource: function(inPackageDir) {
            if (!inPackageDir) {
                gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + module + "'. You can't specify a 'null' adjunct resource package dir."));
                throw "'bundle' registration failed. See error above.";
            }
            bundleToAdjunctPackageDir = inPackageDir;
            gutil.log("Bundle will be generated as an adjunct in '" + adjunctBasePath + "' as '" + bundleToAdjunctPackageDir + as + "'.");            
        },
        asJenkinsModuleResource: function() {
            bundleAsJenkinsModule = true;
            gutil.log("Bundle will be generated as a Jenkins Module in '" + jsmodulesBasePath + "' as '" + as + "'.");            
        }        
    };
};

exports.logInfo = function(message) {
    gutil.log(message);
}
exports.logWarn = function(message) {
    gutil.log(gutil.colors.orange(message));
}
exports.logError = function(message) {
    gutil.log(gutil.colors.red(message));
}

var tasks = {
    test: function () {
        if (!testSrcPath) {
            gutil.log(gutil.colors.orange("Warn: Test src path has been unset. No tests to run."));
            return;
        }
        
        var terminalReporter = new jasmineReporters.TerminalReporter({
            verbosity: 3,
            color: true,
            showStack: true
        });        
        var junitReporter = new jasmineReporters.JUnitXmlReporter({
            savePath: 'target/surefire-reports',
            consolidateAll: true,
            filePrefix: 'JasmineReport'    
        });

        var testSpecs = testSrcPath + '/**/*-spec.js';
        exports.logInfo('Running tests in ' + testSpecs);
        try {
            gulp.src(testSpecs)
                .pipe(jasmine({reporter: [terminalReporter, junitReporter]}));
        } finally {
            exports.logInfo('Test run complete.');
        }
    },
    bundle: function() {
        if (!bundleModule) {
            gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle 'module' is registered. You must call require('jenkins-js-build').bundle([module]) in gulpfile.js, specifying the bundle 'module'."));
            throw "'bundle' task failed. See error above.";
        }
        if (!bundleToAdjunctPackageDir && !bundleAsJenkinsModule) {
            gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle output sec defined. You must call 'asAdjunctResource([adjunct-package-dir])' or 'asJenkinsModuleResource' on the response return from the call to 'bundle'."));
            throw "'bundle' task failed. See error above.";
        }

        var bundleTo;
        if (bundleAsJenkinsModule) {
            bundleTo = jsmodulesBasePath;
        } else {
            bundleTo = adjunctBasePath + bundleToAdjunctPackageDir;
        }

        if (lessSrcPath) {
            var less = require('gulp-less');
            gulp.src(lessSrcPath)
                .pipe(less())
                .pipe(gulp.dest(bundleTo));
        }
        
        var bundler = browserify({
            entries: [bundleModule],
            extensions: ['.js', '.hbs'],
            cache: {},
            packageCache: {},
            fullPaths: false
        });
        var hbsfy = require("hbsfy").configure({
            compiler: "require('jenkins-handlebars-rt/runtimes/handlebars3_rt')"
        });
        bundler.transform(hbsfy);
        
        return bundler.bundle().pipe(source(bundleOutputFile))
            .pipe(gulp.dest(bundleTo));

    },
    rebundle: function() {
        gulp.watch(['./index.js', srcPath + '/**/*.js', srcPath + '/**/*.hbs'], ['bundle']);
    }
};