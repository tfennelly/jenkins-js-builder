Modifying `jenkins-js-builder` and testing it locally with another package (before `npm publish`)
can be a little "tricky" when that other package also uses `gulp` for building. `npm link`ing
the `jenkins-js-builder` package into the other package is not going to be enough.

For that reason, I (Tom Fennelly) have a local `npm link`ed copy of `gulp`. Then, I `npm link gulp`
in both `jenkins-js-builder` and the package I'm using to test.