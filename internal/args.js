
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
    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i] === argv) {
            return i;
        }
    }
    return -1;
};