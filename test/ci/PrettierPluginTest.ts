/**
 * Test the Prettier plugin
 */

import * as stock_assert from "assert"
import * as os from "os"
import * as path from "path"

import { Assertor } from "./Assert"
import {
    awaitEditorMode,
    createNewFile,
    getElementByClassName,
    getTemporaryFilePath,
    insertText,
    navigateToFile,
    useTempWorkspace,
} from "./Common"

import * as Oni from "oni-api"

interface IPluginManager {
    getPlugin(name: string): any
}

interface IPrettierPlugin {
    checkCompatibility(filePath: string): boolean
    applyPrettier(): void
    checkPrettierrc(): boolean
}

export const settings = {
    config: {
        "oni.useDefaultConfig": true,
        "oni.loadInitVim": false,
        "oni.plugins.prettier": {
            settings: {
                semi: false,
                tabWidth: 2,
                useTabs: false,
                singleQuote: false,
                trailingComma: "es5",
                bracketSpacing: true,
                jsxBracketSameLine: false,
                arrowParens: "avoid",
                printWidth: 80,
            },
            formatOnSave: true,
            enabled: true,
            allowedFiletypes: [".js", ".jsx", ".ts", ".tsx", ".md", ".html", ".json", ".graphql"],
        },
    },
}

export async function test(oni: Oni.Plugin.Api) {
    const assert = new Assertor("Prettier-plugin")
    await oni.automation.waitForEditors()
    await oni.automation.waitFor(() => oni.plugins.loaded)
    // Switch to temporary workspace.
    const rootPath = await useTempWorkspace(oni)
    // Open file in workspace.
    await navigateToFile(path.join(rootPath, "src", "File.ts"), oni)
    // Insert text to be prettified.
    await insertText(oni, "function test(){console.log('test')};")
    // Assert that plugin exists.
    const prettierPlugin: IPrettierPlugin = await oni.plugins.getPlugin("oni-plugin-prettier")
    assert.defined(prettierPlugin, "plugin instance")
    assert.defined(prettierPlugin.applyPrettier, "plugin formatting method")
    const { activeBuffer } = oni.editors.activeEditor
    assert.assert(
        prettierPlugin.checkCompatibility(activeBuffer.filePath),
        "If valid filetype prettier plugin check should return true",
    )

    // Test that in a Typescript file the plugin formats the buffer on save
    oni.automation.sendKeys("0")
    oni.automation.sendKeys(":")
    oni.automation.sendKeys("w")
    oni.automation.sendKeys("<enter>")

    await oni.automation.sleep(5000)

    const bufferText = await activeBuffer.getLines()
    const bufferString = bufferText.join(os.EOL)
    assert.assert(!bufferString.includes(";"), "Semi colons are removed from the text")
    assert.assert(!bufferString.includes("'"), "Single quotes are removed from the formatted text")
    assert.assert(bufferText.length === 3, "The code is split into 3 lines")
    // Test that the prettier status bar item is present
    oni.automation.waitFor(() => !!getElementByClassName("prettier"))
}
