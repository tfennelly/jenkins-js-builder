var testTemplate = require("../js/test.hbs");
var helloContent = testTemplate({message: 'Hello World'});

// ES6 code ...
var multiply = require('./multiply.es6');
multiply.multiply(2, 3);
//console.log(multiply.multiply(2, 3));

// Load underscore , forcing it to be bundled and an
// import request for it to be made.
require('underscore.string');

document.body.innerHTML = helloContent;
window.testmoduleXYZ = 'Hello';