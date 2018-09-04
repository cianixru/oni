/**
 * Common functions used across the CI tests.
 */

import * as Oni from "oni-api"

import * as fs from "fs"
import * as os from "os"
import * as path from "path"

export const getCompletionElement = () => {
    return getSingleElementBySelector("[data-id='autocompletion']")
}

interface IGetTab {
    dirty: boolean
}

export const getSelectedTabElement = ({ dirty = false }: IGetTab) => {
    const isDirty = dirty ? "is-dirty" : "not-dirty"
    return getSingleElementBySelector(`[data-status='tab-selected-${isDirty}']`)
}

export const getAllTabs = () => {
    return getElementsBySelector(`[data-id='tab']`)
}

export const getTabCloseButtonByIndex = (index: number) => {
    const tabs = getAllTabs()
    const tab = tabs[index]
    return tab ? tab.querySelector("[data-id='tab-close-button']") : null
}

export const getTabsContainer = () => {
    return getSingleElementBySelector(`[data-id='tabs']`)
}

export const getCollateralPath = () => {
    return path.join(__dirname, "..", "..", "..", "test", "collateral")
}

export const getElementByClassName = (className: string): HTMLElement => {
    const elements = document.body.getElementsByClassName(className)

    if (!elements || !elements.length) {
        return null
    } else {
        return elements[0] as HTMLElement
    }
}

export const getElementsBySelector = (selector: string) => {
    const elements = document.body.querySelectorAll(selector)
    return elements || []
}

export const getSingleElementBySelector = (selector: string) =>
    document.body.querySelector(selector)

export const createNewFile = async (
    fileExtension: string,
    oni: Oni.Plugin.Api,
    contents?: string,
): Promise<void> => {
    const tempFilePath = getTemporaryFilePath(fileExtension)

    if (contents) {
        fs.writeFileSync(tempFilePath, contents)
    }

    await navigateToFile(tempFilePath, oni)
}

export const getTemporaryFilePath = (fileExtension: string): string => {
    const dir = os.tmpdir()
    const testFileName = `testFile-${new Date().getTime()}.${fileExtension}`
    return path.join(dir, testFileName)
}

export const getTemporaryFolder = (): string => {
    const dir = os.tmpdir()
    const testFolderName = `oni-test-folder-${new Date().getTime()}`
    const testFolderPath = path.join(dir, testFolderName)
    return testFolderPath
}

export const navigateToFile = async (filePath: string, oni: Oni.Plugin.Api): Promise<void> => {
    oni.automation.sendKeys(":e " + filePath)
    oni.automation.sendKeys("<cr>")

    await oni.automation.waitFor(
        () => oni.editors.activeEditor.activeBuffer.filePath === filePath,
        10000,
    )
}

export const waitForCommand = async (command: string, oni: Oni.Plugin.Api): Promise<void> => {
    return oni.automation.waitFor(() => {
        const anyCommands = oni.commands as any
        return anyCommands.hasCommand(command)
    }, 10000)
}

export async function awaitEditorMode(oni: Oni.Plugin.Api, mode: string): Promise<void> {
    function condition(): boolean {
        return oni.editors.activeEditor.mode === mode
    }
    await oni.automation.waitFor(condition)
}

export async function insertText(oni: Oni.Plugin.Api, text: string): Promise<void> {
    oni.automation.sendKeys("i")
    await awaitEditorMode(oni, "insert")
    oni.automation.sendKeys(`${text}<ESC>`)
    await awaitEditorMode(oni, "normal")
}

/**
 * Create temporary workspace with a file `src/File.ts` and return workspace directory
 */
export async function useTempWorkspace(oni: Oni.Plugin.Api) {
    // Create our "workspace"
    const rootPath = getTemporaryFolder()
    fs.mkdirSync(rootPath)
    // Create workspace subdir.
    const directoryPath = path.join(rootPath, "src")
    fs.mkdirSync(directoryPath)
    // Create workspace file.
    const filePath = path.join(directoryPath, "File.ts")
    fs.writeFileSync(filePath, "")
    // Switch to workspace.
    await oni.workspace.changeDirectory(rootPath)
    return rootPath
}
