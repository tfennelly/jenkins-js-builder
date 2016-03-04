# Jenkins JS Builder

> __[JIRA](https://issues.jenkins-ci.org/browse/JENKINS/component/21132)__

__Table of Contents__:
<p>
<ul>
    <a href="#overview">Overview</a><br/>
    <a href="#features">Features</a><br/>
    <a href="#install">Install</a><br/>
    <a href="#general-usage">General Usage</a><br/>
    <a href="#predefined-gulp-tasks">Predefined Gulp Tasks</a><br/>
    <a href="#bundling">Bundling</a><br/>
    <a href="#setting-src-and-test-spec-paths">Setting 'src' and 'test' (spec) paths</a><br/>
    <a href="#command-line-options">Command line options</a><br/>
    <a href="#maven-integration">Maven Integration</a><br/>
    <a href="https://github.com/jenkinsci/js-samples">Sample Plugins (Jenkins - HPI)</a><br/>    
    <a href="https://issues.jenkins-ci.org/browse/JENKINS/component/21132">JIRA</a><br/>    
</ul>    
</p>

<hr/>

# Overview
[NPM] utility for building [CommonJS] module [bundle]s (and optionally making them __[js-modules]__ compatible).

> See __[js-modules]__.

The following diagram illustrates the basic flow (and components used) in the process of building a [CommonJS] module [bundle]. 
It uses a number of popular JavaScript and maven tools ([CommonJS]/[node.js], [Browserify], [Gulp], [frontend-maven-plugin] and more).

<p align="center">
    <a href="https://github.com/jenkinsci/js-modules" target="_blank">
        <img src="res/build_workflow.png" alt="Jenkins Module Bundle Build Workflow">
    </a>
</p>
  
The responsibilities of the components in the above diagram can be summarized as follows:

* __[CommonJS]__: JavaScript module system (i.e. the expected format of JavaScript modules). This module system works with the nice/clean synchronous `require` syntax synonymous with [node.js] (for module loading) e.g. `var mathUtil = require('../util/mathUtil');`. This allows us to tap into the huge [NPM] JavaScript ecosystem.
* __[Browserify]__: A build time utility ([NPM] package - executed as a [Gulp] "task") for "bundling" a graph of [CommonJS] style modules together, producing a single JavaScript file ([bundle]) that can be loaded (from a single request) in a browser. [Browserify] ensures that the `require` calls (see above) resolve properly to the correct module within the [bundle].
* __[Gulp]__: A JavaScript build system ([NPM] package), analogous to what Maven is for Java i.e. executes "tasks" that eventually produce build artifacts. In this case, a JavaScript __[bundle]__ is produced via [Gulp]s execution of a [Browserify] "task".
* __[frontend-maven-plugin]__: A Maven plugin that allows us to hook a [Gulp] "build" into a maven build e.g. for a Jenkins plugin. See <a href="#maven-integration">Maven Integration</a> below.

# Features
`js-builder` does a number of things:

1. Runs [Jasmine] tests/specs and produce a JUnit report that can be picked up by a top level Maven build.
1. Uses [Browserify] to produce a [CommonJS] module __[bundle]__ file from a "main" [CommonJS] module (see the `bundle` task below). The [bundle] file is typically placed somewhere on the filesystem that allows a higher level Maven build to pick it up and include it in e.g. a Jenkins plugin HPI file (so it can be loaded by the browser at runtime). 
1. Pre-process [Handlebars] files (`.hbs`) and include them in the __[bundle]__ file (see 2 above).
1. __Optionally__ pre-process a [LESS] fileset to a `.css` file that can be picked up by the top level Maven build and included in the e.g. a Jenkins plugin HPI file. See the `bundle` task below.
1. __Optionally__ perform module transformations (using a [Browserify Transform](https://github.com/substack/browserify-handbook#transforms)) that "link" in [Framework lib]s (`import` - see [js-modules]), making the [bundle] a lot lighter by allowing it to use a shared instance of the [Framework lib] Vs it being included in the [bundle]. This can easily reduce the size of a [bundle] from e.g. 1Mb to 50Kb or less, as [Framework lib]s are often the most weighty components. See the `bundle` task below.
1. __Optionally__ `export` (see [js-modules]) the [bundle]s "main" [CommonJS] module (see 2 above) so as to allow other [bundle]s `import` it i.e. effectively making the bundle a [Framework lib] (see 5 above). See the `bundle` task below.

# Install

```
npm install --save-dev @jenkins-cd/js-builder
```

> This assumes you have [node.js] v4.0.0 (minimum) installed on your local development environment.

> Note this is only required if you intend developing [js-modules] compatible module bundles. Plugins using this should automatically handle all build aspects via maven (see later) i.e. __simple building of a plugin should require no machine level setup__.

# General Usage

Add a `gulpfile.js` (see [Gulp]) in the same folder as the `package.json`. Then use `js-builder` as follows:

```javascript
var builder = require('@jenkins-cd/js-builder');

builder.defineTasks(['test', 'bundle', 'rebundle']);

builder.bundle('./index.js', 'myappbundle.js').inAdjunctPackage('com.acme');

```

__Notes__:

* See the "`defineTasks`" section for details of the available tasks.
* See the "`bundle`" section for details of the `bundle` command.

## `defineTasks`

`js-builder` makes it possible to easily define a number of tasks. No tasks are turned on by default,
so you can also just define your own tasks. To use the tasks defined in `js-builder`, simply call
the `defineTasks` function:

```javascript
builder.defineTasks(['test', 'bundle', 'rebundle']);
```

See next section.


# Predefined Gulp Tasks

The following sections describe the available predefined [Gulp] tasks. The `bundle` and `test` tasks are
auto-installed as the default tasks.

## 'test' Task

Run all Jasmine style tests. The default location for tests is the `spec` folder. The file names need to match the
pattern "*-spec.js". The default location can be overridden by calling `builder.tests(<new-path>)`.

See [jenkins-js-test] for more on testing.

## 'bundle' Task 
Run the 'bundle' task. See detail on this in the <a href="#bundling">dedicated section titled "Bundling"</a> (below). 
 
## 'rebundle' Task

Watch module source files (`index.js`, `./lib/**/*.js` and `./lib/**/*.hbs`) for change, auto-running the
`bundle` task whenever changes are detected.

Note that this task will not be run by default, so you need to specify it explicitly on the gulp command in
order to run it e.g.

```
gulp rebundle
```

# Bundling
As stated in the "Features" section above, much of the usefulness of `js-builder` lies in how it
helps with the bundling of the different JavaScript and CSS components:

1. Bundling [CommonJS] modules to produce a JavaScript [bundle]. 
1. Bundling [LESS] resource to produce a `.css` file. 
1. Bundling [Handlebars] templates (`hbs`) into the JavaScript [bundle].
 
It also helps with __[js-modules]__ compatibility i.e. handling `import`s and `export`s so as to allow
slimming down of your "app" [bundle].

## Step 1: Create Bundle Spec
Most of the bundling options are configured on the "Bundle Spec", which is an object returned from
a call to the `bundle` function on the `builder`:

```javascript
var bundleSpec = builder.bundle('<path-to-main-module>', '<bundle-name>');
```

* `path-to-main-module`: The path to the "main" [CommonJS] module, from which [Browserify] will start the bundling process (see [Browserify] for more details). E.g. `'js/bootstrap3.js'`.  
* `bundle-name` __(Optional)__: The name of the bundle to be generated. If not specified, the "main" module name will be used.  

## Step 2: Specify Bundle Output Location
`js-builder` lets you configure where the generated [bundle] is output to. There are 3 possible
options for this.

> __Option 1__: Bundle as a [js-modules] "resource", which means it will be placed in the
> `./src/main/webapp/jsmodules` folder, from where it can be `import`ed at runtime. This option
> should be used in conjunction with `bundleSpec.export()` (see below).

```javascript
bundleSpec.asJenkinsModuleResource();
```

> __Option 2__: Bundle in a specified directory/folder.

```javascript
bundleSpec.inDir('<path-to-dir>');
```

> __Option 3__: Bundle as an "adjunct", which means the bundle is put into a package 
> in `./target/generated-adjuncts/`. If using this option, make sure the project's
> `pom.xml` has the appropriate build `<resource>` configuration (see below).
>
> Of course, you can also just use the `bundleSpec.inDir` option (num 2 above) if you'd prefer to handle
> adjuncts differently i.e. use `bundleSpec.inDir` to generate the bundle into a dir that gets picked up by your
> maven build, placing the bundle in the correct place on the Java classpath.

```javascript
bundleSpec.inAdjunctPackage('com.acme');
```

An example of how to configure the build `<resource>` in your `pom.xml`
file (if using `inAdjunctPackage`), allowing the adjunct to be referenced from a Jelly file.

```xml
<build>
    <resources>
        <resource>
            <directory>src/main/resources</directory>
        </resource>
        <resource>
            <directory>target/generated-adjuncts</directory>
        </resource>
    </resources>
</build>
```

## Step 3 (Optional): Specify LESS Processing
Specify a [LESS] file for pre-processing to CSS:

```javascript
bundleSpec.less('js/bootstrap3/style.less');
```

The output location for the generated `.css` file depends on the output location chosen for the [bundle]. See __Step 2__ above.  

## Step 4 (Optional): Specify "external" Module Mappings (imports)
Some of the [NPM] packages used by your "app" [bundle] will be common [Framework lib]s that, for performance reasons,
you do not want bundled in every "app" [bundle]. Instead, you would prefer all "app" bundles to share an instance of
these common [Framework lib]s.

That said, you would generally prefer to code your application's [CommonJS] modules as normal, using the more 
simple/intuitive [CommonJS] style `require` syntax (synch), and forget about performance optimizations until
later (build time). When doing it this way, your [CommonJS] module code should just `require` the [NPM] packages it
needs and just use them as normal e.g.

```javascript
var moment = require('moment');

moment().format('MMMM Do YYYY, h:mm:ss a');
```
    
The above code will work fine as is (without performing any mappings), but the downside is that your app bundle will be more bloated as it will
include the `moment` NPM module. To lighten your bundle for the browser (by using a shared instance of the `moment`
NPM module), we tell the `builder` (via the `bundleSpec`) to "map" (transform) all synchronous `require` calls for `moment` to async 
`import`<sub>s</sub> of the `momentjs:momentjs2` [Framework lib] [bundle]
([see the momentjs framwork lib bundle](https://github.com/jenkinsci/js-libs/tree/master/momentjs)).

```javascript
bundleSpec.withExternalModuleMapping('moment', 'momentjs:momentjs2');
```

Of course your "app" bundle may depend on a number of weighty [Framework lib]s that you would prefer not to
include in your bundle. If so, simply call `withExternalModuleMapping` for each.

### Step 4.1 (Optional): Generating a "no_imports" bundle

Externalizing commons [Framework lib]s (<a href="#step-4-optional-specify-external-module-mappings-imports">see Step 4</a>)
is important in terms of producing a JavaScript [bundle] that can be used in production (is lighter etc), but can make
things a bit trickier when it comes to Integration Testing your bundle because your test (and test environment) will now need to
accommodate the fact that your bundle no longer contains all the [Framework lib]s it depends on.

For that reason, `js-builder` supports the `generateNoImportsBundle` option, which tells the builder to also generate
a [bundle] that includes all of it's dependency [Framework lib]s i.e. a [bundle] which does not apply imports (hence "no_imports").

```javascript
bundleSpec.generateNoImportsBundle();
```

> Note that this is an additional [bundle] i.e. not instead of the "main" bundle (in which "imports" are applied).

With this option set, the "no_imports" bundle is generated into a sub-folder named "no_imports", inside the same
folder in which the "main" bundle is generated.

> For an example of how to use the `generateNoImportsBundle` option, see the <a href="https://github.com/jenkinsci/js-samples/tree/master/step-08-zombie-tests">"step-08-zombie-tests" Integration Test sample plugin</a>.

## Step 5 (Optional): Export
Exporting the "main" module (allowing other bundle modules to `import` it) from the [bundle] is easy:

```javascript
bundleSpec.export();
```
The `builder` will use the plugin's `artifactId` from the `pom.xml` (which becomes the plugin ID), as well as the
bundle name (normalised from the bundle name specified during __Step 1__) to determine the `export` bundle ID for
the module.

For example, if the plugin's `artifactId` is "acmeplugin" and the bundle name specified is "acme.js", then the
module would be exported as `acmeplugin:acme`. The package associated with the "acme.js" module should also be
"published" to [NPM] so as to allow "app" bundles that might use it to add a `dev` dependency on it (so tests
etc can run). 

So how would an "app" bundle in another plugin use this later?

It would need to:

1. Add a normal HPI dependency on "acmeplugin" (to make sure it gets loaded by Jenkins so it can serve the bundle).
1. Add a `dev` dependency on the package associated with the "acme.js" module i.e. `npm install --save-dev acme`. This allows the next step will work (and tests to run etc).
1. In the "app" bundle modules, simply `require` and use the `acme` module e.g. `var acme = require('acme');`.
1. In the "app" bundle's `gulpfile.js`, add a `withExternalModuleMapping` e.g. `bundleSpec.withExternalModuleMapping('acme', 'acmeplugin:acme');`.
  
See __Step 4__ above.  

## Step 6 (Optional): Minify bundle JavaScript

This can be done by calling `minify` on `js-builder`:

```javascript
bundleSpec.minify();
```

Or, by passing `--minify` on the command line. This will result in the minification of all generated bundles.
 
```sh
$ gulp --minify
```

# Setting 'src' and 'test' (spec) paths
The default paths depend on whether or not running in a maven project.

For a maven project, the default source and test/spec paths are:

* __src__: `./src/main/js` and `./src/main/less` (used primarily by the `rebundle` task, watching these folders for source changes)
* __test__: `./src/test/js` (used by the `test` task)

Otherwise, they are:

* __src__: `./js` and `./less` (used primarily by the `rebundle` task, watching these folders for source changes)
* __test__: `./spec` (used by the `test` task)



Changing these defaults is done through the `builder` instance e.g.:

```javascript
var builder = require('@jenkins-cd/js-builder');

builder.src('src/main/js');
builder.tests('src/test/js');
```

You can also specify an array of `src` folders e.g.

```javascript
builder.src(['src/main/js', 'src/main/less']);
```

# Command line options

A number of `js-builder` options can be specified on the command line.

## `--minify`

Passing `--minify` on the command line will result in the minification of all generated bundles.
 
```sh
$ gulp --minify
```

## `--test`


Run a single test.
 
```sh
$ gulp --test configeditor
```

The above example would run test specs matching the `**/configeditor*-spec.js` pattern (in the test source directory).

# Maven Integration
Hooking a [Gulp] based build into a Maven build involves adding a few Maven `<profile>`s to the
Maven project's `pom.xml`.

We have extracted these into a [sample_extract_pom.xml](res/sample_extract_pom.xml)
from which they can be copied.

> __NOTE__: We hope to put these `<profile>` definitions into one of the top level Jenkins parent POMs. Once that's 
> done and your project has that parent POM as a parent, then none of this will be required.

With these `<profiles>`s installed, Maven will run [Gulp] as part of the build. 

> - runs `npm install` during the `initialize` phase, 
> - runs `gulp bundle` during the `generate-sources` phase and
> - runs `gulp test` during the `test` phase). 

You can also execute:

* `mvn clean -DcleanNode`: Cleans out the local node and NPM artifacts and resource (including the `node_modules` folder).

[bundle]: https://github.com/jenkinsci/js-modules/blob/master/FAQs.md#what-is-the-difference-between-a-module-and-a-bundle
[js-modules]: https://github.com/jenkinsci/js-modules
[js-builder]: https://github.com/jenkinsci/js-builder
[jenkins-js-test]: https://github.com/jenkinsci/js-test
[NPM]: https://www.npmjs.com/
[CommonJS]: http://www.commonjs.org/
[node.js]: https://nodejs.org/en/
[Browserify]: http://browserify.org/
[Gulp]: http://gulpjs.com/
[frontend-maven-plugin]: https://github.com/eirslett/frontend-maven-plugin
[intra-bundle]: https://github.com/jenkinsci/js-modules/blob/master/FAQs.md#what-does-module-loading-mean
[inter-bundle]: https://github.com/jenkinsci/js-modules/blob/master/FAQs.md#what-does-module-loading-mean
[io.js]: https://iojs.org
[Framework lib]: https://github.com/jenkinsci/js-libs
[LESS]: http://lesscss.org/
[Handlebars]: http://handlebarsjs.com/
[Jasmine]: http://jasmine.github.io/
[Moment.js]: http://momentjs.com/
