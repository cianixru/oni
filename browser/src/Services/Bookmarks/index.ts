import { Event, IEvent } from "oni-types"

import { Configuration } from "./../Configuration"
import { SidebarManager } from "./../Sidebar"

import { BookmarksPane } from "./BookmarksPane"

export interface IBookmark {
    command: string
    arguments: any[]
    group: string
}

import * as fs from "fs"
import * as Log from "./../../Log"

export interface IBookmarksProvider {
    bookmarks: IBookmark[]
    onBookmarksUpdated: IEvent<void>
}

export class ConfigurationBookmarksProvider implements IBookmarksProvider {
    private _bookmarks: IBookmark[] = []
    private _onBookmarksUpdatedEvent = new Event<void>()

    public get bookmarks(): IBookmark[] {
        return this._bookmarks
    }

    public get onBookmarksUpdated(): IEvent<void> {
        return this._onBookmarksUpdatedEvent
    }

    constructor(private _configuration: Configuration) {
        this._configuration.onConfigurationChanged.subscribe(newValues => {
            if (newValues["oni.bookmarks"]) {
                this._updateFromConfiguration(newValues["oni.bookmarks"])
            }
        })

        const currentBookmarks = this._configuration.getValue("oni.bookmarks")
        this._updateFromConfiguration(currentBookmarks)
    }

    private _updateBookmarks(bookmarks: IBookmark[]): void {
        this._bookmarks = bookmarks
        this._onBookmarksUpdatedEvent.dispatch()
    }

    private _updateFromConfiguration(bookmarks: string[]): void {
        if (!bookmarks || !bookmarks.length) {
            this._updateBookmarks([])
            return
        }

        try {
            const newBookmarks = bookmarks.filter(bm => fs.existsSync(bm)).map(bm => {
                const stat = fs.statSync(bm)

                if (stat.isDirectory()) {
                    return {
                        command: "oni.openFolder",
                        arguments: [bm],
                        group: "Workspaces",
                    }
                } else {
                    return {
                        command: "oni.openFile",
                        arguments: [bm],
                        group: "Files",
                    }
                }
            })

            this._updateBookmarks(newBookmarks)
        } catch (e) {
            Log.warn("Error loading bookmarks: " + e)
        }
    }
}

let _bookmarks: IBookmarksProvider

export const activate = (configuration: Configuration, sidebarManager: SidebarManager) => {
    _bookmarks = new ConfigurationBookmarksProvider(configuration)

    sidebarManager.add("bookmark", new BookmarksPane(_bookmarks))
}

export const getInstance = (): IBookmarksProvider => _bookmarks
