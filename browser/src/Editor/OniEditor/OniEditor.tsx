/**
 * OniEditor.ts
 *
 * IEditor implementation for Oni
 *
 * Extends the capabilities of the NeovimEditor
 */

import * as React from "react"

import * as types from "vscode-languageserver-types"

import * as Oni from "oni-api"
import { IEvent } from "oni-types"

import * as Log from "./../../Log"

import { PluginManager } from "./../../Plugins/PluginManager"

import { IColors } from "./../../Services/Colors"
import { CompletionProviders } from "./../../Services/Completion"
import { Configuration } from "./../../Services/Configuration"
import { IDiagnosticsDataSource } from "./../../Services/Diagnostics"

import { editorManager } from "./../../Services/EditorManager"
import { LanguageManager } from "./../../Services/Language"

import { MenuManager } from "./../../Services/Menu"
import { OverlayManager } from "./../../Services/Overlay"

import { SnippetManager } from "./../../Services/Snippets"
import { ISyntaxHighlighter } from "./../../Services/SyntaxHighlighting"

import { Tasks } from "./../../Services/Tasks"
import { ThemeManager } from "./../../Services/Themes"
import { TokenColors } from "./../../Services/TokenColors"
import { Workspace } from "./../../Services/Workspace"

import { IEditor } from "./../Editor"

import { BufferScrollBarContainer } from "./containers/BufferScrollBarContainer"
import { DefinitionContainer } from "./containers/DefinitionContainer"
import { ErrorsContainer } from "./containers/ErrorsContainer"

import { NeovimEditor } from "./../NeovimEditor"

import { windowManager } from "./../../Services/WindowManager"

// Helper method to wrap a react component into a layer
const wrapReactComponentWithLayer = (id: string, component: JSX.Element): Oni.EditorLayer => {
    return {
        id,
        render: (context: Oni.EditorLayerRenderContext) => (context.isActive ? component : null),
    }
}

export class OniEditor implements IEditor {
    private _neovimEditor: NeovimEditor

    public get mode(): string {
        return this._neovimEditor.mode
    }

    public get onCursorMoved(): IEvent<Oni.Cursor> {
        return this._neovimEditor.onCursorMoved
    }

    public get onModeChanged(): IEvent<Oni.Vim.Mode> {
        return this._neovimEditor.onModeChanged
    }

    public get onBufferEnter(): IEvent<Oni.EditorBufferEventArgs> {
        return this._neovimEditor.onBufferEnter
    }

    public get onBufferLeave(): IEvent<Oni.EditorBufferEventArgs> {
        return this._neovimEditor.onBufferLeave
    }

    public get onBufferChanged(): IEvent<Oni.EditorBufferChangedEventArgs> {
        return this._neovimEditor.onBufferChanged
    }

    public get onBufferSaved(): IEvent<Oni.EditorBufferEventArgs> {
        return this._neovimEditor.onBufferSaved
    }

    public get onBufferScrolled(): IEvent<Oni.EditorBufferScrolledEventArgs> {
        return this._neovimEditor.onBufferScrolled
    }

    public get /* override */ activeBuffer(): Oni.Buffer {
        return this._neovimEditor.activeBuffer
    }

    // Capabilities
    public get neovim(): Oni.NeovimEditorCapability {
        return this._neovimEditor.neovim
    }

    public get syntaxHighlighter(): ISyntaxHighlighter {
        return this._neovimEditor.syntaxHighlighter
    }

    constructor(
        private _colors: IColors,
        private _completionProviders: CompletionProviders,
        private _configuration: Configuration,
        private _diagnostics: IDiagnosticsDataSource,
        private _languageManager: LanguageManager,
        private _menuManager: MenuManager,
        private _overlayManager: OverlayManager,
        private _pluginManager: PluginManager,
        private _snippetManager: SnippetManager,
        private _tasks: Tasks,
        private _themeManager: ThemeManager,
        private _tokenColors: TokenColors,
        private _workspace: Workspace,
    ) {
        this._neovimEditor = new NeovimEditor(
            this._colors,
            this._completionProviders,
            this._configuration,
            this._diagnostics,
            this._languageManager,
            this._menuManager,
            this._overlayManager,
            this._pluginManager,
            this._snippetManager,
            this._tasks,
            this._themeManager,
            this._tokenColors,
            this._workspace,
        )

        this._neovimEditor.bufferLayers.addBufferLayer("*", buf =>
            wrapReactComponentWithLayer("oni.layer.scrollbar", <BufferScrollBarContainer />),
        )
        this._neovimEditor.bufferLayers.addBufferLayer("*", buf =>
            wrapReactComponentWithLayer("oni.layer.definition", <DefinitionContainer />),
        )
        this._neovimEditor.bufferLayers.addBufferLayer("*", buf =>
            wrapReactComponentWithLayer("oni.layer.errors", <ErrorsContainer />),
        )
    }

    public dispose(): void {
        if (this._neovimEditor) {
            this._neovimEditor.dispose()
            this._neovimEditor = null
        }
    }

    public enter(): void {
        Log.info("[OniEditor::enter]")
        this._neovimEditor.enter()

        editorManager.setActiveEditor(this)
    }

    public leave(): void {
        Log.info("[OniEditor::leave]")
        this._neovimEditor.leave()
    }

    public async openFile(file: string, method = "edit"): Promise<Oni.Buffer> {
        if (this._configuration.getValue("editor.split.mode") === "oni") {
            if (method === "vertical" || method === "horizontal") {
                const newEditor = new OniEditor(
                    this._colors,
                    this._completionProviders,
                    this._configuration,
                    this._diagnostics,
                    this._languageManager,
                    this._menuManager,
                    this._overlayManager,
                    this._pluginManager,
                    this._snippetManager,
                    this._tasks,
                    this._themeManager,
                    this._tokenColors,
                    this._workspace,
                )

                windowManager.createSplit(method, newEditor)
                await newEditor.init([])
                return newEditor.openFile(file, "edit")
            }
        }

        return this._neovimEditor.openFile(file, method)
    }

    public async newFile(filePath: string): Promise<Oni.Buffer> {
        return this._neovimEditor.newFile(filePath)
    }

    public async clearSelection(): Promise<void> {
        return this._neovimEditor.clearSelection()
    }

    public async setSelection(range: types.Range): Promise<void> {
        return this._neovimEditor.setSelection(range)
    }

    public async blockInput(
        inputFunction: (input: (inp: string) => Promise<void>) => Promise<void>,
    ) {
        const neovim = this._neovimEditor.neovim as any
        return neovim.blockInput(inputFunction)
    }

    public executeCommand(command: string): void {
        this._neovimEditor.executeCommand(command)
    }

    public getBuffers(): Array<Oni.Buffer | Oni.InactiveBuffer> {
        return this._neovimEditor.getBuffers()
    }

    public async bufferDelete(bufferId: string = this.activeBuffer.id): Promise<void> {
        this._neovimEditor.bufferDelete(bufferId)
    }

    public async init(filesToOpen: string[]): Promise<void> {
        Log.info("[OniEditor::init] Called with filesToOpen: " + filesToOpen)

        return this._neovimEditor.init(filesToOpen)
    }

    public async input(key: string): Promise<void> {
        return this._neovimEditor.input(key)
    }

    public render(): JSX.Element {
        return this._neovimEditor.render()
    }
}
