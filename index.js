var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var jasmineReporters = require('jasmine-reporters');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var transformTools = require('browserify-transform-tools');
var _string = require('underscore.string');


var bundleModule;
var bundleOutputFile;
var bundleToAdjunctPackageDir;
var bundleAsJenkinsModule = false;
var bundleTransforms;

var adjunctBasePath = './target/generated-adjuncts/';
var jsmodulesBasePath = './src/main/webapp/jsmodules/';

var srcPath = './js';
var testSrcPath = './spec';
var lessSrcPath = undefined;

exports.gulp = gulp;

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
    srcPath = normalizePath(path);
};

exports.tests = function(path) {
    testSrcPath = normalizePath(path);
};

exports.less = function(path) {
    lessSrcPath = path;
};

function normalizePath(path) {
    path = _string.ltrim(path, './')
    path = _string.ltrim(path, '/')
    path = _string.rtrim(path, '/');
    
    return path;
}
function packageToPath(packageName) {
    return _string.replaceAll(packageName, '.', '/');
}

var moduleMappings = [];
var requireTransform = transformTools.makeRequireTransform("requireTransform",
    {evaluateArguments: true},
    function(args, opts, cb) {
        var required = args[0];

        for (var i = 0; i < moduleMappings.length; i++) {
            var mapping = moduleMappings[i];
            if (mapping.from === required) {
                if (mapping.require) {
                    return cb(null, "require('" + mapping.require + "')");
                } else {
                    return cb(null, "require('jenkins-modules').require('" + mapping.to + "')");
                }
            }
        }
        return cb();
    });

var isFirstModule = true;
var importWrapperTransform = transformTools.makeStringTransform("importWrapperTransform", {},
    function (content, opts, done) {
        if (isFirstModule) {
            var mappings = "";
            for (var i = 0; i < moduleMappings.length; i++) {
                var mapping = moduleMappings[i];
                if (mappings.length > 0) {
                    mappings += ", ";
                }
                mappings += "'" + mapping.to + "'";
            }
            var wrappedContent = 
                "require('jenkins-modules')\n" +
                "    .import(" + mappings + ")\n" +
                "    .then(function() {\n" +
                "\n" +
                content +
                "\n" +
                "    });\n";

            isFirstModule = false;
            return done(null, wrappedContent);
        } else {
            return done(null, content);
        }
    });

exports.bundle = function(modulePath, as) {
    if (!modulePath) {
        gutil.log(gutil.colors.red("Error: Invalid bundle registration for module 'modulePath' must be specify."));
        throw "'bundle' registration failed. See error above.";
    }
    if (!as) {
        var lastSlash = modulePath.indexOf('/');
        
        if (lastSlash === -1) {
            as = modulePath;
        } else {
            as = _string.strRightBack(modulePath, '/');
        } 
    }
    
    bundleModule = modulePath;
    bundleOutputFile = as;
    
    var options = {
        inAdjunctPackage: function(packageName) {
            if (!packageName) {
                gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + modulePath + "'. You can't specify a 'null' adjunct package name."));
                throw "'bundle' registration failed. See error above.";
            }
            bundleToAdjunctPackageDir = packageToPath(packageName);
            gutil.log("Bundle will be generated as an adjunct in '" + adjunctBasePath + "' as '" + packageName + "." + _string.rtrim(as, '.js') + "' (.js file).");
            return options;
        },
        asJenkinsModuleResource: function() {
            bundleAsJenkinsModule = true;
            gutil.log("Bundle will be generated as a Jenkins Module in '" + jsmodulesBasePath + "' as '" + as + "'.");            
            return options;
        },
        withTransforms: function(transforms) {
            bundleTransforms = transforms;
            return options;
        },
        withExternalModuleMapping: function(from, to, require) {
            if (!from || !to) {
                var message = "Cannot call 'withExternalModuleMapping' without defining both 'to' and 'from' module names.";
                exports.logError(message);
                throw message;
            }
            
            // special case because we are externalizing handlebars runtime for handlebarsify.
            if (from === 'handlebars' && to === 'handlebars:handlebars3' && !require) {
                require = 'jenkins-handlebars-rt/runtimes/handlebars3_rt';
            }
            
            moduleMappings.push({
                from: from, 
                to: to, 
                require: require
            });
            return options;
        }        
    };
    
    return options;
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
        gulp.src(testSpecs)
            .pipe(jasmine({reporter: [terminalReporter, junitReporter]}));
    },
    bundle: function() {
        if (!bundleModule) {
            gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle 'module' is registered. You must call require('jenkins-js-build').bundle([module]) in gulpfile.js, specifying the bundle 'module'."));
            throw "'bundle' task failed. See error above.";
        }
        if (!bundleToAdjunctPackageDir && !bundleAsJenkinsModule) {
            gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle output sec defined. You must call 'inAdjunctPackage([adjunct-package-name])' or 'asJenkinsModuleResource' on the response return from the call to 'bundle'."));
            throw "'bundle' task failed. See error above.";
        }

        var bundleTo;
        if (bundleAsJenkinsModule) {
            bundleTo = jsmodulesBasePath;
        } else {
            bundleTo = adjunctBasePath + "/" + bundleToAdjunctPackageDir;
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
        if (bundleTransforms) {
            for (var i = 0; i < bundleTransforms.length; i++) {
                bundler.transform(bundleTransforms[i]);        
            }
        }
        if (moduleMappings.length > 0) {
            bundler.transform(requireTransform);
            bundler.transform(importWrapperTransform);
        }
        
        return bundler.bundle().pipe(source(bundleOutputFile))
            .pipe(gulp.dest(bundleTo));

    },
    rebundle: function() {
        gulp.watch(['./index.js', srcPath + '/**/*.js', srcPath + '/**/*.hbs'], ['bundle']);
    }
};