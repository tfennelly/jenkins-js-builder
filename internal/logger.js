var gutil = require('gulp-util');

exports.logInfo = function(message) {
    gutil.log(gutil.colors.green(message));
};
exports.logWarn = function(message) {
    gutil.log(gutil.colors.magenta(message));
};
exports.logError = function(message) {
    gutil.log(gutil.colors.red(message));
};