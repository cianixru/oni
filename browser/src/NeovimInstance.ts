import * as cp from "child_process"
import { remote } from "electron"
import { EventEmitter } from "events"
import * as path from "path"
import * as Q from "q"
import * as Actions from "./actions"
import * as Config from "./Config"
import { measureFont } from "./Font"
import { Buffer, IBuffer } from "./neovim/Buffer"
import { SessionWrapper } from "./neovim/SessionWrapper"
import { IWindow, Window } from "./neovim/Window"
import * as Platform from "./Platform"
import { PluginManager } from "./Plugins/PluginManager"
import { IPixelPosition, IPosition } from "./Screen"

const attach = require("neovim-client") // tslint:disable-line no-var-requires

export interface INeovimInstance {
    cursorPosition: IPosition
    screenToPixels(row: number, col: number): IPixelPosition

    input(inputString: string): void
    command(command: string): Q.Promise<any>
    eval(expression: string): Q.Promise<any>

    on(event: string, handler: Function): void

    setFont(fontFamily: string, fontSize: string): void

    getCurrentBuffer(): Q.Promise<IBuffer>
    getCurrentWindow(): Q.Promise<IWindow>

    getSelectionRange(): Q.Promise<null | Oni.Range>
}

/**
 * Integration with NeoVim API
 */
export class NeovimInstance extends EventEmitter implements INeovimInstance {
    private _neovim: any
    private _initPromise: any

    private _fontFamily: string = Config.getValue<string>("editor.fontFamily")
    private _fontSize: string = Config.getValue<string>("editor.fontSize")
    private _fontWidthInPixels: number
    private _fontHeightInPixels: number

    private _lastHeightInPixels: number
    private _lastWidthInPixels: number

    private _rows: number
    private _cols: number

    private _pluginManager: PluginManager
    private _sessionWrapper: SessionWrapper

    constructor(pluginManager: PluginManager, widthInPixels: number, heightInPixels: number) {
        super()

        this._pluginManager = pluginManager

        this._lastWidthInPixels = widthInPixels
        this._lastHeightInPixels = heightInPixels
    }

    public start(filesToOpen?: string[]): void {
        filesToOpen = filesToOpen || []

        this._initPromise = startNeovim(this._pluginManager.getAllRuntimePaths(), filesToOpen)
            .then((nv) => {
                console.log("NevoimInstance: Neovim started") // tslint:disable-line no-console

                // Workaround for issue where UI
                // can fail to attach if there is a UI-blocking error
                // nv.input("<ESC>")

                this._neovim = nv
                this._sessionWrapper = new SessionWrapper(this._neovim._session)

                this._neovim.on("error", (err: Error) => {
                    console.error(err)
                })

                this._neovim.on("notification", (method: any, args: any) => {
                    if (method === "redraw") {
                        this._handleNotification(method, args)
                    } else if (method === "oni_plugin_notify") {
                        const pluginArgs = args[0]
                        const pluginMethod = pluginArgs.shift()

                        // TODO: Update pluginManager to subscribe from event here, instead of dupliating this

                        if (pluginMethod === "buffer_update") {
                            const eventContext = args[0][0]
                            const bufferLines = args[0][1]

                            this.emit("buffer-update", eventContext, bufferLines)
                        } else if (pluginMethod === "event") {
                            const eventName = args[0][0]
                            const eventContext = args[0][1]

                            this.emit("event", eventName, eventContext)
                        } else if (pluginMethod === "window_display_update") {
                            this.emit("window-display-update", args[0][0], args[0][1])
                        } else {
                            console.warn("Unknown event from oni_plugin_notify: " + pluginMethod)
                        }
                    } else {
                        console.warn("Unknown notification: " + method)
                    }
                })

                this._neovim.on("request", (method: any, _args: any, _resp: any) => {
                    console.warn("Unhandled request: " + method)
                })

                this._neovim.on("disconnect", () => {
                    remote.app.quit()
                })

                const startupOptions = {
                    rgb: true,
                    popupmenu_external: true,
                }

                const size = this._getSize()
                this._rows = size.rows
                this._cols = size.cols

                // Workaround for bug in neovim/node-client
                // The 'uiAttach' method overrides the new 'nvim_ui_attach' method
                this._neovim._session.request("nvim_ui_attach", [size.cols, size.rows, startupOptions], (_err?: Error) => {
                    console.log("Attach success") // tslint:disable-line no-console

                    performance.mark("NeovimInstance.Plugins.Start")
                    this._pluginManager.startPlugins(this)
                    performance.mark("NeovimInstance.Plugins.End")
                })
            }, (err) => {
                this.emit("error", err)
            })

        this.setFont("Consolas", "14px")
    }

    public getMode(): Q.Promise<string> {
        return this.eval<string>("mode()")
    }

    public getSelectionRange(): Q.Promise<null | Oni.Range> {

        let buffer: null | IBuffer = null
        let start: any = null
        let end: any = null

        // FIXME: deal with nulls
        return this.getMode()
            .then((mode) => {

                if (mode !== "v" && mode !== "V") {
                    throw "Not in visual mode"
                }
            })
            .then(() => this.input("<esc>"))
            .then(() => this.getCurrentBuffer())
            .then((buf) => buffer = buf)
            .then(() => buffer && buffer.getMark("<") as any)
            .then((s) => start = s)
            .then(() => buffer && buffer.getMark(">") as any)
            .then((e) => end = e)
            .then(() => this.command("normal! gv"))
            .then(() => ({
                start,
                end,
            })) as any
    }

    public setFont(fontFamily: string, fontSize: string): void {
        this._fontFamily = fontFamily
        this._fontSize = fontSize

        const {width, height} = measureFont(this._fontFamily, this._fontSize)

        this._fontWidthInPixels = width
        this._fontHeightInPixels = height

        this.emit("action", Actions.setFont(fontFamily, fontSize, width, height))

        this.resize(this._lastWidthInPixels, this._lastHeightInPixels)
    }

    public eval<T>(expression: string): Q.Promise<T> {
        return Q.ninvoke<T>(this._neovim, "eval", expression)
    }

    public command(command: string): Q.Promise<void> {
        return Q.ninvoke<void>(this._neovim, "command", command)
    }

    public getCurrentBuffer(): Q.Promise<IBuffer> {
        return this._sessionWrapper.invoke<any>("nvim_get_current_buf", [])
            .then((buf: any) => new Buffer(buf))
    }

    public getCurrentWindow(): Q.Promise<IWindow> {
        return this._sessionWrapper.invoke<any>("nvim_get_current_win", [])
            .then((win: any) => new Window(win))
    }

    public get cursorPosition(): IPosition {
        return {
            row: 0,
            column: 0,
        }
    }

    public screenToPixels(_row: number, _col: number): IPixelPosition {
        return {
            x: 0,
            y: 0,
        }
    }

    public input(inputString: string): Q.Promise<void> {
        return Q.ninvoke<void>(this._neovim, "input", inputString)
    }

    public resize(widthInPixels: number, heightInPixels: number): void {
        this._lastWidthInPixels = widthInPixels
        this._lastHeightInPixels = heightInPixels

        const size = this._getSize()

        this._resizeInternal(size.rows, size.cols)
    }

    private _resizeInternal(rows: number, columns: number): void {

        if (Config.hasValue("debug.fixedSize")) {
            const fixedSize = Config.getValue<any>("debug.fixedSize")
            rows = fixedSize.rows
            columns = fixedSize.columns
            console.warn("Overriding screen size based on debug.fixedSize")
        }

        if (rows === this._rows && columns === this._cols) {
            return
        }

        this._rows = rows
        this._cols = columns

        // If _initPromise isn't initialized, it means the UI hasn't attached to NeoVim
        // yet. In that case, we don't need to call uiTryResize
        if (!this._initPromise) {
            return
        }

        this._initPromise.then(() => {
            this._neovim.uiTryResize(columns, rows, (err?: Error) => {
                if (err) {
                    console.error(err)
                }
            })
        })
    }

    private _getSize() {
        const rows = Math.floor(this._lastHeightInPixels / this._fontHeightInPixels)
        const cols = Math.floor(this._lastWidthInPixels / this._fontWidthInPixels)
        return { rows, cols}
    }

    private _handleNotification(_method: any, args: any): void {
        args.forEach((a: any[]) => {
            const command = a[0]
            a.shift()

            if (command === "cursor_goto") {
                this.emit("action", Actions.createCursorGotoAction(a[0][0], a[0][1]))
            } else if (command === "put") {

                const charactersToPut = a.map((v) => v[0])
                this.emit("action", Actions.put(charactersToPut))
            } else if (command === "set_scroll_region") {
                const param = a[0]
                this.emit("action", Actions.setScrollRegion(param[0], param[1], param[2], param[3]))
            } else if (command === "scroll") {
                this.emit("action", Actions.scroll(a[0][0]))
            } else if (command === "highlight_set") {

                const count = a.length

                const highlightInfo = a[count - 1][0]

                this.emit("action", Actions.setHighlight(
                    !!highlightInfo.bold,
                    !!highlightInfo.italic,
                    !!highlightInfo.reverse,
                    !!highlightInfo.underline,
                    !!highlightInfo.undercurl,
                    highlightInfo.foreground,
                    highlightInfo.background,
                ))
            } else if (command === "resize") {
                this.emit("action", Actions.resize(a[0][0], a[0][1]))
            } else if (command === "eol_clear") {
                this.emit("action", Actions.clearToEndOfLine())
            } else if (command === "clear") {
                this.emit("action", Actions.clear())
            } else if (command === "mouse_on") {
                // TODO
            } else if (command === "update_bg") {
                this.emit("action", Actions.updateBackground(a[0][0]))
            } else if (command === "update_fg") {
                this.emit("action", Actions.updateForeground(a[0][0]))
            } else if (command === "mode_change") {
                const newMode = a[0][0]
                this.emit("action", Actions.changeMode(newMode))
                this.emit("mode-change", newMode)
            } else if (command === "popupmenu_show") {
                const completions = a[0][0]
                this.emit("show-popup-menu", completions)
            } else {
                console.warn("Unhandled command: " + command)
            }
        })
    }
}

const attachAsPromise = Q.denodeify(attach)

function startNeovim(runtimePaths: string[], args: any): Q.IPromise<any> {

    const nvimWindowsProcessPath = path.join(__dirname, "bin", "x86", "Neovim", "bin", "nvim.exe")
    const noopInitVimPath = path.join(__dirname, "vim", "noop.vim")

    // For Mac / Linux, assume there is a locally installed neovim
    const nvimMacProcessPath = "nvim"
    const nvimProcessPath = Platform.isWindows() ? nvimWindowsProcessPath : nvimMacProcessPath

    const joinedRuntimePaths = runtimePaths.join(",")

    const shouldLoadInitVim = Config.getValue<boolean>("oni.loadInitVim")
    const useDefaultConfig = Config.getValue<boolean>("oni.useDefaultConfig")

    const vimRcArg = (shouldLoadInitVim || !useDefaultConfig) ? [] : ["-u", noopInitVimPath]

    const argsToPass = vimRcArg
        .concat(["--cmd", "set rtp+=" + joinedRuntimePaths, "-N", "--embed", "--"])
        .concat(args)

    const nvimProc = cp.spawn(nvimProcessPath, argsToPass, {})

    return attachAsPromise(nvimProc.stdin, nvimProc.stdout)
}
