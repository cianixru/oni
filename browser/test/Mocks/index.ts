/**
 * Mocks/index.ts
 *
 * Implementations of test mocks and doubles,
 * to exercise boundaries of class implementations
 */

export * from "./MockThemeLoader"

import * as Oni from "oni-api"
import { Event, IEvent } from "oni-types"

import * as types from "vscode-languageserver-types"

import { IBufferHighlightsUpdater } from "./../../src/Editor/BufferHighlights"
import { Editor } from "./../../src/Editor/Editor"

import * as Language from "./../../src/Services/Language"
import { createCompletablePromise, ICompletablePromise } from "./../../src/Utility"

import { HighlightInfo } from "./../../src/Services/SyntaxHighlighting"
import { TokenColor } from "./../../src/Services/TokenColors"
import { IWorkspace } from "./../../src/Services/Workspace"

export class MockTokenColors {
    constructor(private _tokenColors: TokenColor[] = []) {}

    public get tokenColors(): TokenColor[] {
        return this._tokenColors
    }
}

export class MockConfiguration {
    private _currentConfigurationFiles: string[] = []
    private _onConfigurationChanged = new Event<any>()

    public get onConfigurationChanged(): IEvent<any> {
        return this._onConfigurationChanged
    }

    public get currentConfigurationFiles(): string[] {
        return this._currentConfigurationFiles
    }

    constructor(private _configurationValues: any = {}) {}

    public getValue(key: string): any {
        return this._configurationValues[key]
    }

    public setValue(key: string, value: any): void {
        this._configurationValues[key] = value
    }

    public addConfigurationFile(filePath: string): void {
        this._currentConfigurationFiles = [...this._currentConfigurationFiles, filePath]
    }

    public removeConfigurationFile(filePath: string): void {
        this._currentConfigurationFiles = this._currentConfigurationFiles.filter(
            fp => fp !== filePath,
        )
    }

    public simulateConfigurationChangedEvent(changedConfigurationValues: any): void {
        this._onConfigurationChanged.dispatch(changedConfigurationValues)
    }
}

export class MockWorkspace implements IWorkspace {
    private _activeWorkspace: string = null
    private _onDirectoryChangedEvent = new Event<string>()
    private _onFocusGainedEvent = new Event<void>()
    private _onFocusLostEvent = new Event<void>()

    public get onDirectoryChanged(): IEvent<string> {
        return this._onDirectoryChangedEvent
    }

    public get onFocusGained(): IEvent<void> {
        return this._onFocusGainedEvent
    }

    public get onFocusLost(): IEvent<void> {
        return this._onFocusLostEvent
    }

    public get activeWorkspace(): string {
        return this._activeWorkspace
    }

    public changeDirectory(newDirectory: string): void {
        // tslint:disable-line

        this._activeWorkspace = newDirectory
        this._onDirectoryChangedEvent.dispatch(newDirectory)
    }

    public async applyEdits(edits: types.WorkspaceEdit): Promise<void> {
        return null
    }
}

export class MockStatusBarItem implements Oni.StatusBarItem {
    public show(): void {
        // tslint:disable-line
    }

    public hide(): void {
        // tslint:disable-line
    }

    public setContents(element: JSX.Element): void {
        // tslint:disable-line
    }

    public dispose(): void {
        // tslint:disable-line
    }
}

export class MockStatusBar implements Oni.StatusBar {
    public getItem(globalId: string): Oni.StatusBarItem {
        return new MockStatusBarItem()
    }

    public createItem(alignment: number, globalId: string): Oni.StatusBarItem {
        return new MockStatusBarItem()
    }
}

export class MockEditor extends Editor {
    private _activeBuffer: MockBuffer = null
    private _currentSelection: types.Range = null

    public get activeBuffer(): Oni.Buffer {
        return this._activeBuffer as any
    }

    public simulateModeChange(newMode: string): void {
        this.setMode(newMode as any)
    }

    public simulateCursorMoved(line: number, column: number): void {
        this.notifyCursorMoved({
            line,
            column,
        })
    }

    public simulateBufferEnter(buffer: MockBuffer): void {
        this._activeBuffer = buffer
        this.notifyBufferEnter(buffer as any)
    }

    public async setSelection(range: types.Range): Promise<void> {
        this._currentSelection = range
    }

    public async getSelection(): Promise<types.Range> {
        return this._currentSelection
    }

    public setActiveBufferLine(line: number, lineContents: string): void {
        this._activeBuffer.setLineSync(line, lineContents)

        this.notifyBufferChanged({
            buffer: this._activeBuffer as any,
            contentChanges: [
                {
                    range: types.Range.create(line, 0, line + 1, 0),
                    text: lineContents,
                },
            ],
        })
    }
}

export class MockBuffer {
    private _mockHighlights = new MockBufferHighlightsUpdater()
    private _cursor = { line: 0, column: 0 }
    private _modified = false

    public get id(): number {
        return this._id
    }

    public get language(): string {
        return this._language
    }

    public get filePath(): string {
        return this._filePath
    }

    public get lineCount(): number {
        return this._lines.length
    }

    public get mockHighlights(): MockBufferHighlightsUpdater {
        return this._mockHighlights
    }

    public get cursor(): Oni.Cursor {
        return this._cursor
    }

    public get modified(): boolean {
        return this._modified
    }

    public constructor(
        private _language: string = "test_language",
        private _filePath: string = "test_filepath",
        private _lines: string[] = [],
        private _id: number = 1,
    ) {}

    public async getCursorPosition(): Promise<types.Position> {
        return types.Position.create(this._cursor.line, this._cursor.column)
    }

    public setCursorPosition(line: number, column: number) {
        this._cursor.column = column
        this._cursor.line = line
    }

    public setLinesSync(lines: string[]): void {
        this._lines = lines
        this._modified = true
    }

    public setLineSync(line: number, lineContents: string): void {
        while (this._lines.length <= line) {
            this._lines.push("")
        }

        this._lines[line] = lineContents
        this._modified = true
    }

    public async setLines(start: number, end: number, lines: string[]): Promise<void> {
        while (this._lines.length <= end) {
            this._lines.push("")
        }

        for (let i = 0; i < lines.length; i++) {
            this._lines[start + i] = lines[i]
        }

        this._modified = true
    }

    public getLines(start: number = 0, end?: number): Promise<string[]> {
        if (typeof end !== "number") {
            end = this._lines.length
        }

        return Promise.resolve(this._lines.slice(start, end))
    }

    public updateHighlights(
        tokenColors: any[],
        updateFunction: (highlightUpdater: IBufferHighlightsUpdater) => void,
    ) {
        updateFunction(this._mockHighlights)
    }

    public addLayer(): void {
        // tslint:disable-line
    }

    public removeLayer(): void {
        // tslint:disable-line
    }
}

export class MockBufferHighlightsUpdater implements IBufferHighlightsUpdater {
    private _linesToHighlights: { [line: number]: HighlightInfo[] } = {}

    public setHighlightsForLine(line: number, highlights: HighlightInfo[]): void {
        this._linesToHighlights[line] = highlights
    }

    public clearHighlightsForLine(line: number): void {
        this._linesToHighlights[line] = null
    }

    public getHighlightsForLine(line: number): HighlightInfo[] {
        return this._linesToHighlights[line] || []
    }
}

const DefaultCursorMatchRegEx = /[a-z]/i
const DefaultTriggerCharacters = ["."]

export class MockLanguageManager {
    public getTokenRegex(language: string): RegExp {
        return DefaultCursorMatchRegEx
    }

    public getCompletionTriggerCharacters(language: string): string[] {
        return DefaultTriggerCharacters
    }
}

export class MockRequestor<T> {
    private _completablePromises: Array<ICompletablePromise<T>> = []

    public get pendingCallCount(): number {
        return this._completablePromises.length
    }

    public get(...args: any[]): Promise<T> {
        const newPromise = createCompletablePromise<T>()

        this._completablePromises.push(newPromise)

        return newPromise.promise
    }

    public resolve(val: T): void {
        const firstPromise = this._completablePromises.shift()
        firstPromise.resolve(val)
    }
}

export class MockDefinitionRequestor extends MockRequestor<Language.IDefinitionResult>
    implements Language.IDefinitionRequestor {
    public getDefinition(
        language: string,
        filePath: string,
        line: number,
        column: number,
    ): Promise<Language.IDefinitionResult> {
        return this.get(language, filePath, line, column)
    }
}

export class MockHoverRequestor extends MockRequestor<Language.IHoverResult>
    implements Language.IHoverRequestor {
    public getHover(
        language: string,
        filePath: string,
        line: number,
        column: number,
    ): Promise<Language.IHoverResult> {
        return this.get(language, filePath, line, column)
    }
}
