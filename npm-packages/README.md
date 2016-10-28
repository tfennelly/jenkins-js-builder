This directory contains NPM "package list files" for NPM packages that are
"imported" into JavaScript bundles generated by this module. These files are automatically
generated/regenerated by [js-builder]. They should __NEVER__ be manually edited.

NPM "package list files" streamline the build process for creating JS bundles for "import".
Import bundles are created for "externalized" packages i.e. where [js-builder] `bundle`
is called and configured to `import` specific dependency packages. The bundling process
needs a full list of all the JavaScript resources in the imported/externalized NPM package.
Only then can it generate a complete bundle for the externalized package. NPM "package list files"
contain that list of files for a given NPM dependency.

Generating the list can be slow'ish, which is why [js-builder] auto-generates these list files and
makes them available for storage with the source project, removing the build overhead for later
builds so long as the version does not change, at which point [js-builder] will regenerate the file.

[js-builder]: https://github.com/jenkinsci/js-builder