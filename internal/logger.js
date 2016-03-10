var gutil = require('gulp-util');
var notifier = require('node-notifier');
var builder = require('../index');
var path = require('path');

exports.logInfo = function(message) {
    gutil.log(gutil.colors.green(message));
};
exports.logWarn = function(message) {
    gutil.log(gutil.colors.magenta(message));
};
exports.logError = function(message, notifyTitle) {
    if (notifyTitle) {
        gutil.log(gutil.colors.red(notifyTitle));
    }
    gutil.log(gutil.colors.red(message));
    if (notifyTitle && (builder.isRebundle() || builder.isRetest())) {
        notifier.notify({
            title: notifyTitle,
            message: message,
            icon: path.join(__dirname, '../jenkins.png')
        });
    }
};
