describe("dependencies test", function () {

    it("- test", function () {
        var dependecies = require('../dependecies');
        var dep;
        
        dep = dependecies.getDependency('jenkins-js-modules');
        expect(dep.type).toBe('runtime');
        
        dep = dependecies.getDependency('zombie');
        expect(dep.type).toBe('dev');
    });
});
