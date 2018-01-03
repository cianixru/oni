/**
 * SyntaxHighlighting.ts
 *
 * Handles enhanced syntax highlighting
 */

import { Store } from "redux"
import * as types from "vscode-languageserver-types"
import { StackElement } from "vscode-textmate"

import * as Log from "./../../Log"
import * as PeriodicJobs from "./../../PeriodicJobs"
import { createStore } from "./../../Redux"
import { configuration } from "./../Configuration"

import { GrammarLoader } from "./GrammarLoader"
import { SyntaxHighlightingPeriodicJob } from "./SyntaxHighlightingPeriodicJob"
import { reducer } from "./SyntaxHighlightingReducer"
import * as Selectors from "./SyntaxHighlightSelectors"

const syntaxHighlightingJobs = new PeriodicJobs.PeriodicJobManager()

export interface ISyntaxHighlightTokenInfo {
    scopes: string[]
    range: types.Range
}

export interface ISyntaxHighlightLineInfo {
    line: string
    ruleStack: StackElement
    tokens: ISyntaxHighlightTokenInfo[]
    dirty: boolean,
}

export interface SyntaxHighlightLines {[key: number]: ISyntaxHighlightLineInfo}

export interface IBufferSyntaxHighlightState {
    bufferId: string
    language: string
    extension: string

    // This doesn't work quite right if we have a buffer open in a separate window...
    topVisibleLine: number
    bottomVisibleLine: number

    // When in insert mode, we'll just syntax highlight that line
    // Upon leaving insert mode, we'll refresh the whole view
    activeInsertModeLine: number

    lines: SyntaxHighlightLines
}

export interface ISyntaxHighlightState {
    isInsertMode: boolean
    bufferToHighlights: {
        [bufferId: string]: IBufferSyntaxHighlightState,
    }
}

export const DefaultSyntaxHighlightState: ISyntaxHighlightState = {
    isInsertMode: false,
    bufferToHighlights: {},
}

export type ISyntaxHighlightAction = {
    type: "SYNTAX_UPDATE_BUFFER",
    language: string,
    extension: string,
    bufferId: string,
    lines: string[],
} | {
        type: "SYNTAX_UPDATE_BUFFER_LINE",
        bufferId: string,
        lineNumber: number,
        line: string,
    } | {
        type: "SYNTAX_UPDATE_TOKENS_FOR_LINE",
        bufferId: string,
        lineNumber: number,
        tokens: ISyntaxHighlightTokenInfo[],
        ruleStack: StackElement,
    } | {
        type: "SYNTAX_UPDATE_BUFFER_VIEWPORT",
        bufferId: string,
        topVisibleLine: number,
        bottomVisibleLine: number,
    } | {
        type: "START_INSERT_MODE",
        bufferId: string,
    } | {
        type: "END_INSERT_MODE",
        bufferId: string,
    }

const grammarLoader = new GrammarLoader()

const updateTokenMiddleware = (store: any) => (next: any) => (action: any) => {
    const result: ISyntaxHighlightAction = next(action)

    if (action.type === "SYNTAX_UPDATE_BUFFER"
        || action.type === "SYNTAX_UPDATE_BUFFER_LINE"
        || action.type === "SYNTAX_UPDATE_BUFFER_VIEWPORT") {

            const state = store.getState()
            const bufferId = action.bufferId

            const language = state.bufferToHighlights[bufferId].language
            const extension = state.bufferToHighlights[bufferId].extension

            if (!language || !extension) {
                return result
            }

            grammarLoader.getGrammarForLanguage(language, extension)
            .then((grammar) => {

                if (!grammar) {
                    return
                }

                const buffer = state.bufferToHighlights[bufferId]

                if (Object.keys(buffer.lines).length >= configuration.getValue("experimental.editor.textMateHighlighting.maxLines")) {
                    Log.info("[SyntaxHighlighting - fullBufferUpdateEpic]: Not applying syntax highlighting as the maxLines limit was exceeded")
                    return
                }

                const relevantRange = Selectors.getRelevantRange(state, bufferId)

                syntaxHighlightingJobs.startJob(new SyntaxHighlightingPeriodicJob(
                    store as any,
                    action.bufferId,
                    grammar,
                    relevantRange.top,
                    relevantRange.bottom,
                ))
            })
    }

    return result
}

export const createSyntaxHighlightStore = (): Store<ISyntaxHighlightState> => {
    const syntaxHighlightStore: Store<ISyntaxHighlightState> = createStore(
        "SyntaxHighlighting",
        reducer,
        DefaultSyntaxHighlightState,
        [updateTokenMiddleware],
    )

    return syntaxHighlightStore
}
