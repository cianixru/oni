import { execSync } from "child_process"
import * as path from "path"
import * as State from "./State"

import * as Fuse from "fuse.js"

import * as Log from "./../Log"
import * as Actions from "./Actions"

import { configuration, IConfigurationValues } from "./../Services/Configuration"

import * as pick from "lodash/pick"
import * as sortBy from "lodash/sortBy"

import * as types from "vscode-languageserver-types"

export function reducer<K extends keyof IConfigurationValues>(s: State.IState, a: Actions.Action<K>) {

    if (!s) {
        return s
    }

    switch (a.type) {
        case "SET_CURSOR_POSITION":
            return {...s,
                    cursorPixelX: a.payload.pixelX,
                    cursorPixelY: a.payload.pixelY,
                    fontPixelWidth: a.payload.fontPixelWidth,
                    fontPixelHeight: a.payload.fontPixelHeight,
                    cursorCharacter: a.payload.cursorCharacter,
                    cursorPixelWidth: a.payload.cursorPixelWidth }
        case "SET_IME_ACTIVE":
            return { ...s,
                     imeActive: a.payload.imeActive }
        case "SET_FONT":
            return { ...s,
                     fontFamily: a.payload.fontFamily,
                     fontSize: a.payload.fontSize }
        case "SET_MODE":
            return { ...s, ...{ mode: a.payload.mode } }
        case "SET_COLORS":
            return { ...s, ...{
                foregroundColor: a.payload.foregroundColor,
                backgroundColor: a.payload.backgroundColor,
            } }
        case "SHOW_QUICK_INFO":
            return {...s,
                    quickInfo: {
                    title: a.payload.title,
                    description: a.payload.description,
                }}
        case "HIDE_QUICK_INFO":
            return {...s,
                    quickInfo: null}
        case "SHOW_AUTO_COMPLETION":
            return {...s,
                    autoCompletion: {
                    base: a.payload.base,
                    entries: a.payload.entries,
                    selectedIndex: 0,
                }}
        case "HIDE_AUTO_COMPLETION":
            return {...s,
                    autoCompletion: null}
        case "SHOW_SIGNATURE_HELP":
            return {...s,
                    signatureHelp: a.payload}
        case "HIDE_SIGNATURE_HELP":
            return {...s,
                    signatureHelp: null}
         case "HIDE_CURSOR_LINE":
             return {...s,
                     cursorLineVisible: false}
         case "HIDE_CURSOR_COLUMN":
             return {...s,
                     cursorColumnVisible: false}
         case "SHOW_CURSOR_LINE":
             return {...s,
                     cursorLineVisible: true}
         case "SHOW_CURSOR_COLUMN":
             return {...s,
                     cursorColumnVisible: true}
        case "SET_CONFIGURATION_VALUE":
            const obj: Partial<IConfigurationValues> = {}
            obj[a.payload.key] = a.payload.value
            const newConfig = {...s.configuration, ...obj}
            return {...s,
                    configuration: newConfig}
        case "SHOW_MESSAGE_DIALOG":
            return {
                ...s,
                activeMessageDialog: a.payload,
            }
        case "HIDE_MESSAGE_DIALOG":
            return {
                ...s,
                activeMessageDialog: null,
            }
        default:
            return {...s,
                    buffers: buffersReducer(s.buffers, a),
                    tabState: tabStateReducer(s.tabState, a),
                    errors: errorsReducer(s.errors, a),
                    autoCompletion: autoCompletionReducer(s.autoCompletion, a), // FIXME: null
                    popupMenu: popupMenuReducer(s.popupMenu, a), // FIXME: null
                    statusBar: statusBarReducer(s.statusBar, a),
                    windowState: windowStateReducer(s.windowState, a)}
    }
}

export const tabStateReducer = (s: State.ITabState, a: Actions.SimpleAction): State.ITabState => {
    switch (a.type) {
        case "SET_TABS":
            return {
                ...s,
                ...a.payload,
            }
        default:
            return s
    }
}

export const buffersReducer = (s: State.IBufferState, a: Actions.SimpleAction): State.IBufferState => {

    let byId = s.byId
    let allIds = s.allIds

    const emptyBuffer = (id: number): State.IBuffer => ({
        id,
        file: null,
        modified: false,
        hidden: true,
        listed: false,
        totalLines: 0,
    })

    switch (a.type) {
        case "BUFFER_ENTER":
            byId = {
                ...s.byId,
                [a.payload.id]: {
                    id: a.payload.id,
                    file: a.payload.file,
                    totalLines: a.payload.totalLines,
                    hidden: a.payload.hidden,
                    listed: a.payload.listed,
                    modified: false,
                },
            }

            if (allIds.indexOf(a.payload.id) === -1) {
                allIds = [...s.allIds, a.payload.id]
            }

            return {
                activeBufferId: a.payload.id,
                byId,
                allIds,
            }
        case "BUFFER_SAVE":
            const currentItem = s.byId[a.payload.id] || emptyBuffer(a.payload.id)
            byId = {
                ...s.byId,
                [a.payload.id]: {
                    ...currentItem,
                    id: a.payload.id,
                    modified: a.payload.modified,
                    lastSaveVersion: a.payload.version,
                },
            }

            return {
                ...s,
                byId,
            }
        case "BUFFER_UPDATE":
            const currentItem3 = s.byId[a.payload.id] || emptyBuffer(a.payload.id)

            // If the last save version hasn't been set, this means it is the first update,
            // and should clamp to the incoming version
            const lastSaveVersion = currentItem3.lastSaveVersion || a.payload.version

            byId = {
                ...s.byId,
                [a.payload.id]: {
                    ...currentItem3,
                    id: a.payload.id,
                    modified: a.payload.modified,
                    version: a.payload.version,
                    totalLines: a.payload.totalLines,
                    lastSaveVersion,
                },
            }

            return {
                ...s,
                byId,
            }
        case "SET_CURRENT_BUFFERS":
            allIds = s.allIds.filter((id) => a.payload.bufferIds.indexOf(id) >= 0)

            let activeBufferId = s.activeBufferId

            if (a.payload.bufferIds.indexOf(activeBufferId) === -1) {
                activeBufferId = null
            }

            const newById: any = pick(s.byId, a.payload.bufferIds)

            return {
                activeBufferId,
                byId: newById,
                allIds,
            }
        default:
            return s
    }
}

export const errorsReducer = (s: { [file: string]: { [key: string]: types.Diagnostic[] } }, a: Actions.SimpleAction) => {
    switch (a.type) {
        case "SET_ERRORS":

            const currentFile = s[a.payload.file] || null

            return {
                ...s,
                [a.payload.file]: {
                    ...currentFile,
                    [a.payload.key]: [...a.payload.errors],
                },
            }
        default:
            return s
    }
}

export const statusBarReducer = (s: { [key: string]: State.IStatusBarItem }, a: Actions.SimpleAction) => {
    switch (a.type) {
        case "STATUSBAR_SHOW":
            const existingItem = s[a.payload.id] || {}
            const newItem = {
                ...existingItem,
                ...a.payload,
            }

            return {
                ...s,
                [a.payload.id]: newItem,
            }
        case "STATUSBAR_HIDE":
            return {
                ...s,
                [a.payload.id]: null,
            }
        default:
            return s
    }
}

export function popupMenuReducer(s: State.IMenu | null, a: Actions.SimpleAction) {

    // TODO: sync max display items (10) with value in Menu.render() (Menu.tsx)
    const size = s ? Math.min(10, s.filteredOptions.length) : 0

    switch (a.type) {
        case "SHOW_MENU":
            const sortedOptions = sortBy(a.payload.options, (f) => f.pinned ? 0 : 1).map((o) => ({
                icon: o.icon,
                detail: o.detail,
                label: o.label,
                pinned: o.pinned,
                detailHighlights: [],
                labelHighlights: [],
            }))

            return {
                id: a.payload.id,
                filter: "",
                filteredOptions: sortedOptions,
                options: a.payload.options,
                selectedIndex: 0,
            }
        case "HIDE_MENU":
            return null
        case "NEXT_MENU":
            if (!s) {
                return s
            }

            return {...s,
                    selectedIndex: (s.selectedIndex + 1) % size}
        case "PREVIOUS_MENU":
            if (!s) {
                return s
            }

            return {...s,
                    selectedIndex: s.selectedIndex > 0 ? s.selectedIndex - 1 : size - 1}
        case "FILTER_MENU":
            if (!s) {
                return s
            }

            // If we already had search results, and this search is a superset of the previous,
            // just filter the already-pruned subset
            const optionsToSearch = a.payload.filter.indexOf(s.filter) === 0 ? s.filteredOptions : s.options
            const filteredOptionsSorted = filterMenuOptions(optionsToSearch, a.payload.filter, s.id)

            return {...s,
                    filter: a.payload.filter,
                    filteredOptions: filteredOptionsSorted}
        default:
            return s
    }
}

export function filterMenuOptions(options: Oni.Menu.MenuOption[], searchString: string, id: string): State.IMenuOptionWithHighlights[] {

    // if filtering files (not tasks) and overriddenCommand defined
    if (id === "quickOpen") {
        const overriddenCommand = configuration.getValue("editor.quickOpen.execCommand")
        if (overriddenCommand) {
            try {
                const files = execSync(overriddenCommand.replace("${search}", searchString), { cwd: process.cwd() }) // tslint:disable-line no-invalid-template-strings
                    .toString("utf8")
                    .split("\n")
                const opt: State.IMenuOptionWithHighlights[]  = files.map((untrimmedFile) => {
                    const f = untrimmedFile.trim()
                    const file = path.basename(f)
                    const folder = path.dirname(f)
                    return {
                        icon: "file-text-o",
                        label: file,
                        detail: folder,
                        pinned: false,
                        detailHighlights: [],
                        labelHighlights: [],
                    }
                })
                return opt
            } catch (e) {
                Log.warn(`'${overriddenCommand}' returned an error: ${e.message}\nUsing default filtering`)
            }
        }
    }

    if (!searchString) {
        const opt = options.map((o) => {
            return {
                label: o.label,
                detail: o.detail,
                icon: o.icon,
                pinned: o.pinned,
                detailHighlights: [],
                labelHighlights: [],
            }
        })

        return sortBy(opt, (o) => o.pinned ? 0 : 1)
    }

    const fuseOptions = {
        keys: [{
            name: "label",
            weight: 0.6,
        }, {
            name: "detail",
            weight: 0.4,
        }],
        include: ["matches"],
    }

    // remove duplicate characters
    const searchSet = new Set(searchString)

    // remove any items that don't have all the characters from searchString
    const filteredOptions = options.filter((o) => {

        if (!o.label && !o.detail) {
            return false
        }

        const combined = o.label + o.detail

        for (const c of searchSet) {
            if (combined.indexOf(c) === -1) {
                return false
            }
        }

        return true
    })

    const fuse = new Fuse(filteredOptions, fuseOptions)
    const results = fuse.search(searchString)

    const highlightOptions = results.map((f: any) => {
        let labelHighlights: number[][] = []
        let detailHighlights: number[][] = []
        // matches will have 1 or 2 items depending on
        // whether one or both (label and detail) matched
        f.matches.forEach((obj: any) => {
            if (obj.key === "label") {
                labelHighlights = obj.indices
            } else {
                detailHighlights = obj.indices
            }
        })

        return {
            icon: f.item.icon,
            pinned: f.item.pinned,
            label: f.item.label,
            detail: f.item.detail,
            labelHighlights,
            detailHighlights,
        }
    })

    return highlightOptions
}

export const windowStateReducer = (s: State.IWindowState, a: Actions.SimpleAction): State.IWindowState => {

    let currentWindow
    switch (a.type) {
        case "SET_WINDOW_STATE":
            currentWindow = s.windows[a.payload.windowId] || null

            return {
                activeWindow: a.payload.windowId,
                windows: {
                    ...s.windows,
                    [a.payload.windowId]: {
                        ...currentWindow,
                        file: a.payload.file,
                        column: a.payload.column,
                        line: a.payload.line,
                        winline: a.payload.winline,
                        wincolumn: a.payload.wincolumn,
                        windowBottomLine: a.payload.windowBottomLine,
                        windowTopLine: a.payload.windowTopLine,
                    },
                },
            }
        case "SET_WINDOW_DIMENSIONS":
            currentWindow = s.windows[a.payload.windowId] || null

            return {
                ...s,
                windows: {
                    ...s.windows,
                    [a.payload.windowId]: {
                        ...currentWindow,
                        dimensions: a.payload.dimensions,
                    },
                },
            }
        case "SET_WINDOW_LINE_MAP":
            currentWindow = s.windows[a.payload.windowId] || null

            return {
                ...s,
                windows: {
                    ...s.windows,
                    [a.payload.windowId]: {
                        ...currentWindow,
                        lineMapping: a.payload.lineMapping,
                    },
                },
            }
        default:
            return s
    }
}

export function autoCompletionReducer(s: State.IAutoCompletionInfo | null, a: Actions.SimpleAction) {
    if (!s) {
        return s
    }

    // TODO: sync max display items (10) with value in AutoCompletion.render() (AutoCompletion.tsx)
    const currentEntryCount = Math.min(10, s.entries.length)

    switch (a.type) {
        case "NEXT_AUTO_COMPLETION":
            return {...s,
                    selectedIndex: (s.selectedIndex + 1) % currentEntryCount}
        case "PREVIOUS_AUTO_COMPLETION":
            return {...s,
                    selectedIndex: s.selectedIndex > 0 ? s.selectedIndex - 1 : currentEntryCount - 1}
        default:
            return {...s,
                    entries: autoCompletionEntryReducer(s.entries, a)}
    }
}

export function autoCompletionEntryReducer(s: Oni.Plugin.CompletionInfo[], action: Actions.SimpleAction) {
    switch (action.type) {
        case "SET_AUTO_COMPLETION_DETAILS":
            return s.map((entry) => {
                if (action.payload.detailedEntry && entry.label === action.payload.detailedEntry.label) {
                    return action.payload.detailedEntry
                }
                return entry
            })
        default:
            return s
    }
}
