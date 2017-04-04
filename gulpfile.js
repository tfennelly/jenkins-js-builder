var builder = require('./index.js');

// TODO: come back and clean this up. Enable jshint etc.
builder.lint('none');

builder.src(['./internal', './js']);

// Create a mock bundle for abcxyz:abcxyzV2. We then use
// this for testing the global withExternalModuleMapping
builder.bundle('spec/abcxyzV2.js').namespace('abcxyz');

builder.import('abcxyz', 'abcxyz:abcxyzV2');

// Create some test bundles and check them in the specs

//  - No imports 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_1')
    .inDir('target/testmodule');

//  - Has import 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_2')
    .import('underscore.string')
    .inDir('target/testmodule');

//  - Has import 
//  - Has use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_3')
    .import('underscore.string', {addDefaultCSS: true})
    .inDir('target/testmodule')
    .onStartup('./spec/startup-module-1.js')
    .onStartup('./spec/startup-module-2.js')
    .generateNoImportsBundle();

//  - bundle "as" with a version - no prerelease tag 
builder.bundle('spec/testmodule.js', 'testmodule@1.1.1')
    .inDir('target/testmodule');

//  - bundle "as" with a version - has a prerelease tag
//  - the prerelease tag should get dropped
builder.bundle('spec/testmodule.js', 'testmodule@1.1.2-beta1')
    .inDir('target/testmodule');

// Let's bundle some CSS ...
builder.bundle('spec/frameworkx/style.css');
builder.bundle('spec/frameworky/style.less');

// An externalized package where the name has an NPM org in it 
builder.bundle('spec/testmodule.js', 'testmodule_ext_org')
    .import('@jenkins-cd/js-modules')
    .inDir('target/testmodule');