describe("dependencies test", function () {

    it("- test", function () {
        var builder = require('../dependecies');
        var dep;
        
        dep = builder.getDependency('jenkins-js-modules');
        expect(dep.type).toBe('runtime');
        
        dep = builder.getDependency('zombie');
        expect(dep.type).toBe('dev');
    });
});
