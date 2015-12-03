var builder = require('./index.js');

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
