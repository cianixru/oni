import * as React from "react"

import { AutoCompletionContainer } from "./components/AutoCompletion"
import { Background } from "./components/Background"
import { Cursor } from "./components/Cursor"
import { CursorLine } from "./components/CursorLine"
import { EditorHost } from "./components/EditorHost"
import { Logs } from "./components/Logs"
import { MenuContainer } from "./components/Menu"
import { QuickInfoContainer, SignatureHelpContainer } from "./components/QuickInfo"
import StatusBar from "./components/StatusBar"

import { IEditor } from "./../Editor/Editor"

interface IRootComponentProps {
    editor: IEditor
}

export class RootComponent extends React.Component<IRootComponentProps, void> {
    public render() {

        return <div className="stack">
            <div className="stack">
                <Background />
            </div>
            <div className="stack">
                <div className="container vertical full">
                    <div className="container full">
                        <div className="stack layer">
                            <EditorHost editor={this.props.editor} />
                        </div>
                        <div className="stack layer">
                            <Cursor />
                            <CursorLine lineType={"line"} />
                            <CursorLine lineType={"column"} />
                            <QuickInfoContainer />
                            <SignatureHelpContainer />
                            <AutoCompletionContainer />
                            <Logs />
                            <MenuContainer />
                        </div>
                    </div>
                    <div className="container fixed">
                        <StatusBar />
                    </div>
                </div>
            </div>
        </div>
    }
}
