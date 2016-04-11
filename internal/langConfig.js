var dependencies = require('./dependecies');
var paths = require('./paths');
var logger = require('./logger');

// Default language level is 5.
exports.ecmaVersion = 5;

// Run some checks that might hint at the best default language level....

// If there's a dependency on the es2015 preset, then default to ES6 code.
if (dependencies.getDependency('babel-preset-es2015')) {
    logger.logInfo('Changing default language level to ECMA v6. Found "babel-preset-es2015" dependency in package.json.');
    exports.ecmaVersion = 6;
} else if (paths.hasSourceFiles('jsx')) {
    logger.logInfo('Changing default language level to ECMA v6. Found ".jsx" src files.');
    exports.ecmaVersion = 6;
} else if (paths.hasSourceFiles('es6')) {
    logger.logInfo('Changing default language level to ECMA v6. Found ".es6" src files.');
    exports.ecmaVersion = 6;
}

logger.logInfo('Language level set to ECMA v' + exports.ecmaVersion + '. Call builder.lang([number]) to change.');
