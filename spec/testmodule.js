var testTemplate = require("../js/test.hbs");
var helloContent = testTemplate({message: 'Hello World'});

// Load underscore
require('underscore.string');

document.body.innerHTML = helloContent;
window.testmoduleXYZ = 'Hello';