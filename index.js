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
    if (path) {
        srcPath = normalizePath(path);
    }
    return srcPath;
};

exports.tests = function(path) {
    if (path) {
        testSrcPath = normalizePath(path);
    }
    return testSrcPath;
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

exports.bundle = function(moduleToBundle, as) {
    if (!moduleToBundle) {
        gutil.log(gutil.colors.red("Error: Invalid bundle registration for module 'moduleToBundle' must be specify."));
        throw "'bundle' registration failed. See error above.";
    }

    var bundle = {};

    bundle.js = _string.strRightBack(moduleToBundle, '/'); // The short name of the javascript file (with extension but without path) 
    bundle.module = _string.strLeftBack(bundle.js, '.js'); // The short name with the .js extension removed
    bundle.bundleDependencyModule = (moduleToBundle === bundle.module); // The specified module to bundle is the name of a module dependency.
    
    if (!as) {
        bundle.as = bundle.module;
    } else {
        bundle.as = _string.strLeftBack(as, '.js');
    }
    
    function assertBundleOutputUndefined() {
        if (bundle.bundleInDir || bundle.bundleAsJenkinsModule || bundle.bundleToAdjunctPackageDir) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration. Bundle output (inAdjunctPackage, inDir, asJenkinsModuleResource) already defined."));
            throw "'bundle' registration failed. See error above.";
        }
    }

    bundle.bundleModule = moduleToBundle;
    bundle.bundleOutputFile = bundle.as + '.js';
    bundle.moduleMappings = [];
    bundle.inAdjunctPackage = function(packageName) {
        if (!packageName) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + moduleToBundle + "'. You can't specify a 'null' adjunct package name."));
            throw "'bundle' registration failed. See error above.";
        }
        assertBundleOutputUndefined();
        bundle.bundleToAdjunctPackageDir = packageToPath(packageName);
        gutil.log("Bundle will be generated as an adjunct in '" + adjunctBasePath + "' as '" + packageName + "." + bundle.as + "' (it's a .js file).");
        return bundle;
    };
    bundle.inDir = function(dir) {
        if (!dir) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + moduleToBundle + "'. You can't specify a 'null' dir name when calling inDir."));
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
        gutil.log("Bundle will be generated as a Jenkins Module in '" + jsmodulesBasePath + "' as '" + bundle.as + "'.");            
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
    bundle.export = function() {
        var fs = require('fs');
        var xmlParser = require('xml2js').parseString;
        var pomXML = fs.readFileSync('pom.xml', "utf-8");
        
        xmlParser(pomXML, function (err, pom) {
            bundle.bundleExportPlugin = pom.project.artifactId[0];
        });                
    }
    
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

        global.jenkinsBuilder = exports;
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
            
            if (!bundle.bundleToAdjunctPackageDir && !bundle.bundleAsJenkinsModule && !bundle.bundleInDir) {
                gutil.log(gutil.colors.red("Error: Cannot perform 'bundle' task. No bundle output spec defined. You must call 'inAdjunctPackage([adjunct-package-name])' or 'asJenkinsModuleResource' or 'inDir([dir])' on the response return from the call to 'bundle'."));
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
                    lessBundleTo += '/' + bundle.as;
                }
                
                gulp.src(bundle.lessSrcPath)
                    .pipe(less())
                    .pipe(gulp.dest(lessBundleTo));
            }
            
            var fileToBundle = bundle.bundleModule;
            if (bundle.bundleDependencyModule) {
                // Lets generate a temp file containing the module require.
                var fs = require('fs');
                
                if (!fs.existsSync('target')) {
                    fs.mkdirSync('target');
                }
                fileToBundle = 'target/' + bundle.bundleOutputFile;
                fs.writeFileSync(fileToBundle, "module.exports = require('" + bundle.module + "');");
            }
            
            var bundler = browserify({
                entries: [fileToBundle],
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
            if (bundle.moduleMappings.length > 0 || bundle.bundleExportPlugin) {
                addModuleMappingTransforms(bundle, bundler);
            }
            
            bundler.bundle().pipe(source(bundle.bundleOutputFile))
                .pipe(gulp.dest(bundleTo));            
        }
    },
    rebundle: function() {
        gulp.watch(['./index.js', srcPath + '/**/*.js', srcPath + '/**/*.hbs'], ['bundle']);
    }
};

function addModuleMappingTransforms(bundle, bundler) {
    var moduleMappings = bundle.moduleMappings;
    
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
                var imports = "";
                for (var i = 0; i < moduleMappings.length; i++) {
                    var mapping = moduleMappings[i];
                    if (imports.length > 0) {
                        imports += ", ";
                    }
                    imports += "'" + mapping.to + "'";
                }
                
                if (bundle.bundleExportPlugin) {
                    content += "\n" +
                        "\t\trequire('jenkins-modules').export('" + bundle.bundleExportPlugin + "', '" + bundle.as + "', module);";
                    
                    if (bundle.lessSrcPath) {
                        content += "\n" +
                            "\t\trequire('jenkins-modules').addModuleCSSToPage('" + bundle.bundleExportPlugin + "', '" + bundle.as + "');";
                    }
                }
                
                if (imports.length > 0) {
                    var wrappedContent =
                        "require('jenkins-modules')\n" +
                            "    .import(" + imports + ")\n" +
                            "    .onFulfilled(function() {\n" +
                            "\n" +
                            content +
                            "\n" +
                            "    });\n";

                    importWrapApplied = true;
                    return done(null, wrappedContent);
                } else {
                    return done(null, content);
                }
            } else {
                return done(null, content);
            }
        });    

    bundler.transform(requireTransform);
    bundler.transform(importWrapperTransform);
}