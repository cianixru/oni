/**
 * WindowTitle.tsx
 *
 * Renders the title bar (OSX only)
 */

import * as React from "react"

import { connect } from "react-redux"

import * as State from "./../State"

export interface IWindowTitleViewProps {
    visible: boolean
    title: string
    backgroundColor: string
    foregroundColor: string
}

export class WindowTitleView extends React.PureComponent<IWindowTitleViewProps, {}> {

    public render(): null | JSX.Element {

        if (!this.props.visible) {
            return null
        }

        const style = {
            height: "22px",
            lineHeight: "22px",
            zoom: 1, // Don't allow this to be impacted by zoom
            backgroundColor: this.props.backgroundColor,
            color: this.props.foregroundColor,
            textAlign: "center",
            "-webkit-app-region": "drag",
            "-webkit-user-select": "none",
        }

        return <div style={style}>{this.props.title}</div>
    }
}

export interface IWindowTitleProps {
    visible: boolean
}

export const mapStateToProps = (state: State.IState, props: IWindowTitleProps): IWindowTitleViewProps => {
    return {
        ...props,
        title: state.windowTitle,
        backgroundColor: state.colors["title.background"],
        foregroundColor: state.colors["title.foreground"],
    }
}

export const WindowTitle = connect(mapStateToProps)(WindowTitleView)
