/**
 * Workspace.ts
 *
 * The 'workspace' is responsible for managing the state of the current project:
 *  - The current / active directory (and 'Open Folder')
 */

import { remote } from "electron"
import "rxjs/add/observable/defer"
import "rxjs/add/observable/from"
import "rxjs/add/operator/concatMap"
import "rxjs/add/operator/toPromise"
import { Observable } from "rxjs/Observable"
import * as types from "vscode-languageserver-types"

import * as Oni from "oni-api"
import { Event, IEvent } from "oni-types"

import * as Log from "./../Log"
import * as Helpers from "./../Plugins/Api/LanguageClient/LanguageClientHelpers"

import { editorManager } from "./EditorManager"
import { convertTextDocumentEditsToFileMap } from "./Language/Edits"

export class Workspace implements Oni.Workspace {
    private _onDirectoryChangedEvent = new Event<string>()
    private _onFocusGainedEvent = new Event<Oni.Buffer>()
    private _onFocusLostEvent = new Event<Oni.Buffer>()
    private _mainWindow = remote.getCurrentWindow()
    private _lastActiveBuffer: Oni.Buffer

    constructor() {
        this._mainWindow.on("focus", () => {
            this._onFocusGainedEvent.dispatch(this._lastActiveBuffer)
        })

        this._mainWindow.on("blur", () => {
            this._lastActiveBuffer = editorManager.activeEditor.activeBuffer
            this._onFocusLostEvent.dispatch(this._lastActiveBuffer)
        })
    }

    public get onDirectoryChanged(): IEvent<string> {
        return this._onDirectoryChangedEvent
    }

    public changeDirectory(newDirectory: string) {
        process.chdir(newDirectory)
        this._onDirectoryChangedEvent.dispatch(newDirectory)
    }

    public async applyEdits(edits: types.WorkspaceEdit): Promise<void> {

        let editsToUse = edits
        if (edits.documentChanges) {
            editsToUse = convertTextDocumentEditsToFileMap(edits.documentChanges)
        }

        const files = Object.keys(editsToUse)

        // TODO: Show modal to grab input
        // await editorManager.activeEditor.openFiles(files)

        const deferredEdits = await files.map((fileUri: string) => {
            return Observable.defer(async () => {
                const changes = editsToUse[fileUri]
                const fileName = Helpers.unwrapFileUriPath(fileUri)
                // TODO: Sort changes?
                Log.verbose("[Workspace] Opening file: " + fileName)
                const buf = await editorManager.activeEditor.openFile(fileName)
                Log.verbose("[Workspace] Got buffer for file: " + buf.filePath + " and id: " + buf.id)
                await buf.applyTextEdits(changes)
                Log.verbose("[Workspace] Applied " + changes.length + " edits to buffer")
            })
        })

        await Observable.from(deferredEdits)
                .concatMap(de => de)
                .toPromise()

        Log.verbose("[Workspace] Completed applying edits")

        // Hide modal
    }

    public get onFocusGained(): IEvent<Oni.Buffer> {
        return this._onFocusGainedEvent
    }

    public get onFocusLost(): IEvent<Oni.Buffer> {
        return this._onFocusLostEvent
    }
}

export const workspace = new Workspace()
