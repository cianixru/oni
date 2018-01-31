/**
 * Notification.ts
 *
 * API interface for notification UX
 */

import { Store } from "redux"

import { Event, IEvent } from "oni-types"

import { INotificationsState, NotificationLevel } from "./NotificationStore"

export class Notification {
    private _title: string = ""
    private _detail: string = ""
    private _level: NotificationLevel = "info"

    private _onClickEvent = new Event<void>()
    private _onCloseEvent = new Event<void>()

    public get onClick(): IEvent<void> {
        return this._onClickEvent
    }

    public get onClose(): IEvent<void> {
        return this._onCloseEvent
    }

    constructor(private _id: string, private _store: Store<INotificationsState>) {}

    public setContents(title: string, detail: string): void {
        this._title = title
        this._detail = detail
    }

    public setLevel(level: NotificationLevel): void {
        this._level = level
    }

    public show(): void {
        this._store.dispatch({
            type: "SHOW_NOTIFICATION",
            id: this._id,
            title: this._title,
            detail: this._detail,
            level: this._level,
            onClick: () => {
                this._onClickEvent.dispatch()
                this.hide()
            },
            onClose: () => {
                this._onCloseEvent.dispatch()
                this.hide()
            },
        })
    }

    public hide(): void {
        this._store.dispatch({
            type: "HIDE_NOTIFICATION",
            id: this._id,
        })
    }
}
