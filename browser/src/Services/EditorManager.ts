/**
 * EditorManager.ts
 *
 * Responsible for managing state of the editor collection, and
 * switching between active editors.
 *
 * It also provides convenience methods for hooking events
 * to the active editor, and managing transitions between editors.
 */

import { Event, IEvent } from "./../Event"
import { IDisposable } from "./../IDisposable"

export class EditorManager implements Oni.EditorManager {
    private _activeEditor: Oni.Editor = null
    private _allEditors: AllEditors = new AllEditors()
    private _onActiveEditorChanged: Event<Oni.Editor> = new Event<Oni.Editor>()

    /**
     * API Methods
     */
    public get allEditors(): Oni.Editor {
        return this._allEditors
    }

    public get activeEditor(): Oni.Editor {
        return this._activeEditor
    }

    public get onActiveEditorChanged(): IEvent<Oni.Editor> {
        return this._onActiveEditorChanged
    }

    /**
     * Internal Methods
     */
    public setActiveEditor(editor: Oni.Editor) {
        this._activeEditor = editor

        const oldEditor = this._allEditors.getUnderlyingEditor()
        if (editor !== oldEditor) {
            this._onActiveEditorChanged.dispatch(editor)
            this._allEditors.setActiveEditor(editor)
        }
    }
}

/**
 * AllEditors is a proxy for the Neovim interface,
 * exposing methods of 'all' editors, as an aggregate.
 *
 * This enables consumers to use `Oni.editor.allEditors.onModeChanged((newMode) => { ... }),
 * for convenience, as it handles manages tracking subscriptions as the active editor changes.
 */
class AllEditors implements Oni.Editor {
    private _activeEditor: Oni.Editor
    private _subscriptions: IDisposable[] = []

    private _onModeChanged = new Event<string>()
    private _onBufferEnter = new Event<Oni.EditorBufferEventArgs>()
    private _onBufferLeave = new Event<Oni.EditorBufferEventArgs>()
    /**
     * API Methods
     */
    public get mode(): string {
        if (!this._activeEditor) {
            return null
        }

        return this._activeEditor.mode
    }

    public get neovim(): Oni.NeovimEditorCapability {
        if (!this._activeEditor) {
            return null
        }

        return this._activeEditor.neovim
    }

    public get onModeChanged(): IEvent<string> {
        return this._onModeChanged
    }

    public get onBufferEnter(): IEvent<Oni.EditorBufferEventArgs> {
        return this._onBufferEnter
    }

    public get onBufferLeave(): IEvent<Oni.EditorBufferEventArgs> {
        return this._onBufferLeave
    }

    /**
     * Internal methods
     */

    public setActiveEditor(newEditor: Oni.Editor) {
        this._activeEditor = newEditor
        this._subscriptions.forEach((d) => d.dispose())
        this._subscriptions = []
        this._subscriptions.push(newEditor.onModeChanged.subscribe((val) => this._onModeChanged.dispatch(val)))
        this._subscriptions.push(newEditor.onBufferEnter.subscribe((val) => this._onBufferEnter.dispatch(val)))
        this._subscriptions.push(newEditor.onBufferLeave.subscribe((val) => this._onBufferLeave.dispatch(val)))
    }

    public getUnderlyingEditor(): Oni.Editor {
        return this._activeEditor
    }
}

export const editorManager: EditorManager = new EditorManager()
