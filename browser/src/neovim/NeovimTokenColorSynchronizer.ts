/**
 * NeovimTokenColorSynchronizer
 *
 * This is a helper that pushes all the token colors to Neovim
 * as custom highlight groups.
 */

import * as Color from "color"
import { TokenColor } from "./../Services/TokenColors"

import { NeovimInstance } from "./NeovimInstance"

import * as Log from "./../Log"

const getGuiStringFromTokenColor = (color: TokenColor): string => {
    if (color.settings.bold && color.settings.italic) {
        return "gui=bold,italic"
    } else if (color.settings.bold) {
        return "gui=bold"
    } else if (color.settings.italic) {
        return "gui=italic"
    } else {
        return "gui=none"
    }
}

export class NeovimTokenColorSynchronizer {
    private _currentIndex: number = 0
    private _tokenScopeSelectorToHighlightName: { [key: string]: string } = {}
    private _highlightNameToHighlightValue: { [key: string]: string } = {}

    constructor(private _neovimInstance: NeovimInstance) {}

    // This method creates highlight groups for any token colors that haven't been set yet
    public async synchronizeTokenColors(tokenColors: TokenColor[]): Promise<void> {
        const highlightsToAdd = tokenColors.map(tokenColor => {
            const highlightName = this._getOrCreateHighlightGroup(tokenColor)
            const highlightFromScope = this._convertTokenStyleToHighlightInfo(tokenColor)

            const currentHighlight = this._highlightNameToHighlightValue[highlightName]

            if (currentHighlight === highlightFromScope) {
                return null
            } else {
                this._highlightNameToHighlightValue[highlightName] = highlightFromScope
                return highlightFromScope
            }
        })

        const filteredHighlights = highlightsToAdd.filter(hl => !!hl)

        const atomicCalls = filteredHighlights.map(hlCommand => {
            return ["nvim_command", [hlCommand]]
        })

        if (atomicCalls.length === 0) {
            return
        }

        Log.info(
            "[NeovimTokenColorSynchronizer::synchronizeTokenColors] Setting " +
                atomicCalls.length +
                " highlights",
        )
        await this._neovimInstance.request("nvim_call_atomic", [atomicCalls])
        Log.info(
            "[NeovimTokenColorSynchronizer::synchronizeTokenColors] Highlights set successfully",
        )
    }

    /**
     * Gets the highlight group for the particular token color. Requires that `synchronizeTokenColors` has been called
     * previously.
     */
    public getHighlightGroupForTokenColor(tokenColor: TokenColor): string {
        return this._getOrCreateHighlightGroup(tokenColor)
    }

    private _convertTokenStyleToHighlightInfo(tokenColor: TokenColor): string {
        const name = this._getOrCreateHighlightGroup(tokenColor)
        const foregroundColor = Color(tokenColor.settings.foregroundColor).hex()
        const backgroundColor = Color(tokenColor.settings.backgroundColor).hex()
        const gui = getGuiStringFromTokenColor(tokenColor)
        return `:hi ${name} guifg=${foregroundColor} guibg=${backgroundColor} ${gui}`
    }

    private _getOrCreateHighlightGroup(tokenColor: TokenColor): string {
        const existingGroup = this._tokenScopeSelectorToHighlightName[tokenColor.scope]
        if (existingGroup) {
            return existingGroup
        } else {
            this._currentIndex++
            const newHighlightGroupName = "oni_highlight_" + this._currentIndex.toString()
            Log.verbose(
                "[NeovimTokenColorSynchronizer::_getOrCreateHighlightGroup] Creating new highlight group - " +
                    newHighlightGroupName,
            )
            this._tokenScopeSelectorToHighlightName[tokenColor.scope] = newHighlightGroupName
            return newHighlightGroupName
        }
    }
}
