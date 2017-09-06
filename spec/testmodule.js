var handlebars = require('handlebars');
var testTemplate = handlebars.compile(require('fs').readFileSync(__dirname + '/../js/test.hbs', 'utf8'));
var helloContent = testTemplate({message: 'Hello World'});

// ES6 code ...
var multiply = require('./multiply.es6');
multiply.multiply(2, 3);
//console.log(multiply.multiply(2, 3));

// Load underscore.string, forcing it to be bundled and an
// import request for it to be made.
require('underscore.string');

// Load underscore.string/endsWith.js, This should also be stubbed out.
require('underscore.string/endsWith.js');

document.body.innerHTML = helloContent;
window.testmoduleXYZ = 'Hello';