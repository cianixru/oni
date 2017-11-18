/**
 * NeovimSurface.tsx
 *
 * UI layer for the Neovim editor surface
 */

import * as React from "react"

import { NeovimInstance } from "./../neovim"
import { INeovimRenderer } from "./../Renderer"
import { NeovimScreen } from "./../Screen"

import { ActiveWindowContainer } from "./../UI/components/ActiveWindow"
import { Cursor } from "./../UI/components/Cursor"
import { CursorLine } from "./../UI/components/CursorLine"
import { InstallHelp } from "./../UI/components/InstallHelp"
import { TabsContainer } from "./../UI/components/Tabs"
import { ToolTips } from "./../UI/components/ToolTip"
import { TypingPrediction } from "./../UI/components/TypingPredictions"

import { BufferScrollBarContainer } from "./../UI/containers/BufferScrollBarContainer"
import { DefinitionContainer } from "./../UI/containers/DefinitionContainer"
import { ErrorsContainer } from "./../UI/containers/ErrorsContainer"

import { TypingPredictionManager } from "./../Services/TypingPredictionManager"

import { NeovimInput } from "./NeovimInput"
import { NeovimRenderer } from "./NeovimRenderer"

export interface INeovimSurfaceProps {
    neovimInstance: NeovimInstance
    renderer: INeovimRenderer
    screen: NeovimScreen
    typingPrediction: TypingPredictionManager

    onKeyDown?: (key: string) => void
    onBufferClose?: (bufferId: number) => void
    onBufferSelect?: (bufferId: number) => void
    onTabClose?: (tabId: number) => void
    onTabSelect?: (tabId: number) => void
}

export class NeovimSurface extends React.PureComponent<INeovimSurfaceProps, {}> {
    public render(): JSX.Element {
        return <div className="container vertical full">
            <div className="container fixed">
                <TabsContainer
                    onBufferSelect={this.props.onBufferSelect}
                    onBufferClose={this.props.onBufferClose}
                    onTabClose={this.props.onTabClose}
                    onTabSelect={this.props.onTabSelect}/>
            </div>
            <div className="container full">
                <div className="stack">
                    <NeovimRenderer renderer={this.props.renderer}
                        neovimInstance={this.props.neovimInstance}
                        screen={this.props.screen} />
                </div>
                <div className="stack layer">
                    <TypingPrediction typingPrediction={this.props.typingPrediction}/>
                    <Cursor typingPrediction={this.props.typingPrediction}/>
                    <CursorLine lineType={"line"} />
                    <CursorLine lineType={"column"} />
                    <ActiveWindowContainer>
                        <DefinitionContainer />
                        <ErrorsContainer />
                        <BufferScrollBarContainer />
                    </ActiveWindowContainer>
                </div>
                <NeovimInput
                    typingPrediction={this.props.typingPrediction}
                    neovimInstance={this.props.neovimInstance}
                    screen={this.props.screen}
                    onKeyDown={this.props.onKeyDown}/>
                <div className="stack layer">
                    <ToolTips />
                </div>
                <InstallHelp />
            </div>
        </div>
    }
}
