var decamelize = require('decamelize');

exports.isArgvSpecified = function(argv) {
    return (exports.argvIndex(argv) !== -1);
};

exports.argvValue = function(argv, defaultVal) {
    var i = exports.argvIndex(argv);
    if (i >= 0 && i < process.argv.length - 1) {
        // The arg after the argv/name is it's value
        return process.argv[i + 1];
    }
    return defaultVal;    
};

exports.argvIndex = function(argv) {
    var index = _argvIndex(argv);
    if (index === -1 && typeof argv === 'string' && argv.indexOf('--') === 0) {
        // For some dumb reason, gulp-runner thought it would be a good idea to
        // dick around with the arg names, decamelizing them. Lets see can we
        // find the arg that way, if it starts with '--'.
        return _argvIndex(decamelize(argv, '-'));
    } else {
        return index;
    }
};

function _argvIndex(argv) {
    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === argv) {
            return i;
        }
    }
    return -1;
}