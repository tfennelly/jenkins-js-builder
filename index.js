var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var jasmineReporters = require('jasmine-reporters');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var transformTools = require('browserify-transform-tools');
var _string = require('underscore.string');

var bundles = []; // see exports.bundle function

var adjunctBasePath = './target/generated-adjuncts/';
var jsmodulesBasePath = './src/main/webapp/jsmodules/';

var srcPath = './js';
var testSrcPath = './spec';

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

function normalizePath(path) {
    path = _string.ltrim(path, './')
    path = _string.ltrim(path, '/')
    path = _string.rtrim(path, '/');
    
    return path;
}
function packageToPath(packageName) {
    return _string.replaceAll(packageName, '\\.', '/');
}

exports.bundle = function(modulePath, as) {
    if (!modulePath) {
        gutil.log(gutil.colors.red("Error: Invalid bundle registration for module 'modulePath' must be specify."));
        throw "'bundle' registration failed. See error above.";
    }

    var bundle = {};

    bundle.js = _string.strRightBack(modulePath, '/'); // The short name of the javascript file (with extension but without path) 
    bundle.module = _string.rtrim(bundle.js, '.js'); // The short name with the .js extension removed
    
    if (!as) {
        as = bundle.js;
    }
    
    function assertBundleOutputUndefined() {
        if (bundle.bundleInDir || bundle.bundleAsJenkinsModule || bundle.bundleToAdjunctPackageDir) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration. Bundle output (inAdjunctPackage, inDir, asJenkinsModuleResource) already defined."));
            throw "'bundle' registration failed. See error above.";
        }
    }

    bundle.bundleModule = modulePath;
    bundle.bundleOutputFile = as;
    bundle.moduleMappings = [];
    bundle.inAdjunctPackage = function(packageName) {
        if (!packageName) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + modulePath + "'. You can't specify a 'null' adjunct package name."));
            throw "'bundle' registration failed. See error above.";
        }
        assertBundleOutputUndefined();
        bundle.bundleToAdjunctPackageDir = packageToPath(packageName);
        gutil.log("Bundle will be generated as an adjunct in '" + adjunctBasePath + "' as '" + packageName + "." + bundle.module + "' (it's a .js file).");
        return bundle;
    };
    bundle.inDir = function(dir) {
        if (!dir) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + modulePath + "'. You can't specify a 'null' dir name when calling inDir."));
            throw "'bundle' registration failed. See error above.";
        }
        assertBundleOutputUndefined();
        bundle.bundleInDir = normalizePath(dir);
        gutil.log("Bundle will be generated in directory '" + bundle.bundleInDir + "' as '" + bundle.js + "'.");
        return bundle;
    };
    bundle.asJenkinsModuleResource = function() {
        assertBundleOutputUndefined();
        bundle.bundleAsJenkinsModule = true;
        gutil.log("Bundle will be generated as a Jenkins Module in '" + jsmodulesBasePath + "' as '" + as + "'.");            
        return bundle;
    };
    bundle.withTransforms = function(transforms) {
        bundle.bundleTransforms = transforms;
        return bundle;
    };
    bundle.withExternalModuleMapping = function(from, to, require) {
        if (!from || !to) {
            var message = "Cannot call 'withExternalModuleMapping' without defining both 'to' and 'from' module names.";
            exports.logError(message);
            throw message;
        }
        
        // special case because we are externalizing handlebars runtime for handlebarsify.
        if (from === 'handlebars' && to === 'handlebars:handlebars3' && !require) {
            require = 'jenkins-handlebars-rt/runtimes/handlebars3_rt';
        }
        
        bundle.moduleMappings.push({
            from: from, 
            to: to, 
            require: require
        });
        
        return bundle;
    };            
    bundle.less = function(path) {
        bundle.lessSrcPath = path;
        return bundle;
    };
    
    bundles.push(bundle);
    
    return bundle;
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
        if (bundles.length === 0) {
            gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No 'module' bundles are registered. You must call require('jenkins-js-build').bundle([module]) in gulpfile.js, specifying at least one bundle 'module'."));
            throw "'bundle' task failed. See error above.";
        }
        
        // Bundle all bundles.
        for (var i = 0; i < bundles.length; i++) {
            var bundle = bundles[i];
            
            if (!bundle.bundleToAdjunctPackageDir && !bundle.bundleAsJenkinsModule) {
                gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle output sec defined. You must call 'inAdjunctPackage([adjunct-package-name])' or 'asJenkinsModuleResource' on the response return from the call to 'bundle'."));
                throw "'bundle' task failed. See error above.";
            }
    
            var bundleTo;
            if (bundle.bundleAsJenkinsModule) {
                bundleTo = jsmodulesBasePath;
            } else if (bundle.bundleInDir) {
                bundleTo = bundle.bundleInDir;
            } else {
                bundleTo = adjunctBasePath + "/" + bundle.bundleToAdjunctPackageDir;
            }
    
            if (bundle.lessSrcPath) {
                var less = require('gulp-less');
                var lessBundleTo = bundleTo;
                
                if (bundle.bundleAsJenkinsModule) {
                    // If it's a jenkins module, the CSS etc need to go into a folder under jsmodulesBasePath
                    // and the name of the folder must be the module name
                    lessBundleTo += '/' + bundle.module;
                }
                
                gulp.src(bundle.lessSrcPath)
                    .pipe(less())
                    .pipe(gulp.dest(lessBundleTo));
            }
            
            var bundler = browserify({
                entries: [bundle.bundleModule],
                extensions: ['.js', '.hbs'],
                cache: {},
                packageCache: {},
                fullPaths: false
            });
            var hbsfy = require("hbsfy").configure({
                compiler: "require('jenkins-handlebars-rt/runtimes/handlebars3_rt')"
            });
            bundler.transform(hbsfy);        
            if (bundle.bundleTransforms) {
                for (var i = 0; i < bundle.bundleTransforms.length; i++) {
                    bundler.transform(bundle.bundleTransforms[i]);        
                }
            }
            if (bundle.moduleMappings.length > 0) {
                addModuleMappingTransforms(bundle.moduleMappings, bundler);
            }
            
            bundler.bundle().pipe(source(bundle.bundleOutputFile))
                .pipe(gulp.dest(bundleTo));            
        }
    },
    rebundle: function() {
        gulp.watch(['./index.js', srcPath + '/**/*.js', srcPath + '/**/*.hbs'], ['bundle']);
    }
};

function addModuleMappingTransforms(moduleMappings, bundler) {
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
    var importWrapApplied = false;
    var importWrapperTransform = transformTools.makeStringTransform("importWrapperTransform", {},
        function (content, opts, done) {
            if (!importWrapApplied) {
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
    
                importWrapApplied = true;
                return done(null, wrappedContent);
            } else {
                return done(null, content);
            }
        });    

    bundler.transform(requireTransform);
    bundler.transform(importWrapperTransform);
}