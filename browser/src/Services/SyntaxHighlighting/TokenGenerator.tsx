import * as path from "path"
import * as types from "vscode-languageserver-types"
import { StackElement } from "vscode-textmate"

import { editorManager } from "../../Services/EditorManager"
import { GrammarLoader } from "../../Services/SyntaxHighlighting/GrammarLoader"

export interface IGrammarToken {
    scopes: any
    range: types.Range
}

export interface IHighlight {
    foreground: number
    background?: number
    bold?: boolean
    italic?: boolean
}

interface IGetTokens {
    line: string
    language: string
    extension?: string
}

export interface IGrammarPerLine {
    [line: number]: IGrammarTokens
}

export interface IGrammarTokens {
    tokens: IGrammarToken[]
    ruleStack: StackElement
    line: string
}

/**
 * This function takes a language, its extension, and a line/lines
 * and it returns an object with keys representing each line as a number
 * each key has a value of the line, the line's associated tokens and the rulestack
 * @returns {IGrammarPerLine}
 */
export const getTokens = (Grammar: GrammarLoader) => async ({
    language,
    extension,
    line,
}: IGetTokens): Promise<IGrammarPerLine> => {
    let lang = language
    let ext = extension

    if (!language || !extension) {
        const { activeBuffer: b } = editorManager.activeEditor
        lang = language || b.language
        ext = extension || path.extname(b.filePath)
    }

    const grammar = await Grammar.getGrammarForLanguage(lang, ext)

    let tokens = null
    let ruleStack = null

    if (grammar) {
        const lines = line.split(/\n/)
        const tokensPerLine: IGrammarPerLine = {}
        for (let index = 0; index < lines.length; index++) {
            const tokenizeResult = grammar.tokenizeLine(lines[index], ruleStack)
            tokens = tokenizeResult.tokens.map((t: any) => ({
                range: types.Range.create(index, t.startIndex, index, t.endIndex),
                scopes: t.scopes,
            }))
            ruleStack = tokenizeResult.ruleStack
            tokensPerLine[index] = { tokens, ruleStack, line: lines[index] }
        }
        return tokensPerLine
    }
    return { 0: { tokens: [], ruleStack: null, line: null } }
}

const grammarloader = new GrammarLoader()
export default getTokens(grammarloader)
