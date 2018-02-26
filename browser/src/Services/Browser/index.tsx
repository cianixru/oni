/**
 * oni-layer-browser/index.ts
 *
 * Entry point for browser integration plugin
 */

import { shell } from "electron"
import * as React from "react"
import styled from "styled-components"

import * as Oni from "oni-api"
import { Event, IDisposable, IEvent } from "oni-types"

import { CommandManager } from "./../CommandManager"
import { Configuration } from "./../Configuration"
import { EditorManager } from "./../EditorManager"

import { Icon, IconSize } from "./../../UI/Icon"

const Column = styled.div`
    pointer-events: auto;

    display: flex;
    flex-direction: column;

    width: 100%;
    height: 100%;
`

const BrowserControlsWrapper = styled.div`
    display: flex;
    flex-direction: row;
    flex: 0 0 auto;
    user-select: none;

    height: 3em;
    width: 100%;
    background-color: ${props => props.theme["editor.background"]};
    color: ${props => props.theme["editor.foreground"]};
`

const BrowserViewWrapper = styled.div`
    flex: 1 1 auto;

    width: 100%;
    height: 100%;
    position: relative;

    webview {
        height: 100%;
        width: 100%;
    }
`

const BrowserButton = styled.div`
    width: 2.5em;
    height: 2.5em;
    flex: 0 0 auto;
    opacity: 0.9;

    display: flex;
    justify-content: center;
    align-items: center;

    &:hover {
        opacity: 1;
        box-shadow: 0 -8px 20px 0 rgba(0, 0, 0, 0.2);
    }
`

const AddressBar = styled.div`
    width: 100%;
    flex: 1 1 auto;

    height: 2.5em;
    line-height: 2.5em;

    text-align: left;
`

export class BrowserLayer implements Oni.BufferLayer {
    private _goBackEvent = new Event<void>()
    private _goForwardEvent = new Event<void>()
    private _reloadEvent = new Event<void>()

    constructor(private _url: string) {}

    public get id(): string {
        return "oni.browser"
    }

    public render(): JSX.Element {
        return (
            <BrowserView
                url={this._url}
                goBack={this._goBackEvent}
                goForward={this._goForwardEvent}
                reload={this._reloadEvent}
            />
        )
    }

    public goBack(): void {
        this._goBackEvent.dispatch()
    }

    public goForward(): void {
        this._goForwardEvent.dispatch()
    }

    public reload(): void {
        this._reloadEvent.dispatch()
    }
}

export interface IBrowserViewProps {
    url: string

    goBack: IEvent<void>
    goForward: IEvent<void>
    reload: IEvent<void>
}

export class BrowserView extends React.PureComponent<IBrowserViewProps, {}> {
    private _webviewElement: any
    private _disposables: IDisposable[] = []

    public componentDidMount(): void {
        const d1 = this.props.goBack.subscribe(() => this._goBack())
        const d2 = this.props.goForward.subscribe(() => this._goForward())
        const d3 = this.props.reload.subscribe(() => this._reload())

        this._disposables = this._disposables.concat([d1, d2, d3])
    }

    public componentWillUnmount(): void {
        this._webviewElement = null
        this._disposables.forEach(d => d.dispose())
        this._disposables = []
    }

    public render(): JSX.Element {
        return (
            <Column key={"test2"}>
                <BrowserControlsWrapper>
                    <BrowserButton onClick={() => this._goBack()}>
                        <Icon name="chevron-left" size={IconSize.Large} />
                    </BrowserButton>
                    <BrowserButton onClick={() => this._goForward()}>
                        <Icon name="chevron-right" size={IconSize.Large} />
                    </BrowserButton>
                    <BrowserButton onClick={() => this._reload()}>
                        <Icon name="undo" size={IconSize.Large} />
                    </BrowserButton>
                    <AddressBar>
                        <span>{this.props.url}</span>
                    </AddressBar>
                    <BrowserButton>
                        <Icon name="bug" size={IconSize.Large} />
                    </BrowserButton>
                </BrowserControlsWrapper>
                <BrowserViewWrapper>
                    <div
                        ref={elem => this._initializeElement(elem)}
                        style={{
                            position: "absolute",
                            top: "0px",
                            left: "0px",
                            right: "0px",
                            bottom: "0px",
                        }}
                        key={"test"}
                    />
                </BrowserViewWrapper>
            </Column>
        )
    }

    private _goBack(): void {
        if (this._webviewElement) {
            this._webviewElement.goBack()
        }
    }

    private _goForward(): void {
        if (this._webviewElement) {
            this._webviewElement.goForward()
        }
    }

    private _reload(): void {
        if (this._webviewElement) {
            this._webviewElement.reload()
        }
    }

    private _initializeElement(elem: HTMLElement) {
        if (elem && !this._webviewElement) {
            const webviewElement = document.createElement("webview")
            elem.appendChild(webviewElement)
            this._webviewElement = webviewElement
            this._webviewElement.src = this.props.url
        }
    }
}

export const activate = (
    commandManager: CommandManager,
    configuration: Configuration,
    editorManager: EditorManager,
) => {
    let count = 0

    const activeLayers: { [bufferId: string]: BrowserLayer } = {}

    const openUrl = async (url: string) => {
        if (configuration.getValue("experimental.browser.enabled")) {
            count++
            const buffer: Oni.Buffer = await (editorManager.activeEditor as any).newFile(
                "Browser" + count.toString(),
            )

            const layer = new BrowserLayer(url)
            buffer.addLayer(layer)
            activeLayers[buffer.id] = layer
        } else {
            shell.openExternal(url)
        }
    }

    commandManager.registerCommand({
        command: "browser.openUrl",
        execute: openUrl,
        name: null,
        detail: null,
    })

    const executeCommandForLayer = (callback: (browserLayer: BrowserLayer) => void) => () => {
        const activeBuffer = editorManager.activeEditor.activeBuffer

        const browserLayer = activeLayers[activeBuffer.id]
        if (browserLayer) {
            callback(browserLayer)
        }
    }

    const isBrowserLayerActive = () =>
        !!activeLayers[editorManager.activeEditor.activeBuffer.id] &&
        !!configuration.getValue("experimental.browser.enabled")

    // Per-layer commands
    commandManager.registerCommand({
        command: "browser.goBack",
        execute: executeCommandForLayer(browser => browser.goBack()),
        name: "Browser: Go back",
        detail: "",
        enabled: isBrowserLayerActive,
    })

    commandManager.registerCommand({
        command: "browser.goForward",
        execute: executeCommandForLayer(browser => browser.goForward()),
        name: "Browser: Go forward",
        detail: "",
        enabled: isBrowserLayerActive,
    })

    commandManager.registerCommand({
        command: "browser.reload",
        execute: executeCommandForLayer(browser => browser.reload()),
        name: "Browser: Reload",
        detail: "",
        enabled: isBrowserLayerActive,
    })
}
