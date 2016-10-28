var handlebars = require('handlebars');
var testTemplate = handlebars.compile(require('fs').readFileSync(__dirname + '/../js/test.hbs', 'utf8'));
var helloContent = testTemplate({message: 'Hello World'});

// ES6 code ...
var multiply = require('./multiply.es6');
multiply.multiply(2, 3);
//console.log(multiply.multiply(2, 3));

// Load underscore , forcing it to be bundled and an
// import request for it to be made.
require('underscore.string');
// Load some js modules from inside the package i.e. not
// the top level module. These should still be loaded from
// the imported bundle.
require('underscore.string/swapCase');
require('underscore.string/titleize');

document.body.innerHTML = helloContent;
window.testmoduleXYZ = 'Hello';