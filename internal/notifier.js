var notifier = require('node-notifier');
var path = require('path');
var maven = require('./maven');

exports.notify = function(title, message) {
    if (maven.isMavenProject) {
        notifier.notify({
            title: title,
            subtitle: 'Module: ' + maven.getArtifactId(),
            message: message,
            icon: path.join(__dirname, '../jenkins.png')
        });
    } else {
        notifier.notify({
            title: title,
            message: message,
            icon: path.join(__dirname, '../jenkins.png')
        });
    }
};