var builder = require('./index.js');

// TODO: come back and clean this up. Enable jshint etc.
builder.lint('none');

builder.src('./internal');

// Create a mock bundle for abcxyz:abcxyzV2. We then use
// this for testing the global withExternalModuleMapping
builder.bundle('spec/abcxyzV2.js', 'abcxyzV2')
    .inDir('target/classes/org/jenkins/ui/jsmodules/abcxyz')
    .export('abcxyz');

builder.withExternalModuleMapping('abcxyz', 'abcxyz:abcxyzV2');

// Create some test bundles and check them in the specs

//  - No imports 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_1')
    .inDir('target/testmodule');

//  - Has import 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_2')
    .withExternalModuleMapping('underscore.string')
    .inDir('target/testmodule');

//  - Has import 
//  - Has use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_3')
    .withExternalModuleMapping('underscore.string', {addDefaultCSS: true})
    .inDir('target/testmodule')
    .generateNoImportsBundle();