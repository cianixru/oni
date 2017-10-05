import * as React from "react"

import { keyEventToVimKey } from "./../Input/Keyboard"
import { focusManager } from "./../Services/FocusManager"
import { inputManager } from "./../Services/InputManager"
import * as WindowManager from "./../Services/WindowManager"

import { Background } from "./components/Background"
import { EditorWindows } from "./components/EditorWindows"
import { MenuContainer } from "./components/Menu"
import StatusBar from "./components/StatusBar"

interface IRootComponentProps {
    windowManager: WindowManager.WindowManager
}

export class RootComponent extends React.PureComponent<IRootComponentProps, void> {
    public render() {
        return <div className="stack disable-mouse" onKeyDownCapture={(evt) => this._onRootKeyDown(evt)}>
            <div className="stack">
                <Background />
            </div>
            <div className="stack">
                <div className="container vertical full">
                    <div className="container full">
                        <div className="stack">
                            <EditorWindows windowManager={this.props.windowManager} />
                        </div>
                        <div className="stack layer">
                            <MenuContainer />
                        </div>
                    </div>
                    <div className="container fixed layer">
                        <StatusBar />
                    </div>
                </div>
            </div>
        </div>
    }

    private _onRootKeyDown(evt: React.KeyboardEvent<HTMLElement>): void {
        const vimKey = keyEventToVimKey(evt.nativeEvent)
        if (inputManager.handleKey(vimKey)) {
            evt.stopPropagation()
            evt.preventDefault()
        } else {
            focusManager.enforceFocus()
        }
    }
}
