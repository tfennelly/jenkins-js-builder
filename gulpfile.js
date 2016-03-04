var builder = require('./index.js');

// TODO: come back and clean this up. Enable jshint etc.
builder.lint('none');

builder.src('./internal');

// Create a mock bundle for abcxyz:abcxyzV2. We then use
// this for testing the global withExternalModuleMapping
builder.bundle('spec/abcxyzV2.js', 'abcxyzV2')
    .inDir('jenkins/plugin/abcxyz/jsmodules');

builder.withExternalModuleMapping('abcxyz', 'abcxyz:abcxyzV2');

// Create some test bundles and check them in the specs

//  - No imports 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_1')
    .inDir('target/testmodule');

//  - Has import 
//  - No use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_2')
    .withExternalModuleMapping('underscore.string', 'underscore:under_string2')
    .inDir('target/testmodule');

//  - Has import 
//  - Has use of default CSS 
builder.bundle('spec/testmodule.js', 'testmodule_3')
    .withExternalModuleMapping('underscore.string', 'underscore:under_string2', {addDefaultCSS: true})
    .inDir('target/testmodule')
    .generateNoImportsBundle();

// Create dependency bundles
builder.bundle('underscore.string', 'under_string2')
    .inDir('jenkins/plugin/underscore/jsmodules')
    .export('underscore');
