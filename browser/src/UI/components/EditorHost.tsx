/**
 * EditorHost.tsx
 *
 * React component that hosts an IEditor implementation
 */

import * as React from "react"

import { IEditor } from "./../../Editor/Editor"

export interface IEditorHostProps {
    editor: IEditor
}

export class EditorHost extends React.Component<IEditorHostProps, void> {

    public render(): JSX.Element {
        return <div className="editor">
            {this.props.editor.render()}
        </div>
    }
}
