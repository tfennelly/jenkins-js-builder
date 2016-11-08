describe("dependencies test", function () {

    it("- getDependency", function () {
        var dependecies = require('../internal/dependecies');
        var dep;
        
        dep = dependecies.getDependency('@jenkins-cd/js-modules');
        expect(dep.type).toBe('dev');
        
        dep = dependecies.getDependency('zombie');
        expect(dep.type).toBe('dev');
    });

    it("- getInstalledDependantsOf - not in organization", function () {
        var dependecies = require('../internal/dependecies');
        var dependants;

        dependants = dependecies.getInstalledDependantsOf('babel-types');
        expect(dependants.length).toBeGreaterThan(1);
        // let's make sure that at least babel-core is in the list
        dependants = dependants.filter(function(dependant) {
            return dependant.moduleName === 'babel-core';
        });
        expect(dependants.length).toBe(1);
    });

    it("- getInstalledDependantsOf - in organization", function () {
        var dependecies = require('../internal/dependecies');
        var dependants;

        dependants = dependecies.getInstalledDependantsOf('eslint-config-airbnb');
        expect(dependants.length).toBe(1);
        var moduleSpec = dependants[0];
        expect(moduleSpec.moduleName).toBe('@jenkins-cd/eslint-config-jenkins');
    });

    it("- getDefinedDependantsOf - in organization", function () {
        var dependecies = require('../internal/dependecies');
        var dependants;

        dependants = dependecies.getDefinedDependantsOf('eslint-config-airbnb');
        expect(dependants.length).toBe(1);
        var moduleSpec = dependants[0];
        expect(moduleSpec.moduleName).toBe('@jenkins-cd/eslint-config-jenkins');
    });

    it("- getDefinedDependantsOf - not in organization", function () {
        var dependecies = require('../internal/dependecies');
        var dependants;

        dependants = dependecies.getDefinedDependantsOf('through2');
        //console.log(dependants);
        expect(dependants.length).toBe(9);
        expect(dependants[0].moduleName).toBe('brfs');
        expect(dependants[1].moduleName).toBe('browser-pack');
        expect(dependants[2].moduleName).toBe('browserify');
    });
});
