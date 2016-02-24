var paths = require('../internal/paths');
var cwd = process.cwd();

describe("paths test", function () {

    it("- test getAbsoluteJSRoot", function () {
        expect(paths.getAbsoluteJSRoot()).toBe(cwd + '/js');
    });

    it("- test toAbsoluteJSPath", function () {
        expect(paths.toAbsoluteJSPath('menu/MyWidget')).toBe(cwd + '/js/menu/MyWidget');
    });
});