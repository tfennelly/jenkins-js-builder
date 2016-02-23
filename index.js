var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var jasmineReporters = require('jasmine-reporters');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var transformTools = require('browserify-transform-tools');
var _string = require('underscore.string');
var fs = require('fs');
var testWebServer;

var cwd = process.cwd();
var isMavenBuild = fs.existsSync(cwd + '/pom.xml');
var hasJenkinsJsModulesDependency = hasJenkinsJsModulesDep();

var bundles = []; // see exports.bundle function
var bundleDependencyTaskNames = ['log-env'];

var adjunctBasePath = './target/generated-adjuncts/';
var jsmodulesBasePath = './src/main/webapp/jsmodules/';

var srcPaths;
var testSrcPath;
if (isMavenBuild) {
    gutil.log(gutil.colors.green("Maven project"));
    srcPaths = ['src/main/js','src/main/less'];
    testSrcPath = 'src/test/js';    
} else {
    srcPaths = ['./js', './less'];
    testSrcPath = './spec';    
}

exports.gulp = gulp;
exports.browserify = browserify;

exports.defineTasks = function(tasknames) {
    if (!tasknames) {
        tasknames = ['test'];
    }
    
    gulp.task('log-env', function() {
        exports.logInfo("Source Dirs:");
        exports.logInfo(" - src: " + srcPaths);
        exports.logInfo(" - test: " + testSrcPath);    
    });

    var defaults = [];
    
    for (var i = 0; i < tasknames.length; i++) {
        var taskname = tasknames[i];
        var gulpTask = tasks[taskname];
        
        if (!gulpTask) {
            throw "Unknown gulp task '" + taskname + "'.";
        }
        
        exports.defineTask(taskname, gulpTask);
        if (taskname === 'jshint' || taskname === 'test' || taskname === 'bundle') {
            defaults.push(taskname);
        }
    }
    
    if (defaults.length > 0) {
        exports.logInfo('Setting defaults');
        gulp.task('default', defaults);
    }    
};

exports.defineTask = function(taskname, gulpTask) {
    if (taskname === 'test') {
        // Want to make sure the 'bundle' task gets run with the 'test' task.
        gulp.task('test', ['bundle'], gulpTask);
    } else if (taskname === 'bundle') {
        // Define the bundle task so that it depends on the "sub" bundle tasks.
        gulp.task('bundle', bundleDependencyTaskNames, gulpTask);
    } else if (taskname === 'rebundle') {
        // Run bundle at the start of rebundle
        gulp.task('rebundle', ['bundle'], gulpTask);
    } else {
        gulp.task(taskname, gulpTask);
    }
};

exports.src = function(paths) {
    if (paths) {
        srcPaths = [];
        if (typeof paths === 'string') {
            srcPaths.push(normalizePath(paths));
        } else if (paths.constructor === Array) {
            for (var i = 0; i < paths.length; i++) {
                srcPaths.push(normalizePath(paths[i]));
            }
        }
    }
    return srcPaths;
};

exports.tests = function(path) {
    if (path) {
        testSrcPath = normalizePath(path);
    }
    return testSrcPath;
};

exports.startTestWebServer = function(config) {
    _stopTestWebServer();
    _startTestWebServer(config);
    exports.logInfo("\t(call require('gulp').emit('testing_completed') when testing is completed - watch async test execution)");
};

exports.onTaskStart = function(taskName, callback) {
    gulp.on('task_start', function(event) {
        if (event.task === taskName) {
            callback();
        }
    });
};

exports.onTaskEnd = function(taskName, callback) {
    gulp.on('task_end', function(event) {
        if (event.task === taskName) {
            callback();
        }
    });
};

function normalizePath(path) {
    path = _string.ltrim(path, './');
    path = _string.ltrim(path, '/');
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
    bundle.minifyBundle = isArgvSpecified('--minify');
    bundle.inAdjunctPackage = function(packageName) {
        if (!packageName) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + moduleToBundle + "'. You can't specify a 'null' adjunct package name."));
            throw "'bundle' registration failed. See error above.";
        }
        assertBundleOutputUndefined();
        bundle.bundleToAdjunctPackageDir = packageToPath(packageName);
        gutil.log(gutil.colors.green("Bundle will be generated as an adjunct in '" + adjunctBasePath + "' as '" + packageName + "." + bundle.as + ".js'."));
        return bundle;
    };
    bundle.generateNoImportsBundle = function() {
        // Create a self contained version of the bundle (no imports) - useful for 
        // testing and probably more.
        defineBundleTask(bundle, false);
        return bundle;
    };
    bundle.minify = function() {
        bundle.minifyBundle = true;
        return bundle;
    };
    bundle.inDir = function(dir) {
        if (!dir) {
            gutil.log(gutil.colors.red("Error: Invalid bundle registration for module '" + moduleToBundle + "'. You can't specify a 'null' dir name when calling inDir."));
            throw "'bundle' registration failed. See error above.";
        }
        assertBundleOutputUndefined();
        bundle.bundleInDir = normalizePath(dir);
        gutil.log(gutil.colors.green("Bundle will be generated in directory '" + bundle.bundleInDir + "' as '" + bundle.as + ".js'."));
        return bundle;
    };
    bundle.asJenkinsModuleResource = function() {
        assertHasJenkinsJsModulesDependency('Cannot bundle "asJenkinsModuleResource".');
        assertBundleOutputUndefined();
        bundle.bundleAsJenkinsModule = true;
        gutil.log(gutil.colors.green("Bundle will be generated as a Jenkins Module in '" + jsmodulesBasePath + "' as '" + bundle.as + ".js'."));            
        return bundle;
    };
    bundle.withTransforms = function(transforms) {
        bundle.bundleTransforms = transforms;
        return bundle;
    };
    bundle.withExternalModuleMapping = function(from, to, config) {
        assertHasJenkinsJsModulesDependency('Cannot bundle "withExternalModuleMapping".');
        
        if (config === undefined) {
            config = {};
        } else if (typeof config === 'string') {
            // config is the require mapping override (backward compatibility).
            config = {
                require: config
            };
        } 
        
        if (!from || !to) {
            var message = "Cannot call 'withExternalModuleMapping' without defining both 'to' and 'from' module names.";
            exports.logError(message);
            throw message;
        }
        
        // special case because we are externalizing handlebars runtime for handlebarsify.
        if (from === 'handlebars' && to === 'handlebars:handlebars3' && !config.require) {
            config.require = 'jenkins-handlebars-rt/runtimes/handlebars3_rt';
        }
        
        bundle.moduleMappings.push({
            from: from, 
            to: to, 
            config: config
        });
        
        return bundle;
    };            
    bundle.less = function(src, targetDir) {
        bundle.lessSrcPath = src;
        if (targetDir) {
            bundle.lessTargetDir = targetDir;
        }
        return bundle;
    };
    bundle.export = function(toNamespace) {
        assertHasJenkinsJsModulesDependency('Cannot bundle "export".');
        if (toNamespace) {
            bundle.bundleExport = true;
            bundle.bundleExportNamespace = toNamespace;
        } else if (isMavenBuild) {
            var xmlParser = require('xml2js').parseString;
            var pomXML = fs.readFileSync('pom.xml', "utf-8");

            bundle.bundleExport = true;
            xmlParser(pomXML, function (err, pom) {
                // Use the maven artifactId as the namespace.
                bundle.bundleExportNamespace = pom.project.artifactId[0];
                if (pom.project.packaging[0] !== 'hpi') {
                    exports.logWarn("\t- Bundling process will use the maven pom artifactId ('" + bundle.bundleExportNamespace + "') as the bundle export namespace. You can specify a namespace as a parameter to the 'export' method call.");
                }            
            });
        } else {
            gutil.log(gutil.colors.red("Error: This is not a maven project. You must define a 'toNamespace' argument to the 'export' call."));
            return;
        }
        exports.logInfo("\t- Bundle will be exported as '" + bundle.bundleExportNamespace + ":" + bundle.as + "'.");
    };
    
    bundle.findModuleMapping = function(from) {
        var moduleMappings = bundle.moduleMappings;
        for (var i = 0; i < moduleMappings.length; i++) {
            var mapping = moduleMappings[i];
            if (from === mapping.from) {
                return mapping;
            }
        }
        return undefined;
    };    
    
    bundles.push(bundle);
    
    function defineBundleTask(bundle, applyImports) {
        var bundleTaskName = 'bundle_' + bundle.as;
        
        if (!applyImports) {
            bundleTaskName += '_no_imports';
        }
        
        bundleDependencyTaskNames.push(bundleTaskName);
        
        exports.defineTask(bundleTaskName, function() {
            if (!bundle.bundleToAdjunctPackageDir && !bundle.bundleAsJenkinsModule && !bundle.bundleInDir) {
                exports.logError("Error: Cannot perform 'bundle' task. No bundle output spec defined. You must call 'inAdjunctPackage([adjunct-package-name])' or 'asJenkinsModuleResource' or 'inDir([dir])' on the response return from the call to 'bundle'.");
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

            if (!applyImports) {
                bundleTo += '/no_imports';
            }
            
            // Only process LESS when generating the bundle containing imports. If using the "no_imports" bundle, you 
            // need to take care of adding the CSS yourself. 
            if (applyImports && bundle.lessSrcPath) {
                var lessBundleTo = bundleTo;

                if (bundle.bundleAsJenkinsModule) {
                    // If it's a jenkins module, the CSS etc need to go into a folder under jsmodulesBasePath
                    // and the name of the folder must be the module name
                    lessBundleTo += bundle.as;
                } else if (bundle.lessTargetDir) {
                    lessBundleTo = bundle.lessTargetDir;
                }

                less(bundle.lessSrcPath, lessBundleTo);
            }

            var fileToBundle = bundle.bundleModule;
            if (bundle.bundleDependencyModule) {
                // Lets generate a temp file containing the module require.
                if (!fs.existsSync('target')) {
                    fs.mkdirSync('target');
                }
                fileToBundle = 'target/' + bundle.bundleOutputFile;
                fs.writeFileSync(fileToBundle, "module.exports = require('" + bundle.module + "');");
            }

            var browserifyConfig = {
                entries: [fileToBundle],
                extensions: ['.js', '.hbs'],
                cache: {},
                packageCache: {},
                fullPaths: false
            };
            if (bundle.minifyBundle === true) {
                browserifyConfig.debug = true;
            }            
            var bundler = browserify(browserifyConfig);

            var hbsfy = require("hbsfy");
            if (applyImports && bundle.findModuleMapping('handlebars')) {
                // If there's a module mapping for handlebars, then configure handlebarsify to use
                // jenkins-handlebars-rt/runtimes/handlebars3_rt. This is a jenkins-js-modules compatible
                // module "import" version of handlebars, which helps with 2 things:
                // 1. It stops browserify from bundling the full handlebars package, importing it at runtime
                //    instead and therefore making the final bundle lighter.
                // 2. It guarantees that the instance of Handlebars used by the handlebarsify'd templates is
                //    the same as that used by other modules e.g. where helpers are registered. This is one of
                //    the big PITA things about using handlebars with browserify.
                hbsfy = hbsfy.configure({
                    compiler: "require('jenkins-handlebars-rt/runtimes/handlebars3_rt')"
                });
            }            
            bundler.transform(hbsfy);

            if (bundle.bundleTransforms) {
                for (var i = 0; i < bundle.bundleTransforms.length; i++) {
                    bundler.transform(bundle.bundleTransforms[i]);
                }
            }
            
            if (applyImports) {
                addModuleMappingTransforms(bundle, bundler);
            }

            if (bundle.minifyBundle === true) {
                var sourceMap = bundle.as + '.map.json';
                bundler.plugin('minifyify', {
                    map: sourceMap,
                    output: bundleTo + '/' + sourceMap
                });
            }
            
            return bundler.bundle().pipe(source(bundle.bundleOutputFile))
                .pipe(gulp.dest(bundleTo));
        });
    }
    
    // Create a bundle with imports applied/transformed.
    defineBundleTask(bundle, true);
    
    // Define the 'bundle' task again so it picks up the new dependency
    exports.defineTask('bundle', tasks.bundle);
    
    return bundle;
};

exports.logInfo = function(message) {
    gutil.log(gutil.colors.green(message));
};
exports.logWarn = function(message) {
    gutil.log(gutil.colors.magenta(message));
};
exports.logError = function(message) {
    gutil.log(gutil.colors.red(message));
};

exports.getDependency = getDependency;

var tasks = {
    test: function () {
        if (!testSrcPath) {
            exports.logWarn("Warn: Test src path has been unset. No tests to run.");
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

        var testSpecs = testSrcPath + '/**/' + argvValue('--test', '') + '*-spec.js';
        exports.logInfo('Test specs: ' + testSpecs);
        
        global.jenkinsBuilder = exports;
        _startTestWebServer();
        gulp.src(testSpecs)
            .pipe(jasmine({reporter: [terminalReporter, junitReporter, {
                jasmineDone: function () {
                    gulp.emit('testing_completed');
                }                
            }]}));

        exports.logInfo('Test execution completed.');
    },
    bundle: function() {
        if (bundles.length === 0) {
            exports.logWarn("Warning: Skipping 'bundle' task. No 'module' bundles are registered. Call require('jenkins-js-build').bundle([module]) in gulpfile.js.");
        }
    },
    rebundle: function() {
        var watchList = [];

        watchList.push('./index.js');
        for (var i = 0; i < srcPaths.length; i++) {
            var srcPath = srcPaths[i];
            watchList.push(srcPath + '/*.*');
            watchList.push(srcPath + '/**/*.*');
        }
        exports.logInfo('rebundle watch list: ' + watchList);
        
        gulp.watch(watchList, ['bundle']);
    },
    jshint: function() {
        var jshint = require('gulp-jshint');
        var hasJsHintConfig = fs.existsSync(cwd + '/.jshintrc');
        var jshintConfig;
        
        if (!hasJsHintConfig) {
            exports.logInfo('\t- Using default JSHint configuration (in jenkins-js-builder). Override by defining a .jshintrc in this folder.');
            jshintConfig = require('./res/default.jshintrc');
        }        
        function runJsHint(pathSet) {
            for (var i = 0; i < pathSet.length; i++) {
                gulp.src(pathSet[i] + '/**/*.js')
                    .pipe(jshint(jshintConfig))
                    .pipe(jshint.reporter('default'))
                    .pipe(jshint.reporter('fail'));
            }
        }
        runJsHint(srcPaths);
        runJsHint([testSrcPath]);        
    }
};

function addModuleMappingTransforms(bundle, bundler) {
    var moduleMappings = bundle.moduleMappings;

    if (moduleMappings.length > 0) {
        var requireTransform = transformTools.makeRequireTransform("requireTransform",
            {evaluateArguments: true},
            function(args, opts, cb) {
                var required = args[0];
                for (var i = 0; i < moduleMappings.length; i++) {
                    var mapping = moduleMappings[i];
                    if (mapping.from === required) {
                        if (mapping.config.require) {
                            return cb(null, "require('" + mapping.config.require + "')");
                        } else {
                            return cb(null, "require('jenkins-js-modules').require('" + mapping.to + "')");
                        }
                    }
                }
                return cb();
            });
        bundler.transform(requireTransform);
    }
    var importExportApplied = false;
    var importExportTransform = transformTools.makeStringTransform("importExportTransform", {},
        function (content, opts, done) {
            if (!importExportApplied) {
                try {
                    var imports = "";
                    for (var i = 0; i < moduleMappings.length; i++) {
                        var mapping = moduleMappings[i];
                        if (imports.length > 0) {
                            imports += ", ";
                        }
                        imports += "'" + mapping.to + "'";
                    }
    
                    var exportNamespace = 'undefined'; // global namespace
                    var exportModule = '{}'; // exporting nothing (an "empty" module object)
    
                    if (bundle.bundleExportNamespace) {
                        // It's a hpi plugin, so use it's name as the export namespace.
                        exportNamespace = "'" + bundle.bundleExportNamespace + "'";
                    }
                    if (bundle.bundleExport) {
                        // export function was called, so export the module.
                        exportModule = 'module'; // export the module
                    }

                    if(hasJenkinsJsModulesDependency) {
                        // Always call export, even if the export function was not called on the builder instance.
                        // If the export function was not called, we export nothing (see above). In this case, it just 
                        // generates an event for any modules that need to sync on the load event for the module.
                        content += "\n" +
                            "\t\trequire('jenkins-js-modules').export(" + exportNamespace + ", '" + bundle.as + "', " + exportModule + ");";
                    }
    
                    if (imports.length > 0) {
                        var wrappedContent =
                            "require('jenkins-js-modules').whoami('" + bundle.bundleExportNamespace + ":" + bundle.as + "');\n\n" + 
                            "require('jenkins-js-modules')\n" +
                                "    .import(" + imports + ")\n" +
                                "    .onFulfilled(function() {\n" +
                                "\n" +
                                content +
                                "\n" +
                                "    });\n\n";

                        // perform addModuleCSSToPage actions for mappings that requested it.
                        // We don't need the imports to complete before adding these. We can just add
                        // them immediately.
                        var jsmodules = require('jenkins-js-modules/js/internal');                        
                        for (var i = 0; i < moduleMappings.length; i++) {
                            var mapping = moduleMappings[i];
                            var addDefaultCSS = mapping.config.addDefaultCSS;
                            if (addDefaultCSS && addDefaultCSS === true) {
                                var parsedModuleQName = jsmodules.parseResourceQName(mapping.to);
                                wrappedContent += 
                                    "require('jenkins-js-modules').addModuleCSSToPage('" + parsedModuleQName.namespace + "', '" + parsedModuleQName.moduleName + "');\n";                                
                            }
                        }
                        
                        return done(null, wrappedContent);
                    } else {
                        if(hasJenkinsJsModulesDependency) {
                            // Call whoami for "this" bundle. Helps 'jenkins-js-modules' figure out the bundle nsProvider etc.
                            content = "require('jenkins-js-modules').whoami('" + bundle.bundleExportNamespace + ":" + bundle.as + "');\n\n" + content;
                        }
                        return done(null, content);
                    }
                } finally {
                    importExportApplied = true;                    
                }
            } else {
                return done(null, content);
            }
        });    

    bundler.transform(importExportTransform);
}

function less(src, targetDir) {
    var less = require('gulp-less');
    gulp.src(src)
        .pipe(less())
        .pipe(gulp.dest(targetDir));
    exports.logInfo("LESS CSS pre-processing completed to '" + targetDir + "'.");
}

function _startTestWebServer(config) {
    if (!config) {
        config = {}
    }
    if (!config.port) {
        config.port = 18999;
    }
    if (!config.root) {
        config.root = cwd;
    }
    
    if (!testWebServer) {
        // Start a web server that will allow tests to request resources.
        testWebServer = require('node-http-server').deploy(config);
        exports.logInfo('Testing web server started on port ' + config.port + ' (http://localhost:' + config.port + '). Content root: ' + config.root);
    }
}
gulp.on('testing_completed', function() {
    if (testWebServer) {
        testWebServer.close();
        testWebServer = undefined;
        exports.logInfo('Testing web server stopped.');
    }
});

function _stopTestWebServer() {
    if (testWebServer) {
        testWebServer.close();
        testWebServer = undefined;
        exports.logInfo('Testing web server stopped.');
    }
}

function getDependency(depName) {
    var packageJson = require(cwd + '/package.json');
    
    function findDep(onDepMap) {
        if (onDepMap) {
            return onDepMap[depName];
        }
        return undefined;
    }
    
    var version = findDep(packageJson.dependencies);
    if (version) {
        return {
            type: 'runtime',
            version: version
        };
    } else {
        version = findDep(packageJson.devDependencies);
        if (version) {
            return {
                type: 'dev',
                version: version
            };
        } else {
            version = findDep(packageJson.peerDependencies);
            if (version) {
                return {
                    type: 'peer',
                    version: version
                };
            }
            // TODO: bundled and optional deps?
        }
    }
    
    return undefined;
}

function hasJenkinsJsModulesDep() {
    return (getDependency('jenkins-js-modules') !== undefined);
}

function assertHasJenkinsJsModulesDependency(message) {
    if(!hasJenkinsJsModulesDependency) {
        if (!message) {
            message = 'Missing required NPM dependency.';
        }
        exports.logError(message + '\n\t- You must install the jenkins-js-modules NPM package i.e. npm install --save jenkins-js-modules');
        process.exit(1);
    }
}

function isArgvSpecified(argv) {
    return (argvIndex(argv) !== -1);
}

function argvValue(argv, defaultVal) {
    var i = argvIndex(argv);
    if (i >= 0 && i < process.argv.length - 1) {
        // The arg after the argv/name is it's value
        return process.argv[i + 1];
    }
    return defaultVal;    
}

function argvIndex(argv) {
    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === argv) {
            return i;
        }
    }
    return -1;
}

// Defined default tasks. Can be overridden.
exports.defineTasks(['jshint', 'test', 'bundle', 'rebundle']);