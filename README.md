# Overview

Builder utilities for Jenkins CommonJS modules.

## Install

```
npm install --save-dev jenkins-js-builder
```

## Usage

Add a `gulpfile.js` in the same folder as the `package.json`. Then use `jenkins-js-builder` as follows:

```javascript
var builder = require('jenkins-js-builder');

builder.defineTasks(['test', 'bundle', 'rebundle']);

builder.bundle('./index.js', 'myappbundle.js').inAdjunctPackage('com.acme');

```

__Notes__:

* See the "`defineTasks`" section for details of the available tasks.
* See the "`bundle`" section for details of the `bundle` command.

## `defineTasks`

`jenkins-js-builder` makes it possible to easily define a number of tasks. No tasks are turned on by default,
so you can also just define your own tasks. To use the tasks defined in `jenkins-js-builder`, simply call
the `defineTasks` function:

```
builder.defineTasks(['test', 'bundle', 'rebundle']);
```

The following sections describe the available tasks.

### `test` 

Run all Jasmine style tests. The default location for tests is the `spec` folder. The file names need to match the
pattern "*-spec.js". The default location can be overridden by calling `builder.tests()`.

### `bundle` 

Create a Browserify Javascript bundle. 

You can generate the bundle as a Jenkins adjunct:
 
```
builder.bundle('./index.js', 'myappbundle.js').inAdjunctPackage('com.acme');
```

This simply means the bundle is put into a package 
in `./target/generated-adjuncts/`. That folder can then be added as a build resource in your `pom.xml`
file, allowing the adjunct to be referenced from a Jelly file.

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

Alternatively, you can generate the bundle as a `jenkins-modules` style module:
 
```
builder.bundle('./index.js', 'myjenkinsmodule.js').asJenkinsModuleResource();
```

This simply means the module will be put into the `webapp` folder, making it loadable (as an external 
"plugin module") from the browser as a plugin resource. 
 
## `rebundle`

Watch module source files (`index.js`, `./lib/**/*.js` and `./lib/**/*.hbs`) for change, auto-running the
`bundle` task whenever changes are detected.

Note that this task will not be run by default, so you need to specify it explicitly on the gulp command in
order to run it e.g.

```
gulp rebundle
```