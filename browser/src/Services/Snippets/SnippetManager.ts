/**
 * Snippets.ts
 *
 * Manages snippet integration
 */

import { IDisposable } from "oni-types"

import * as Log from "./../../Log"

import "rxjs/add/operator/auditTime"
import { Subject } from "rxjs/Subject"

import { EditorManager } from "./../EditorManager"

import { OniSnippet } from "./OniSnippet"
import { SnippetBufferLayer } from "./SnippetBufferLayer"
import { CompositeSnippetProvider, ISnippetProvider } from "./SnippetProvider"
import { SnippetSession } from "./SnippetSession"

import { ISnippet } from "./ISnippet"

export class SnippetManager {
    private _activeSession: SnippetSession
    private _disposables: IDisposable[] = []
    private _currentLayer: SnippetBufferLayer = null

    private _snippetProvider: CompositeSnippetProvider
    private _synchronizeSnippetObseravble: Subject<void> = new Subject<void>()

    constructor(private _editorManager: EditorManager) {
        this._snippetProvider = new CompositeSnippetProvider()

        this._synchronizeSnippetObseravble.auditTime(50).subscribe(() => {
            const activeEditor = this._editorManager.activeEditor as any
            const activeSession = this._activeSession

            if (activeEditor && activeSession) {
                activeEditor.blockInput(() => activeSession.synchronizeUpdatedPlaceholders())
            }
        })
    }

    public async getSnippetsForLanguage(language: string): Promise<ISnippet[]> {
        return this._snippetProvider.getSnippets(language)
    }

    public registerSnippetProvider(snippetProvider: ISnippetProvider): void {
        this._snippetProvider.registerProvider(snippetProvider)
    }

    /**
     * Inserts snippet in the active editor, at current cursor position
     */
    public async insertSnippet(snippet: string): Promise<void> {
        this.cancel()
        Log.info("[SnippetManager::insertSnippet]")

        const snip = new OniSnippet(snippet)

        const activeEditor = this._editorManager.activeEditor as any
        const snippetSession = new SnippetSession(activeEditor as any, snip)
        await snippetSession.start()

        const buffer = this._editorManager.activeEditor.activeBuffer
        this._currentLayer = new SnippetBufferLayer(buffer, snippetSession)

        const s2 = activeEditor.onBufferChanged.subscribe(() => {
            this._synchronizeSnippetObseravble.next()
        })

        const s3 = snippetSession.onCancel.subscribe(() => {
            this.cancel()
        })

        this._disposables = [s2, s3]

        this._activeSession = snippetSession
    }

    public nextPlaceholder(): void {
        if (this.isSnippetActive()) {
            this._activeSession.nextPlaceholder()
        }
    }

    public previousPlaceholder(): void {
        if (this.isSnippetActive()) {
            this._activeSession.previousPlaceholder()
        }
    }

    public isSnippetActive(): boolean {
        return !!this._activeSession
    }

    public cancel(): void {
        if (this._activeSession) {
            this._cleanupAfterSession()
        }

        if (this._currentLayer) {
            this._currentLayer.dispose()
        }
    }

    private _cleanupAfterSession(): void {
        Log.info("[SnippetManager::cancel]")
        this._disposables.forEach(d => d.dispose())
        this._disposables = []
        this._activeSession = null
    }
}
