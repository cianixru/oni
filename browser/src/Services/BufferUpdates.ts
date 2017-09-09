/**
 * BufferUpdates.ts
 *
 * Responsible for taking "buffer-update" messages and sending them
 * to the plugins. Sanitizes and manages incrementental state.
 */

import { INeovimInstance } from "./../neovim"
import { PluginManager } from "./../Plugins/PluginManager"

export class BufferUpdates {

    private _lastArgs: Oni.EventContext
    private _lastBufferLines: string[] = []
    private _modified: boolean = false
    private _lastBufferVersion: number = -1
    private _canSendIncrementalUpdates: boolean = false

    public get modified(): boolean {
        return this._modified
    }

    public get version(): number {
        return this._lastBufferVersion
    }

    public get lines(): string[] {
        return this._lastBufferLines
    }

    constructor(
        private _neovimInstance: INeovimInstance,
        private _pluginManager: PluginManager,
    ) {

        this._neovimInstance.on("mode-change", (mode: string) => {

            // If we were sending incremental updates, and we're moving out of insert mode, flush a full update
            if (this._canSendIncrementalUpdates && mode !== "insert") {
                this._pluginManager.notifyBufferUpdate(this._lastArgs, this._lastBufferLines)
            }

            this._canSendIncrementalUpdates = (mode === "insert")
        })

        this._neovimInstance.on("buffer-update", (args: Oni.EventContext, bufferLines: string[]) => {
            const lastLine = args.line
            this._lastArgs = args
            this._lastBufferLines = bufferLines
            this._modified = args.modified
            this._lastBufferVersion = args.version

            // If we can send incremental updates, and the line hasn't changed, just send the incremental change
            if (this._canSendIncrementalUpdates && lastLine === args.line) {
                const changedLine = bufferLines[args.line - 1]
                this._pluginManager.notifyBufferUpdateIncremental(args, args.line, changedLine)
            } else {
                this._pluginManager.notifyBufferUpdate(args, bufferLines)
            }
        })

        this._neovimInstance.on("buffer-update-incremental", (args: Oni.EventContext, bufferLine: string, lineNumber: number) => {
            this._lastArgs = args
            this._lastBufferLines[lineNumber - 1] = bufferLine
            this._modified = args.modified
            this._lastBufferVersion = args.version

            this._pluginManager.notifyBufferUpdateIncremental(args, lineNumber, bufferLine)
        })
    }
}
