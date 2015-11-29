var builder = require('./index.js');

// Create some test bundles and check them in the specs

//  - No imports 
//  - No use of default CSS 
//  - No export 
builder.bundle('spec/testmodule.js', 'testmodule_1')
    .inDir('target/testmodule');

//  - Has import 
//  - No use of default CSS 
//  - No export 
builder.bundle('spec/testmodule.js', 'testmodule_2')
    .withExternalModuleMapping('underscore.string', 'underscore:under_string2')
    .inDir('target/testmodule');
