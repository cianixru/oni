module.exports = {
    bail: true,
    verbose: true,
    collectCoverage: true,
    coverageDirectory: "<rootDir>/coverage/",
    collectCoverageFrom: ["**/components/*.{tsx}", "!**/node_modules/**", "!**/dist/**"],
    setupFiles: ["<rootDir>/ui-tests/jestsetup.ts"],
    moduleNameMapper: {
        electron: "<rootDir>/ui-tests/mocks/electronMock.ts",
        PersistentSettings: "<rootDir>/ui-tests/mocks/PersistentSettings.ts",
        Utility: "<rootDir>/ui-tests/mocks/Utility.ts",
        Configuration: "<rootDir>/ui-tests/mocks/Configuration.ts",
        KeyboardLayout: "<rootDir>/ui-tests/mocks/keyboardLayout.ts",
    },
    snapshotSerializers: ["enzyme-to-json/serializer"],
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    modulePathIgnorePatterns: ["<rootDir>/dist/"],
    globals: {
        "ts-jest": {
            babelConfig: {
                env: {
                    test: {
                        plugins: ["dynamic-import-node"],
                    },
                },
            },
            tsConfigFile: "./ui-tests/tsconfig.react.json",
        },
    },
}
