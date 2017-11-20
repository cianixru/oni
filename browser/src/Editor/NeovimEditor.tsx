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

import { Event, IEvent } from "oni-types"

import { INeovimStartOptions, NeovimInstance, NeovimWindowManager } from "./../neovim"
import { CanvasRenderer, INeovimRenderer } from "./../Renderer"
import { NeovimScreen } from "./../Screen"

import { pluginManager } from "./../Plugins/PluginManager"

import { commandManager } from "./../Services/CommandManager"
import { registerBuiltInCommands } from "./../Services/Commands"
import { configuration, IConfigurationValues } from "./../Services/Configuration"
import { Errors } from "./../Services/Errors"
import { addInsertModeLanguageFunctionality, addNormalModeLanguageFunctionality } from "./../Services/Language"
import { TypingPredictionManager } from "./../Services/TypingPredictionManager"
import { WindowTitle } from "./../Services/WindowTitle"
import { workspace } from "./../Services/Workspace"

import * as UI from "./../UI/index"

import { IEditor } from "./Editor"

import { BufferManager } from "./BufferManager"
import { listenForBufferUpdates } from "./BufferUpdates"
import { NeovimPopupMenu } from "./NeovimPopupMenu"
import { NeovimSurface } from "./NeovimSurface"

import { tasks } from "./../Services/Tasks"

import { normalizePath, sleep } from "./../Utility"

import * as VimConfigurationSynchronizer from "./../Services/VimConfigurationSynchronizer"

export class NeovimEditor implements IEditor {
    private _bufferManager: BufferManager
    private _neovimInstance: NeovimInstance
    private _renderer: INeovimRenderer
    private _screen: NeovimScreen
    private _popupMenu: NeovimPopupMenu

    private _pendingAnimationFrame: boolean = false

    private _currentMode: string
    private _onBufferEnterEvent = new Event<Oni.EditorBufferEventArgs>()
    private _onBufferLeaveEvent = new Event<Oni.EditorBufferEventArgs>()
    private _onBufferChangedEvent = new Event<Oni.EditorBufferChangedEventArgs>()
    private _onBufferSavedEvent = new Event<Oni.EditorBufferEventArgs>()
    private _onCursorMoved = new Event<Oni.Cursor>()

    private _modeChanged$: Observable<Oni.Vim.Mode>
    private _cursorMoved$: Observable<Oni.Cursor>
    private _cursorMovedI$: Observable<Oni.Cursor>

    private _hasLoaded: boolean = false

    private _windowManager: NeovimWindowManager

    private _isFirstRender: boolean = true

    private _lastBufferId: string = null

    private _typingPredictionManager: TypingPredictionManager = new TypingPredictionManager()

    public get mode(): string {
        return this._currentMode
    }

    public get activeBuffer(): Oni.Buffer {
        return this._bufferManager.getBufferById(this._lastBufferId)
    }

    public get onCursorMoved(): IEvent<Oni.Cursor> {
        return this._onCursorMoved
    }

    // Events
    public get onModeChanged(): IEvent<Oni.Vim.Mode> {
        return this._neovimInstance.onModeChanged
    }

    public get onBufferEnter(): IEvent<Oni.EditorBufferEventArgs> {
        return this._onBufferEnterEvent
    }

    public get onBufferLeave(): IEvent<Oni.EditorBufferEventArgs> {
        return this._onBufferLeaveEvent
    }

    public get onBufferChanged(): IEvent<Oni.EditorBufferChangedEventArgs> {
        return this._onBufferChangedEvent
    }

    public get onBufferSaved(): IEvent<Oni.EditorBufferEventArgs> {
        return this._onBufferSavedEvent
    }

    // Capabilities
    public get neovim(): Oni.NeovimEditorCapability {
        return this._neovimInstance
    }

    constructor(
        private _config = configuration,
    ) {
        const services: any[] = []

        this._neovimInstance = new NeovimInstance(100, 100)
        this._bufferManager = new BufferManager(this._neovimInstance)
        this._screen = new NeovimScreen()

        this._popupMenu = new NeovimPopupMenu(
            this._neovimInstance.onShowPopupMenu,
            this._neovimInstance.onHidePopupMenu,
            this._neovimInstance.onSelectPopupMenu,
        )

        this._renderer = new CanvasRenderer()

        // Services
        const errorService = new Errors(this._neovimInstance)
        const windowTitle = new WindowTitle(this._neovimInstance)

        registerBuiltInCommands(commandManager, this._neovimInstance)

        tasks.registerTaskProvider(commandManager)
        tasks.registerTaskProvider(errorService)

        services.push(errorService)
        services.push(windowTitle)

        // Overlays
        // TODO: Replace `OverlayManagement` concept and associated window management code with
        // explicit window management: #362
        this._windowManager = new NeovimWindowManager(this._neovimInstance)

        this._neovimInstance.onYank.subscribe((yankInfo) => {
            if (configuration.getValue("editor.clipboard.enabled")) {
                clipboard.writeText(yankInfo.regcontents.join(require("os").EOL))
            }
        })

        this._neovimInstance.onLeave.subscribe(() => {
            // TODO: Only leave if all editors are closed...
            if (!configuration.getValue("debug.persistOnNeovimExit")) {
                remote.getCurrentWindow().close()
            }
        })

        this._neovimInstance.onOniCommand.subscribe((command) => {
            commandManager.executeCommand(command)
        })

        this._neovimInstance.on("event", (eventName: string, evt: any) => this._onVimEvent(eventName, evt))

        this._neovimInstance.onError.subscribe((err) => {
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
            UI.Actions.setColors(this._screen.foregroundColor, this._screen.backgroundColor)
            UI.Actions.setCursorPosition(this._screen)
            this._typingPredictionManager.setCursorPosition(this._screen.cursorRow, this._screen.cursorColumn)
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
                this._onCursorMoved.dispatch(cursorMoved)
            })

        this._modeChanged$ = this.onModeChanged.asObservable()

        this.onModeChanged.subscribe((newMode) => this._onModeChanged(newMode))

        const bufferUpdates$ = listenForBufferUpdates(this._neovimInstance, this._bufferManager)
        bufferUpdates$.subscribe((bufferUpdate) => {
            this._onBufferChangedEvent.dispatch(bufferUpdate)
            UI.Actions.bufferUpdate(parseInt(bufferUpdate.buffer.id, 10), bufferUpdate.buffer.modified, bufferUpdate.buffer.lineCount)
        })

        addInsertModeLanguageFunctionality(this._cursorMovedI$, this._modeChanged$)
        addNormalModeLanguageFunctionality(bufferUpdates$, this._cursorMoved$, this._modeChanged$)

        this._render()

        const browserWindow = remote.getCurrentWindow()

        browserWindow.on("blur", () => {
            this._neovimInstance.autoCommands.executeAutoCommand("FocusLost")
        })

        browserWindow.on("focus", () => {
            this._neovimInstance.autoCommands.executeAutoCommand("FocusGained")
        })

        this._onConfigChanged(this._config.getValues())
        this._config.onConfigurationChanged.subscribe((newValues: Partial<IConfigurationValues>) => this._onConfigChanged(newValues))

        ipcRenderer.on("menu-item-click", (_evt: any, message: string) => {
            if (message.startsWith(":")) {
                this._neovimInstance.command("exec \"" + message + "\"")
            } else {
                this._neovimInstance.command("exec \":normal! " + message + "\"")
            }
        })

        const openFiles = async (files: string[], action: string) => {

            await this._neovimInstance.callFunction("OniOpenFile", [action, files[0]])

            for (let i = 1; i < files.length; i++) {
                this._neovimInstance.command("exec \"" + action + " " + normalizePath(files[i]) + "\"")
            }
        }

        ipcRenderer.on("open-files", (_evt: any, message: string, files: string[]) => {
            openFiles(files, message)
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

    public async openFile(file: string): Promise<Oni.Buffer> {
        await this._neovimInstance.command(":e " + file)
        return this.activeBuffer
    }

    public executeCommand(command: string): void {
        commandManager.executeCommand(command, null)
    }

    public init(filesToOpen: string[]): void {
        const startOptions: INeovimStartOptions = {
            args: filesToOpen,
            runtimePaths: pluginManager.getAllRuntimePaths(),
            transport: configuration.getValue("experimental.neovim.transport"),
        }

        this._neovimInstance.start(startOptions)
            .then(() => {
                this._hasLoaded = true
                VimConfigurationSynchronizer.synchronizeConfiguration(this._neovimInstance, this._config.getValues())
            })
    }

    public render(): JSX.Element {

        const onBufferClose = (bufferId: number) => {
            this._neovimInstance.command(`bw ${bufferId}`)
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
            onKeyDown={onKeyDown}
            onBufferClose={onBufferClose}
            onBufferSelect={onBufferSelect}
            onTabClose={onTabClose}
            onTabSelect={onTabSelect} />
    }

    private _onModeChanged(newMode: string): void {

        this._typingPredictionManager.clearAllPredictions()

        if (newMode === "insert" && configuration.getValue("experimental.editor.typingPrediction")) {
            this._typingPredictionManager.enable()
        } else {
            this._typingPredictionManager.disable()
        }

        UI.Actions.setMode(newMode)
        this._currentMode = newMode
    }

    private _onVimEvent(eventName: string, evt: Oni.EventContext): void {
        UI.Actions.setWindowCursor(evt.windowNumber, evt.line - 1, evt.column - 1)

        tasks.onEvent(evt)

        const lastBuffer = this.activeBuffer
        const buf = this._bufferManager.updateBufferFromEvent(evt)

        if (eventName === "BufEnter") {
            if (lastBuffer && lastBuffer.filePath !== buf.filePath) {
                this._onBufferLeaveEvent.dispatch({
                    filePath: lastBuffer.filePath,
                    language: lastBuffer.language,
                })
            }

            this._lastBufferId = evt.bufferNumber.toString()
            this._onBufferEnterEvent.dispatch(buf)

            UI.Actions.bufferEnter(evt.bufferNumber, evt.bufferFullPath, evt.filetype, evt.bufferTotalLines, evt.hidden, evt.listed)
        } else if (eventName === "BufWritePost") {
            // After we save we aren't modified... but we can pass it in just to be safe
            UI.Actions.bufferSave(evt.bufferNumber, evt.modified, evt.version)

            this._onBufferSavedEvent.dispatch({
                filePath: evt.bufferFullPath,
                language: evt.filetype,
            })
        } else if (eventName === "BufDelete") {

            this._neovimInstance.getBufferIds()
                .then((ids) => UI.Actions.setCurrentBuffers(ids))
        }
    }

    private _onConfigChanged(newValues: Partial<IConfigurationValues>): void {
        const fontFamily = this._config.getValue("editor.fontFamily")
        const fontSize = this._config.getValue("editor.fontSize")
        const linePadding = this._config.getValue("editor.linePadding")

        UI.Actions.setFont(fontFamily, fontSize)
        this._neovimInstance.setFont(fontFamily, fontSize, linePadding)

        if (this._hasLoaded) {
            VimConfigurationSynchronizer.synchronizeConfiguration(this._neovimInstance, newValues)
        }

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
        if (configuration.getValue("debug.fakeLag.neovimInput")) {
            await sleep(configuration.getValue("debug.fakeLag.neovimInput"))
        }

        await this._neovimInstance.input(key)
    }
}
