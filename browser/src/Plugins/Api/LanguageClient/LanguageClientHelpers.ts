/**
 * LanguageClientHelpers.ts
 */

import * as os from "os"

import * as flatMap from "lodash/flatMap"
import * as types from "vscode-languageserver-types"

import * as Utility from "./../../../Utility"

export namespace TextDocumentSyncKind {
    export const None = 0
    export const Full = 1
    export const Incremental = 2
}

export interface CompletionOptions {
    /**
     * The server provides support to resolve additional
     * information for a completion item.
     */
    resolveProvider?: boolean

    /**
     * The characters that trigger completion automatically.
     */
    triggerCharacters?: string[]
}

// ServerCapabilities
// Defined in the LSP protocol: https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md
export interface ServerCapabilities {
    completionProvider?: CompletionOptions
    textDocumentSync?: number
    documentSymbolProvider?: boolean
}

export const wrapPathInFileUri = (path: string) => getFilePrefix() + Utility.normalizePath(path)

export const unwrapFileUriPath = (uri: string) => decodeURIComponent((uri).split(getFilePrefix())[1])

export const getTextFromContents = (contents: types.MarkedString | types.MarkedString[]): string[] => {
    if (contents instanceof Array) {
        return flatMap(contents, (markedString) => getTextFromMarkedString(markedString))
    } else {
        return getTextFromMarkedString(contents)
    }
}

export const bufferUpdateToTextDocumentItem = (args: Oni.BufferUpdateContext): types.TextDocumentItem => {
    const lines = args.bufferLines
    const { bufferFullPath, filetype, version } = args.eventContext
    const text = lines.join(os.EOL)

    return {
        uri: wrapPathInFileUri(bufferFullPath),
        languageId: filetype,
        version,
        text,
    }
}

export const eventContextToTextDocumentIdentifierParams = (args: Oni.BufferUpdateContext) => ({
    textDocument: {
        uri: wrapPathInFileUri(args.eventContext.bufferFullPath),
    },
})

export const pathToTextDocumentIdentifierParms = (path: string) => ({
    textDocument: {
        uri: wrapPathInFileUri(path),
    },
})

export const eventContextToCodeActionParams = (filePath: string, range: types.Range) => {
    const emptyDiagnostics: types.Diagnostic[] = []
    return {
        textDocument: {
            uri: wrapPathInFileUri(filePath),
        },
        range,
        context: { diagnostics: emptyDiagnostics },
    }
}

export const eventContextToTextDocumentPositionParams = (args: Oni.EventContext) => ({
    textDocument: {
        uri: wrapPathInFileUri(args.bufferFullPath),
    },
    position: {
        line: args.line - 1,
        character: args.column - 1,
    },
})

export const bufferToTextDocumentPositionParams = (buffer: Oni.Buffer) => ({
    textDocument: {
        uri: wrapPathInFileUri(buffer.filePath),
    },
    position: {
        line: buffer.cursor.line,
        character: buffer.cursor.column,
    },
})

export const createDidChangeTextDocumentParams = (bufferFullPath: string, lines: string[], version: number) => {
    const text = lines.join(os.EOL)

    return {
        textDocument: {
            uri: wrapPathInFileUri(bufferFullPath),
            version,
        },
        contentChanges: [{
            text,
        }],
    }
}

export const incrementalBufferUpdateToDidChangeTextDocumentParams = (args: Oni.IncrementalBufferUpdateContext, previousLine: string) => {
    const changedLine = args.bufferLine
    const lineNumber = args.lineNumber
    const previousLineLength = previousLine.length

    return {
        textDocument: {
            uri: wrapPathInFileUri(args.eventContext.bufferFullPath),
            version: args.eventContext.version,
        },
        contentChanges: [{
            range: types.Range.create(lineNumber - 1, 0, lineNumber - 1, previousLineLength),
            text: changedLine,
        }],
    }
}

const getTextFromMarkedString = (markedString: types.MarkedString): string[] => {
    if (typeof markedString === "string") {
        return splitByNewlines(markedString)
    } else {
        // TODO: Properly apply syntax highlighting based on the `language` parameter
        return splitByNewlines(markedString.value)
    }
}

const splitByNewlines = (str: string) => {
    // Remove '/r'
    return str.split("\r")
        .join("")
        .split("\n")
}

const getFilePrefix = () => {
    if (process.platform === "win32") {
        return "file:///"
    } else {
        return "file://"
    }
 }
