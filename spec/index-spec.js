var Browser = require("zombie");
var fs = require('fs');

var cwd = process.cwd();
console.log('***** ' + fs.existsSync(cwd + '/target/testmodule/testmodule_1.js'));

describe("index.js", function () {

    it("- test testmodule_1", function (done) {
        var browser = new Browser();
        var jsLoads = [];

        browser.debug();
        browser.on('request', function(request) {
            var url = request.url;
            if (endsWith(url, '.js')) {
                jsLoads.push(url);
            }
        });
        
        browser.visit('http://localhost:18999/spec/testmodule_1.html', function() {
            expect(browser.success).toBe(true);
            
            // Make sure all the scripts were loaded as expected.
            expect(browser.success).toBe(true);
            expect(jsLoads[0]).toBe('http://localhost:18999/target/testmodule/testmodule_1.js');
            
            done();
        });
    });

    it("- test testmodule_2", function (done) {
        var browser = new Browser();
        var jsLoads = [];

        browser.debug();
        browser.on('request', function(request) {
            var url = request.url;
            if (endsWith(url, '.js')) {
                jsLoads.push(url);
            }
        });
        
        browser.visit('http://localhost:18999/spec/testmodule_2.html', function() {
            expect(browser.success).toBe(true);
            
            // Make sure all the scripts were loaded as expected.
            expect(browser.success).toBe(true);
            expect(jsLoads[0]).toBe('http://localhost:18999/target/testmodule/testmodule_2.js');
            
            done();
        });
    });
});

function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}