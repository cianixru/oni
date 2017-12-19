/**
 * NeovimEditor.ts
 *
 * IEditor implementation for Neovim
 */

import * as React from "react"

import "rxjs/add/observable/defer"
import "rxjs/add/observable/merge"
import "rxjs/add/operator/map"
import "rxjs/add/operator/mergeMap"
import { Observable } from "rxjs/Observable"

import { clipboard, ipcRenderer, remote } from "electron"

import * as Oni from "oni-api"
import { Event } from "oni-types"

import * as Log from "./../Log"

import { addDefaultUnitIfNeeded } from "./../Font"
import { BufferEventContext, EventContext, INeovimStartOptions, NeovimInstance, NeovimScreen, NeovimWindowManager } from "./../neovim"
import { CanvasRenderer, INeovimRenderer } from "./../Renderer"

import { pluginManager } from "./../Plugins/PluginManager"

import { Colors } from "./../Services/Colors"
import { CallbackCommand, commandManager } from "./../Services/CommandManager"
import { registerBuiltInCommands } from "./../Services/Commands"
import { Completion } from "./../Services/Completion"
import { Configuration, IConfigurationValues } from "./../Services/Configuration"
import { Errors } from "./../Services/Errors"
import { addInsertModeLanguageFunctionality, LanguageEditorIntegration, LanguageManager } from "./../Services/Language"
import { ISyntaxHighlighter, NullSyntaxHighlighter, SyntaxHighlighter } from "./../Services/SyntaxHighlighting"
import { ThemeManager } from "./../Services/Themes"
import { TypingPredictionManager } from "./../Services/TypingPredictionManager"
import { workspace } from "./../Services/Workspace"

import * as UI from "./../UI/index"

import { Editor, IEditor } from "./Editor"

import { BufferManager } from "./BufferManager"
import { listenForBufferUpdates } from "./BufferUpdates"
import { CompletionMenu } from "./CompletionMenu"
import { HoverRenderer } from "./HoverRenderer"
import { NeovimPopupMenu } from "./NeovimPopupMenu"
import { NeovimSurface } from "./NeovimSurface"

import { tasks } from "./../Services/Tasks"

import { normalizePath, sleep } from "./../Utility"

import * as VimConfigurationSynchronizer from "./../Services/VimConfigurationSynchronizer"

export class NeovimEditor extends Editor implements IEditor {
    private _bufferManager: BufferManager
    private _neovimInstance: NeovimInstance
    private _renderer: INeovimRenderer
    private _screen: NeovimScreen
    private _completionMenu: CompletionMenu
    private _popupMenu: NeovimPopupMenu
    private _errorInitializing: boolean = false

    private _pendingAnimationFrame: boolean = false

    private _onEnterEvent: Event<void> = new Event<void>()

    private _modeChanged$: Observable<Oni.Vim.Mode>
    private _cursorMoved$: Observable<Oni.Cursor>
    private _cursorMovedI$: Observable<Oni.Cursor>

    private _hasLoaded: boolean = false

    private _windowManager: NeovimWindowManager

    private _currentColorScheme: string = ""
    private _isFirstRender: boolean = true

    private _lastBufferId: string = null

    private _typingPredictionManager: TypingPredictionManager = new TypingPredictionManager()
    private _syntaxHighlighter: ISyntaxHighlighter
    private _languageIntegration: LanguageEditorIntegration
    private _completion: Completion
    private _hoverRenderer: HoverRenderer

    public /* override */ get activeBuffer(): Oni.Buffer {
        return this._bufferManager.getBufferById(this._lastBufferId)
    }

    // Capabilities
    public get neovim(): Oni.NeovimEditorCapability {
        return this._neovimInstance
    }

    public get syntaxHighlighter(): ISyntaxHighlighter {
        return this._syntaxHighlighter
    }

    constructor(
        private _colors: Colors,
        private _configuration: Configuration,
        private _languageManager: LanguageManager,
        private _themeManager: ThemeManager,
    ) {
        super()

        const services: any[] = []

        this._neovimInstance = new NeovimInstance(100, 100)
        this._bufferManager = new BufferManager(this._neovimInstance)
        this._screen = new NeovimScreen()

        this._hoverRenderer = new HoverRenderer(this, this._configuration)

        this._popupMenu = new NeovimPopupMenu(
            this._neovimInstance.onShowPopupMenu,
            this._neovimInstance.onHidePopupMenu,
            this._neovimInstance.onSelectPopupMenu,
            this.onBufferEnter,
        )

        this._renderer = new CanvasRenderer()

        // Services
        const errorService = new Errors(this._neovimInstance)

        registerBuiltInCommands(commandManager, this._neovimInstance)

        commandManager.registerCommand(new CallbackCommand(
            "editor.quickInfo.show",
            null,
            null,
            () => this._languageIntegration.showHover(),
        ))

        tasks.registerTaskProvider(commandManager)
        tasks.registerTaskProvider(errorService)

        services.push(errorService)

        this._colors.onColorsChanged.subscribe(() => {
            const updatedColors: any = this._colors.getColors()
            UI.Actions.setColors(updatedColors)
        })

        // Overlays
        // TODO: Replace `OverlayManagement` concept and associated window management code with
        // explicit window management: #362
        this._windowManager = new NeovimWindowManager(this._neovimInstance)

        this._neovimInstance.onYank.subscribe((yankInfo) => {
            if (this._configuration.getValue("editor.clipboard.enabled")) {
                clipboard.writeText(yankInfo.regcontents.join(require("os").EOL))
            }
        })

        this._neovimInstance.onTitleChanged.subscribe((newTitle) => {
            const title = newTitle.replace(" - NVIM", " - ONI")
            UI.Actions.setWindowTitle(title)
        })

        this._neovimInstance.onLeave.subscribe(() => {
            // TODO: Only leave if all editors are closed...
            if (!this._configuration.getValue("debug.persistOnNeovimExit")) {
                remote.getCurrentWindow().close()
            }
        })

        this._neovimInstance.onOniCommand.subscribe((command) => {
            commandManager.executeCommand(command)
        })

        this._neovimInstance.on("event", (eventName: string, evt: any) => {
            const current = evt.current || evt
            this._updateWindow(current)
            this._bufferManager.updateBufferFromEvent(current)
        })

        this._neovimInstance.autoCommands
            .onBufEnter.subscribe((evt: BufferEventContext) => this._onBufEnter(evt))

        this._neovimInstance.autoCommands
            .onBufWipeout.subscribe((evt: BufferEventContext) => this._onBufWipeout(evt))

        this._neovimInstance.autoCommands
            .onBufWritePost.subscribe((evt: EventContext) => this._onBufWritePost(evt))

        this._neovimInstance.onColorsChanged.subscribe(() => {
            this._onColorsChanged()
        })

        this._neovimInstance.onError.subscribe((err) => {
            this._errorInitializing = true
            UI.Actions.setNeovimError(true)
        })

        this._neovimInstance.onDirectoryChanged.subscribe((newDirectory) => {
            workspace.changeDirectory(newDirectory)
        })

        this._neovimInstance.on("action", (action: any) => {
            this._renderer.onAction(action)
            this._screen.dispatch(action)

            this._scheduleRender()
        })

        this._neovimInstance.onRedrawComplete.subscribe(() => {
            UI.Actions.setCursorPosition(this._screen)
            this._typingPredictionManager.setCursorPosition(this._screen)
        })

        this._neovimInstance.on("tabline-update", (currentTabId: number, tabs: any[]) => {
            UI.Actions.setTabs(currentTabId, tabs)
        })

        this._cursorMoved$ = this._neovimInstance.autoCommands.onCursorMoved.asObservable()
            .map((evt): Oni.Cursor => ({
                line: evt.line - 1,
                column: evt.column - 1,
            }))

        this._cursorMovedI$ = this._neovimInstance.autoCommands.onCursorMovedI.asObservable()
            .map((evt): Oni.Cursor => ({
                line: evt.line - 1,
                column: evt.column - 1,
            }))

        Observable.merge(this._cursorMoved$, this._cursorMovedI$)
            .subscribe((cursorMoved) => {
                this.notifyCursorMoved(cursorMoved)
            })

        this._modeChanged$ = this._neovimInstance.onModeChanged.asObservable()
        this._neovimInstance.onModeChanged.subscribe((newMode) => this._onModeChanged(newMode))

        const bufferUpdates$ = listenForBufferUpdates(this._neovimInstance, this._bufferManager)
        bufferUpdates$.subscribe((bufferUpdate) => {
            this.notifyBufferChanged(bufferUpdate)
            UI.Actions.bufferUpdate(parseInt(bufferUpdate.buffer.id, 10), bufferUpdate.buffer.modified, bufferUpdate.buffer.lineCount)

            this._syntaxHighlighter.notifyBufferUpdate(bufferUpdate)
        })

        this._neovimInstance.onScroll.subscribe((args: EventContext) => {
            const convertedArgs: Oni.EditorBufferScrolledEventArgs = {
                bufferTotalLines: args.bufferTotalLines,
                windowTopLine: args.windowTopLine,
                windowBottomLine: args.windowBottomLine,
            }
            this.notifyBufferScrolled(convertedArgs)
        })

        addInsertModeLanguageFunctionality(this._cursorMovedI$, this._modeChanged$)

        const textMateHighlightingEnabled = this._configuration.getValue("experimental.editor.textMateHighlighting.enabled")
        this._syntaxHighlighter = textMateHighlightingEnabled ? new SyntaxHighlighter() : new NullSyntaxHighlighter()

        this._completion = new Completion(this, this._languageManager, this._configuration)
        this._completionMenu = new CompletionMenu()

        this._completion.onShowCompletionItems.subscribe((completions) => {
            this._completionMenu.show(completions.filteredCompletions, completions.base)
        })

        this._completion.onHideCompletionItems.subscribe((completions) => {
            this._completionMenu.hide()
        })

        this._completionMenu.onItemFocused.subscribe((item) => {
            this._completion.resolveItem(item)
        })

        this._completionMenu.onItemSelected.subscribe((item) => {
            this._completion.commitItem(item)
        })

        this._languageIntegration = new LanguageEditorIntegration(this, this._configuration, this._languageManager)

        this._languageIntegration.onShowHover.subscribe((hover) => {
            this._hoverRenderer.showQuickInfo(hover.hover, hover.errors)
        })

        this._languageIntegration.onHideHover.subscribe(() => {
            this._hoverRenderer.hideQuickInfo()
        })

        this._languageIntegration.onShowDefinition.subscribe((definition) => {
            UI.Actions.setDefinition(definition.token, definition.location)
        })

        this._languageIntegration.onHideDefinition.subscribe((definition) => {
            UI.Actions.hideDefinition()
        })

        this._render()

        const browserWindow = remote.getCurrentWindow()

        browserWindow.on("blur", () => {
            this._neovimInstance.autoCommands.executeAutoCommand("FocusLost")
        })

        browserWindow.on("focus", () => {
            this._neovimInstance.autoCommands.executeAutoCommand("FocusGained")

            // If the user has autoread enabled, we should run ":checktime" on
            // focus, as this is needed to get the file to auto-update.
            // https://github.com/neovim/neovim/issues/1936
            if (_configuration.getValue("vim.setting.autoread")) {
                this._neovimInstance.command(":checktime")
            }
        })

        this._onConfigChanged(this._configuration.getValues())
        this._configuration.onConfigurationChanged.subscribe((newValues: Partial<IConfigurationValues>) => this._onConfigChanged(newValues))

        ipcRenderer.on("menu-item-click", (_evt: any, message: string) => {
            if (message.startsWith(":")) {
                this._neovimInstance.command("exec \"" + message + "\"")
            } else {
                this._neovimInstance.command("exec \":normal! " + message + "\"")
            }
        })

        ipcRenderer.on("open-files", (_evt: any, message: string, files: string[]) => {
            this._openFiles(files, message)
        })

        // enable opening a file via drag-drop
        document.ondragover = (ev) => {
            ev.preventDefault()
        }
        document.body.ondrop = (ev) => {
            ev.preventDefault()

            const files = ev.dataTransfer.files
            // open first file in current editor
            this._neovimInstance.open(normalizePath(files[0].path))
            // open any subsequent files in new tabs
            for (let i = 1; i < files.length; i++) {
                this._neovimInstance.command("exec \":tabe " + normalizePath(files.item(i).path) + "\"")
            }
        }
    }

    public dispose(): void {
        if (this._syntaxHighlighter) {
            this._syntaxHighlighter.dispose()
            this._syntaxHighlighter = null
        }

        if (this._languageIntegration) {
            this._languageIntegration.dispose()
            this._languageIntegration = null
        }

        if (this._completion) {
            this._completion.dispose()
            this._completion = null
        }

        // TODO: Implement full disposal logic
        this._popupMenu.dispose()
        this._popupMenu = null

        this._windowManager.dispose()
        this._windowManager = null
    }

    public enter(): void {
        Log.info("[NeovimEditor::enter]")
        this._onEnterEvent.dispatch()
        UI.Actions.setHasFocus(true)
    }

    public leave(): void {
        Log.info("[NeovimEditor::leave]")
        UI.Actions.setHasFocus(false)
    }

    public async openFile(file: string): Promise<Oni.Buffer> {
        await this._neovimInstance.command(":e " + file)
        return this.activeBuffer
    }

    public executeCommand(command: string): void {
        commandManager.executeCommand(command, null)
    }

    public async init(filesToOpen: string[]): Promise<void> {
        const startOptions: INeovimStartOptions = {
            runtimePaths: pluginManager.getAllRuntimePaths(),
            transport: this._configuration.getValue("experimental.neovim.transport"),
        }

        await this._neovimInstance.start(startOptions)

        if (this._errorInitializing) {
            return
        }

        VimConfigurationSynchronizer.synchronizeConfiguration(this._neovimInstance, this._configuration.getValues())

        this._themeManager.onThemeChanged.subscribe(() => {
            const newTheme = this._themeManager.activeTheme

            if (newTheme.baseVimTheme && newTheme.baseVimTheme !== this._currentColorScheme) {
                this._neovimInstance.command(":color " + newTheme.baseVimTheme)
            }
        })

        if (this._themeManager.activeTheme && this._themeManager.activeTheme.baseVimTheme) {
            await this._neovimInstance.command(":color " + this._themeManager.activeTheme.baseVimTheme)
        }

        if (filesToOpen && filesToOpen.length > 0) {
            await this._openFiles(filesToOpen, ":tabnew")
        }

        this._hasLoaded = true
        this._isFirstRender = true
        this._scheduleRender()
    }

    public render(): JSX.Element {

        const onBufferClose = (bufferId: number) => {
            this._neovimInstance.command(`bw! ${bufferId}`)
        }

        const onBufferSelect = (bufferId: number) => {
            this._neovimInstance.command(`buf ${bufferId}`)
        }

        const onTabClose = (tabId: number) => {
            this._neovimInstance.command(`tabclose ${tabId}`)
        }

        const onTabSelect = (tabId: number) => {
            this._neovimInstance.command(`tabn ${tabId}`)
        }

        const onKeyDown = (key: string) => {
            this._onKeyDown(key)
        }

        return <NeovimSurface renderer={this._renderer}
            typingPrediction={this._typingPredictionManager}
            neovimInstance={this._neovimInstance}
            screen={this._screen}
            onActivate={this._onEnterEvent}
            onKeyDown={onKeyDown}
            onBufferClose={onBufferClose}
            onBufferSelect={onBufferSelect}
            onTabClose={onTabClose}
            onTabSelect={onTabSelect} />
    }

    private async _openFiles(files: string[], action: string): Promise<void> {
        await this._neovimInstance.callFunction("OniOpenFile", [action, files[0]])

        for (let i = 1; i < files.length; i++) {
            await this._neovimInstance.command("exec \"" + action + " " + normalizePath(files[i]) + "\"")
        }
    }

    private _onModeChanged(newMode: string): void {

        this._typingPredictionManager.clearAllPredictions()

        if (newMode === "insert" && this._configuration.getValue("editor.typingPrediction")) {
            this._typingPredictionManager.enable()
        } else {
            this._typingPredictionManager.disable()
        }

        UI.Actions.setMode(newMode)
        this.setMode(newMode as Oni.Vim.Mode)

        if (newMode === "insert") {
            this._syntaxHighlighter.notifyStartInsertMode(this.activeBuffer)
        } else {
            this._syntaxHighlighter.notifyEndInsertMode(this.activeBuffer)
        }
    }

    private _updateWindow(currentBuffer: EventContext) {
        UI.Actions.setWindowCursor(
            currentBuffer.windowNumber,
            currentBuffer.line - 1,
            currentBuffer.column - 1,
        )
        // Convert to 0-based positions
        this._syntaxHighlighter.notifyViewportChanged(
            currentBuffer.bufferNumber.toString(),
            currentBuffer.windowTopLine - 1,
            currentBuffer.windowBottomLine - 1,
        )
    }

    private async _onBufEnter(evt: BufferEventContext): Promise<void> {
        const buf = this._bufferManager.updateBufferFromEvent(evt.current)
        const lastBuffer = this.activeBuffer
        if (lastBuffer && lastBuffer.filePath !== buf.filePath) {
            this.notifyBufferLeave({
                filePath: lastBuffer.filePath,
                language: lastBuffer.language,
            })
        }
        this._lastBufferId = evt.current.bufferNumber.toString()
        this.notifyBufferEnter(buf)

        // Existing buffers contains a duplicate current buffer object which should be filtered out
        // and current buffer sent instead. Finally Filter out falsy viml values.
        const existingBuffersWithoutCurrent =
            evt.existingBuffers.filter(b => b.bufferNumber !== evt.current.bufferNumber)
        const buffers = [evt.current, ...existingBuffersWithoutCurrent].filter(b => !!b)

        UI.Actions.bufferEnter(buffers)
    }

    private async _onBufWritePost(evt: EventContext): Promise<void> {
        // After we save we aren't modified... but we can pass it in just to be safe
        UI.Actions.bufferSave(evt.bufferNumber, evt.modified, evt.version)

        this.notifyBufferSaved({
            filePath: evt.bufferFullPath,
            language: evt.filetype,
        })
    }

    private async _onBufWipeout(evt: BufferEventContext): Promise<void> {
        this._neovimInstance
        .getBufferIds()
        .then(ids => UI.Actions.setCurrentBuffers(ids))
    }

    private _onConfigChanged(newValues: Partial<IConfigurationValues>): void {
        const fontFamily = this._configuration.getValue("editor.fontFamily")
        const fontSize = addDefaultUnitIfNeeded(this._configuration.getValue("editor.fontSize"))
        const linePadding = this._configuration.getValue("editor.linePadding")

        UI.Actions.setFont(fontFamily, fontSize)
        this._neovimInstance.setFont(fontFamily, fontSize, linePadding)

        if (this._hasLoaded) {
            VimConfigurationSynchronizer.synchronizeConfiguration(this._neovimInstance, newValues)
        }

        this._isFirstRender = true

        this._scheduleRender()
    }

    private async _onColorsChanged(): Promise<void> {
        const newColorScheme = await this._neovimInstance.eval<string>("g:colors_name")
        this._currentColorScheme = newColorScheme
        const backgroundColor = this._screen.backgroundColor
        const foregroundColor = this._screen.foregroundColor

        Log.info(`[NeovimEditor] Colors changed: ${newColorScheme} - background: ${backgroundColor} foreground: ${foregroundColor}`)

        this._themeManager.notifyVimThemeChanged(newColorScheme, backgroundColor, foregroundColor)

        // Flip first render to force a full redraw
        this._isFirstRender = true
        this._scheduleRender()
    }

    private _scheduleRender(): void {
        if (this._pendingAnimationFrame) {
            return
        }

        this._pendingAnimationFrame = true
        window.requestAnimationFrame(() => this._render())
    }

    private _render(): void {
        this._pendingAnimationFrame = false

        if (this._hasLoaded) {
            if (this._isFirstRender) {
                this._isFirstRender = false
                this._renderer.redrawAll(this._screen)
            } else {
                this._renderer.draw(this._screen)
            }
        }
    }

    private async _onKeyDown(key: string): Promise<void> {
        if (this._configuration.getValue("debug.fakeLag.neovimInput")) {
            await sleep(this._configuration.getValue("debug.fakeLag.neovimInput"))
        }

        await this._neovimInstance.input(key)
    }
}
