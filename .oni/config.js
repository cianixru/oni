// For more information on customizing Oni,
// check out our wiki page:
// https://github.com/onivim/oni/wiki/Configuration

const activate = oni => {
    console.log("Oni config activated")
}

const deactivate = () => {
    console.log("Oni config deactivated")
}

module.exports = {
    activate,
    deactivate,
    "workspace.testFileMappings": [
        {
            sourceFolder: "browser/src",
            mappedFolder: "browser/test",
            mappedFileName: "${fileName}Tests.ts",
            templateFilePath: ".oni/templates/UnitTestTemplate.ts.template",
        },
    ],
}
