/**
 * Test the Markdown-preview plugin
 */

import { Assertor } from "./Assert"
import { getTemporaryFilePath, navigateToFile } from "./Common"

import * as Oni from "oni-api"

interface IMarkdownPreviewPlugin {
    isPaneOpen(): boolean
    getUnrenderedContent(): string
    getRenderedContent(): string
}

export const settings = {
    config: {
        "experimental.markdownPreview.enabled": true,
    },
}

export async function test(oni: Oni.Plugin.Api) {
    const assert = new Assertor("Markdown-preview")

    await oni.automation.waitForEditors()

    await oni.automation.waitFor(() => oni.plugins.loaded)
    const markdownPlugin = oni.plugins.getPlugin(
        "oni-plugin-markdown-preview",
    ) as IMarkdownPreviewPlugin
    assert.defined(markdownPlugin, "plugin instance")

    assert.assert(!markdownPlugin.isPaneOpen(), "Preview pane is not initially closed")

    await navigateToFile(getTemporaryFilePath("md"), oni)
    await oni.automation.waitFor(() => markdownPlugin.isPaneOpen())
    assert.isEmpty(
        markdownPlugin.getUnrenderedContent().trim(),
        "Preview pane for empty Markdown buffer",
    )

    await insertText(oni, "# Title 1")
    assert.contains(
        markdownPlugin.getRenderedContent(),
        ">Title 1</h1>",
        "Preview pane with rendered header element",
    )
}

async function awaitEditorMode(oni: Oni.Plugin.Api, mode: string): Promise<void> {
    function condition(): boolean {
        return oni.editors.activeEditor.mode === mode
    }
    await oni.automation.waitFor(condition)
}

async function insertText(oni: Oni.Plugin.Api, text: string): Promise<void> {
    oni.automation.sendKeys("i")
    await awaitEditorMode(oni, "insert")
    oni.automation.sendKeys(`${text}<ESC>`)
    await awaitEditorMode(oni, "normal")
}
