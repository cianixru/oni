declare namespace Oni {

    export interface Position {
        line: number
        column: number
    }

    export interface Range {
        start: Position
        end: Position
    }

    export interface TextEdit {
        range: Range
        newValue: string
    }

    export interface EventContext {
        bufferFullPath: string
        bufferVersion: number
        line: number


        /**
         * Column within the buffer
         */
        column: number
        byte: number
        filetype: string

        /**
         * Actual column position within the window
         * Includes line number, gutter, etc
         */
        wincol: number
        winline: number
    }

    // export interface TextDocumentPosition {
    //     // TODO: Reconcile these - remove buffer
    //     bufferFullPath?: string
    //     filePath?: string
    //     line: number
    //     column: number
    //     byte?: number
    // }

    export namespace Menu {
        export interface MenuOption {
            /**
             * Optional font-awesome icon
             */
            icon?: string

            label: string
            detail: string

            /**
             * A pinned option is always shown first in the menu,
             * before unpinned items
             */
            pinned?: boolean
        }
    }


    export namespace Plugin {
        export namespace Diagnostics {
            export interface Error {
                type: string
                text: string

                lineNumber: number
                startColumn?: number
                endColumn?: number
            }

            export interface Api {
                setErrors(key: string, fileName: string, errors: Error[], color?: string)
                clearErrors(key: string)
            }
        }

        export interface QuickInfo {
            title: string
            description: string
        }

        export interface GotoDefinitionResponse extends Position {
            filePath: string
        }

        export interface FormattingEditsResponse {
            filePath: string
            version: number
            edits: TextEdit[]
        }

        export interface Api {
            // handleNotification(method: string, args: any[]): void

            diagnostics: Diagnostics.Api;

            registerLanguageService(languageType: string, languageService: LanguageService)
        }

        export interface CompletionResult {

            /**
             * Base entry being completed against
             */
            base: string;

            completions: CompletionInfo[];
        }

        //export type CompletionKind = "method" | "function" | "var"

        export interface CompletionInfo {
            kind?: string
            label: string
            detail?: string
            documentation?: string
        }

        export interface LanguageService {
            getCompletions?(position: EventContext): Promise<CompletionResult>
            getCompletionDetails?(position: EventContext, completionInfo: CompletionInfo): Promise<CompletionInfo>

            getQuickInfo?(position: EventContext): Promise<QuickInfo>
            getDefinition?(position: EventContext): Promise<GotoDefinitionResponse>

            getFormattingEdits?(position: EventContext): Promise<FormattingEditsResponse>
        }
    }

}

