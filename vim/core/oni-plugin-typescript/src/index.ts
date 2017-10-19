/**
 * index.ts
 *
 * Entry point for ONI's TypeScript Language Service integraiton
 */

/// <reference path="./../../../../definitions/Oni.d.ts" />
/// <reference path="./../../../../node_modules/typescript/lib/protocol.d.ts" />

import * as os from "os"
import * as path from "path"

import { CompletionItemKind, Diagnostic, Position, Range, SymbolKind } from "vscode-languageserver-types"

import { QuickInfo } from "./QuickInfo"
import { TypeScriptServerHost } from "./TypeScriptServerHost"

export interface IDisplayPart {
    text: string
    kind: string
}

export const activate = (Oni) => {

    const host = new TypeScriptServerHost(Oni)
    const quickInfo = new QuickInfo(Oni, host)

    const lastOpenFile = null

    let lastBuffer: string[] = []

    const getQuickInfo = (textDocumentPosition: Oni.EventContext) => {
        return host.getQuickInfo(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column)
            .then((val: any) => {
                return {
                    title: val.displayString,
                    description: val.documentation,
                }
            })
    }

    const findAllReferences = (textDocumentPosition: Oni.EventContext) => {
        return host.findAllReferences(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column)
            .then((val: protocol.ReferencesResponseBody) => {

                const mapResponseToItem = (referenceItem: protocol.ReferencesResponseItem) => ({
                    fullPath: referenceItem.file,
                    line: referenceItem.start.line,
                    column: referenceItem.start.offset,
                    lineText: referenceItem.lineText,
                })

                const output: Oni.Plugin.ReferencesResult = {
                    tokenName: val.symbolName,
                    items: val.refs.map((item) => mapResponseToItem(item)),
                }

                return output
            })
    }

    const getDefinition = (textDocumentPosition: Oni.EventContext) => {
        return host.getTypeDefinition(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column)
            .then((val: any) => {
                val = val[0]
                return {
                    filePath: val.file,
                    line: val.start.line,
                    column: val.start.offset,
                }
            })
    }

    const getFormattingEdits = (position: Oni.EventContext) => {
        return host.getFormattingEdits(position.bufferFullPath, 1, 1, lastBuffer.length, 0)
            .then((val) => {
                const edits = val.map((v) => {
                    const start = {
                        line: v.start.line,
                        column: v.start.offset,
                    }

                    const end = {
                        line: v.end.line,
                        column: v.end.offset,
                    }

                    return {
                        start,
                        end,
                        newValue: v.newText,
                    }

                })

                return {
                    filePath: position.bufferFullPath,
                    version: position.version,
                    edits,
                }
            })
    }

    const convertTypeScriptKindToCompletionItemKind = (kind: string): CompletionItemKind => {

        const typeScriptKindToCompletionKind = {
            "let": CompletionItemKind.Variable,
            "interface": CompletionItemKind.Interface,
            "alias": CompletionItemKind.Reference,
            "color": CompletionItemKind.Color,
            "const": CompletionItemKind.Value,
            "constructor": CompletionItemKind.Constructor,
            "class": CompletionItemKind.Class,
            "type": CompletionItemKind.Class,
            "directory": CompletionItemKind.File,
            "file": CompletionItemKind.File,
            "script": CompletionItemKind.File,
            "var": CompletionItemKind.Variable,
            "property": CompletionItemKind.Property,
            "parameter": CompletionItemKind.Variable,
            "module": CompletionItemKind.Module,
            "external module name": CompletionItemKind.Module,
            "method": CompletionItemKind.Method,
            "function": CompletionItemKind.Function,
            "unit": CompletionItemKind.Unit,
            "keyword": CompletionItemKind.Keyword,
            "text": CompletionItemKind.Text,
        }

        if (kind && typeScriptKindToCompletionKind[kind]) {
            return typeScriptKindToCompletionKind[kind]
        } else {
            return null
        }
    }

    const getCompletionDetails = (textDocumentPosition: Oni.EventContext, completionItem) => {

        if (!textDocumentPosition || !textDocumentPosition.bufferFullPath) {
            return Promise.resolve(null)
        }

        return host.getCompletionDetails(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column, [completionItem.label])
            .then((details) => {
                const entry = details[0]

                if (!entry) {
                    return null
                }

                return {
                    kind: convertTypeScriptKindToCompletionItemKind(entry.kind),
                    label: entry.name,
                    documentation: entry.documentation && entry.documentation.length ? entry.documentation[0].text : null,
                    detail: convertToDisplayString(entry.displayParts),
                }
            })
    }

    const getCompletions = (textDocumentPosition: Oni.EventContext) => {
        if (textDocumentPosition.column <= 1) {
            return Promise.resolve({
                completions: [],
            })
        }

        const currentLine = lastBuffer[textDocumentPosition.line - 1]
        let col = textDocumentPosition.column - 2
        let currentPrefix = ""

        while (col >= 0) {
            const currentCharacter = currentLine[col]

            if (!currentCharacter.match(/[_a-z]/i)) {
                break
            }

            currentPrefix = currentCharacter + currentPrefix
            col--
        }

        const basePos = col

        if (currentPrefix.length === 0 && currentLine[basePos] !== ".") {
            return Promise.resolve({
                base: currentPrefix,
                completions: [],
            })
        }

        Oni.log.verbose("Get completions: current line " + currentLine)

        return host.getCompletions(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column, currentPrefix)
            .then((val: any[]) => {

                const results = val
                    .filter((v) => v.name.indexOf(currentPrefix) === 0 || currentPrefix.length === 0)
                    .map((v) => ({
                        label: v.name,
                        kind: convertTypeScriptKindToCompletionItemKind(v.kind),
                    }))

                return {
                    base: currentPrefix,
                    completions: results,
                }
            })
    }

    const getSignatureHelp = (textDocumentPosition: Oni.EventContext) => {
        return host.getSignatureHelp(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column)
            .then((result) => {
                const items = result.items || []

                const signatureHelpItems = items.map((item) => ({
                    variableArguments: item.isVariadic,
                    prefix: convertToDisplayString(item.prefixDisplayParts),
                    suffix: convertToDisplayString(item.suffixDisplayParts),
                    separator: convertToDisplayString(item.separatorDisplayParts),
                    parameters: item.parameters.map((p) => ({
                        text: convertToDisplayString(p.displayParts),
                        documentation: convertToDisplayString(p.documentation),
                    })),
                }))

                return {
                    items: signatureHelpItems,
                    selectedItemIndex: result.selectedItemIndex,
                    argumentCount: result.argumentCount,
                    argumentIndex: result.argumentIndex,
                }
            })
    }

    Oni.registerLanguageService({
        findAllReferences,
        getCompletionDetails,
        getCompletions,
        getDefinition,
        getFormattingEdits,
        getQuickInfo,
        getSignatureHelp,
    })

    host.on("semanticDiag", (diagnostics) => {
        const fileName = diagnostics.file

        const diags = diagnostics.diagnostics || []

        const errors = diags.map((d) => {
            // Convert lines to zero-based to accomodate protocol
            const startPosition = Position.create(d.start.line - 1, d.start.offset - 1)
            const endPosition = Position.create(d.end.line - 1, d.end.offset - 1)
            const range = Range.create(startPosition, endPosition)

            return {
                type: null,
                message: d.text,
                range,
                severity: 1,
            }
        })

        Oni.diagnostics.setErrors("typescript-compiler", fileName, errors)
    })

    const updateFile = Oni.helpers.throttle((bufferFullPath, stringContents) => {
        host.updateFile(bufferFullPath, stringContents)
    }, 50)

    Oni.on("buffer-update", (args: Oni.BufferUpdateContext) => {

        if (!args.eventContext.bufferFullPath) {
            return
        }

        if (lastOpenFile !== args.eventContext.bufferFullPath) {
            host.openFile(args.eventContext.bufferFullPath)
        }

        lastBuffer = args.bufferLines

        updateFile(args.eventContext.bufferFullPath, args.bufferLines.join(os.EOL))

    })

    Oni.on("buffer-update-incremental", (args: Oni.IncrementalBufferUpdateContext) => {
        if (!args.eventContext.bufferFullPath) {
            return
        }

        const changedLine = args.bufferLine
        const lineNumber = args.lineNumber

        lastBuffer[lineNumber - 1] = changedLine

        host.changeLineInFile(args.eventContext.bufferFullPath, lineNumber, changedLine)
    })

    const getHighlightsFromNavTree = (navTree: protocol.NavigationTree[], highlights: any[]) => {
        if (!navTree) {
            return
        }

        navTree.forEach((item) => {
            const spans = item.spans
            const highlightKind = kindToHighlightGroup[item.kind]

            // if(!highlightKind)
            //     debugger

            spans.forEach((s) => {
                highlights.push({
                    highlightKind,
                    token: item.text,
                })
            })

            if (item.childItems) {
                getHighlightsFromNavTree(item.childItems, highlights)
            }
        })
    }

    Oni.on("buffer-enter", (args: Oni.EventContext) => {
        // // TODO: Look at alternate implementation for this
        host.openFile(args.bufferFullPath)

        host.getNavigationTree(args.bufferFullPath)
            .then((navTree) => {
                const highlights = []
                // debugger
                getHighlightsFromNavTree(navTree.childItems, highlights)

                Oni.setHighlights(args.bufferFullPath, "typescript", highlights)
            })
    })

    Oni.on("buffer-saved", (args: Oni.EventContext) => {
        host.getErrorsAcrossProject(args.bufferFullPath)

        host.getNavigationTree(args.bufferFullPath)
            .then((navTree) => {
                const highlights = []
                // debugger
                getHighlightsFromNavTree(navTree.childItems, highlights)

                Oni.setHighlights(args.bufferFullPath, "typescript", highlights)
            })
    })

    const kindToHighlightGroup = {
        let: SymbolKind.Variable,
        const: SymbolKind.Constant,
        var: SymbolKind.Variable,
        alias: SymbolKind.Package,
        function: SymbolKind.Method,
        method: SymbolKind.Function,
        property: SymbolKind.Property,
        class: SymbolKind.Class,
        interface: SymbolKind.Interface,
    }

    // TODO: Refactor to separate file
    const convertToDisplayString = (displayParts: IDisplayPart[]) => {
        let ret = ""

        if (!displayParts || !displayParts.forEach) {
            return ret
        }

        displayParts.forEach((dp) => {
            ret += dp.text
        })

        return ret
    }
}
