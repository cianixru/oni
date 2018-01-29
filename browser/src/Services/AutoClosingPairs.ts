/**
 * AutoClosingPairs
 *
 * Service to enable auto-closing pair key bindings
 */

import * as Oni from "oni-api"

import { Configuration } from "./Configuration"
import { EditorManager } from "./EditorManager"
import { InputManager } from "./InputManager"
import { LanguageManager } from "./Language"

import { NeovimInstance } from "./../neovim"

import * as Log from "./../Log"

export interface IAutoClosingPair {
    open: string
    close: string
    // TODO: Support `notIn` equivalent
}

export const activate = (
    configuration: Configuration,
    editorManager: EditorManager,
    inputManager: InputManager,
    languageManager: LanguageManager,
) => {
    const insertModeFilter = () => editorManager.activeEditor.mode === "insert"

    let subscriptions: Oni.DisposeFunction[] = []

    const handleOpenCharacter = (pair: IAutoClosingPair, editor: Oni.Editor) => () => {
        const neovim: NeovimInstance = editor.neovim as any
        neovim.blockInput(async (inputFunc: any) => {
            // TODO: PERFORMANCE: Look at how to collapse this instead of needed multiple asynchronous calls.
            await inputFunc(pair.open + pair.close)

            const pos = await neovim.callFunction("getpos", ["."])
            const [, oneBasedLine, oneBasedColumn] = pos
            await editor.activeBuffer.setCursorPosition(oneBasedLine - 1, oneBasedColumn - 2)
        })

        return true
    }

    const handleBackspaceCharacter = (pairs: IAutoClosingPair[], editor: Oni.Editor) => () => {
        const neovim: NeovimInstance = editor.neovim as any
        neovim.blockInput(async (inputFunc: any) => {
            const activeBuffer = editor.activeBuffer
            const lines = await activeBuffer.getLines(
                activeBuffer.cursor.line,
                activeBuffer.cursor.line + 1,
            )
            const line = lines[0]

            const { column } = activeBuffer.cursor

            const matchingPair = pairs.find(p => {
                return column >= 1 && line[column] === p.close && line[column - 1] === p.open
            })

            if (matchingPair) {
                // Remove the pairs
                const beforePair = line.substring(0, column - 1)
                const afterPair = line.substring(column + 1, line.length)

                const pos = await neovim.callFunction("getpos", ["."])
                const [, oneBasedLine, oneBasedColumn] = pos
                await editor.activeBuffer.setCursorPosition(oneBasedLine - 1, oneBasedColumn - 2)

                await activeBuffer.setLines(
                    activeBuffer.cursor.line,
                    activeBuffer.cursor.line + 1,
                    [beforePair + afterPair],
                )
            } else {
                await inputFunc("<bs>")
            }
        })

        return true
    }

    const handleEnterCharacter = (pairs: IAutoClosingPair[], editor: Oni.Editor) => () => {
        const neovim: NeovimInstance = editor.neovim as any
        neovim.blockInput(async (inputFunc: any) => {
            const activeBuffer = editor.activeBuffer

            const lines = await (activeBuffer as any).getLines(
                activeBuffer.cursor.line,
                activeBuffer.cursor.line + 1,
                false,
            )
            const line = lines[0]

            const { column } = activeBuffer.cursor

            const matchingPair = pairs.find(p => {
                return column >= 1 && line[column] === p.close && line[column - 1] === p.open
            })

            if (matchingPair) {
                const whiteSpacePrefix = getWhiteSpacePrefix(line)
                const beforePair = line.substring(0, column)
                const afterPair = line.substring(column, line.length)

                const pos = await neovim.callFunction("getpos", ["."])
                const [, oneBasedLine] = pos
                await activeBuffer.setLines(
                    activeBuffer.cursor.line,
                    activeBuffer.cursor.line + 1,
                    [beforePair, whiteSpacePrefix, whiteSpacePrefix + afterPair],
                )
                await activeBuffer.setCursorPosition(oneBasedLine, whiteSpacePrefix.length)
                await inputFunc("<tab>")
            } else {
                await inputFunc("<enter>")
            }
        })

        return true
    }

    const handleCloseCharacter = (pair: IAutoClosingPair, editor: Oni.Editor) => () => {
        const neovim: any = editor.neovim
        neovim.blockInput(async (inputFunc: any) => {
            const activeBuffer = editor.activeBuffer
            const lines = await (activeBuffer as any).getLines(
                activeBuffer.cursor.line,
                activeBuffer.cursor.line + 1,
                false,
            )
            const line = lines[0]
            if (line[activeBuffer.cursor.column] === pair.close) {
                await activeBuffer.setCursorPosition(
                    activeBuffer.cursor.line,
                    activeBuffer.cursor.column + 1,
                )
            } else {
                await inputFunc(pair.close)
            }
        })

        return true
    }

    const onBufferEnter = (newBuffer: Oni.Buffer) => {
        if (!configuration.getValue("autoClosingPairs.enabled")) {
            Log.verbose("[Auto Closing Pairs] Not enabled.")
            return
        }

        if (subscriptions && subscriptions.length) {
            subscriptions.forEach(df => df())
        }

        subscriptions = []

        const autoClosingPairs = getAutoClosingPairs(configuration, newBuffer.language)

        autoClosingPairs.forEach(pair => {
            subscriptions.push(
                inputManager.bind(
                    pair.open,
                    handleOpenCharacter(pair, editorManager.activeEditor),
                    insertModeFilter,
                ),
            )
            subscriptions.push(
                inputManager.bind(
                    pair.close,
                    handleCloseCharacter(pair, editorManager.activeEditor),
                    insertModeFilter,
                ),
            )
        })

        subscriptions.push(
            inputManager.bind(
                "<bs>",
                handleBackspaceCharacter(autoClosingPairs, editorManager.activeEditor),
                insertModeFilter,
            ),
        )
        subscriptions.push(
            inputManager.bind(
                "<enter>",
                handleEnterCharacter(autoClosingPairs, editorManager.activeEditor),
                insertModeFilter,
            ),
        )
    }

    editorManager.activeEditor.onBufferEnter.subscribe(onBufferEnter)

    const activeEditor = editorManager.activeEditor
    if (activeEditor && activeEditor.activeBuffer) {
        onBufferEnter(activeEditor.activeBuffer)
    }
}

const nonWhiteSpaceRegEx = /\S/

export const getWhiteSpacePrefix = (str: string): string => {
    const firstIndex = str.search(nonWhiteSpaceRegEx)

    if (firstIndex === -1) {
        return ""
    } else {
        return str.substring(0, firstIndex)
    }
}

const getAutoClosingPairs = (
    configuration: Configuration,
    language: string,
): IAutoClosingPair[] => {
    const languagePairs = configuration.getValue(`language.${language}.autoClosingPairs`)

    if (languagePairs) {
        return languagePairs
    } else {
        return configuration.getValue("autoClosingPairs.default") || []
    }
}
