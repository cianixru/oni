/**
 * ExplorerSplit.tsx
 *
 */

import * as React from "react"
import * as DND from "react-dnd"
import HTML5Backend from "react-dnd-html5-backend"
import { connect } from "react-redux"
import { compose } from "redux"

// import { Transition, TransitionGroup } from "react-transition-group"

import { styled } from "./../../UI/components/common"
import { SidebarContainerView, SidebarItemView } from "./../../UI/components/SidebarItemView"
import { VimNavigator } from "./../../UI/components/VimNavigator"
import { DragAndDrop, Droppeable } from "./../DragAndDrop"

import { FileIcon } from "./../FileIcon"

import * as ExplorerSelectors from "./ExplorerSelectors"
import { IExplorerState } from "./ExplorerStore"

type Node = ExplorerSelectors.ExplorerNode

export interface INodeViewProps {
    moveFileOrFolder: (source: Node, dest: Node) => void
    node: ExplorerSelectors.ExplorerNode
    isSelected: boolean
    onClick: () => void
}

const NodeWrapper = styled.div`
    &:hover {
        text-decoration: underline;
    }
`

// tslint:disable-next-line
const noop = (elem: HTMLElement) => {}
const scrollIntoViewIfNeeded = (elem: HTMLElement) => {
    // tslint:disable-next-line
    elem && elem["scrollIntoViewIfNeeded"] && elem["scrollIntoViewIfNeeded"]()
}
const stopPropagation = (fn: () => void) => {
    return (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation()
        fn()
    }
}

const Types = {
    FILE: "FILE",
    FOLDER: "FOLDER",
}

interface IMoveNode {
    drop: {
        node: ExplorerSelectors.ExplorerNode
    }
    drag: {
        node: ExplorerSelectors.ExplorerNode
    }
}

export class NodeView extends React.PureComponent<INodeViewProps, {}> {
    public moveFileOrFolder = ({ drag, drop }: IMoveNode) => {
        this.props.moveFileOrFolder(drag.node, drop.node)
    }

    public isSameNode = ({ drag, drop }: IMoveNode) => {
        return !(drag.node.name === drop.node.name)
    }

    public render(): JSX.Element {
        return (
            <NodeWrapper
                style={{ cursor: "pointer" }}
                innerRef={this.props.isSelected ? scrollIntoViewIfNeeded : noop}
            >
                {this.getElement()}
            </NodeWrapper>
        )
    }

    public getElement(): JSX.Element {
        const { node } = this.props

        switch (node.type) {
            case "file":
                return (
                    <DragAndDrop
                        onDrop={this.moveFileOrFolder}
                        dragTarget={Types.FILE}
                        accepts={[Types.FILE, Types.FOLDER]}
                        isValidDrop={this.isSameNode}
                        node={node}
                        render={({ canDrop, isDragging, didDrop, isOver }) => {
                            return (
                                <SidebarItemView
                                    isOver={isOver && canDrop}
                                    didDrop={didDrop}
                                    canDrop={canDrop}
                                    onClick={stopPropagation(() => this.props.onClick())}
                                    text={node.name}
                                    isFocused={this.props.isSelected}
                                    isContainer={false}
                                    indentationLevel={node.indentationLevel}
                                    icon={<FileIcon fileName={node.name} isLarge={true} />}
                                />
                            )
                        }}
                    />
                )
            case "container":
                return (
                    <Droppeable
                        accepts={[Types.FILE, Types.FOLDER]}
                        onDrop={this.moveFileOrFolder}
                        isValidDrop={() => true}
                        render={({ isOver }) => {
                            return (
                                <SidebarContainerView
                                    isOver={isOver}
                                    isContainer={true}
                                    isExpanded={node.expanded}
                                    onClick={stopPropagation(() => this.props.onClick())}
                                    text={node.name}
                                    isFocused={this.props.isSelected}
                                />
                            )
                        }}
                    />
                )
            case "folder":
                return (
                    <DragAndDrop
                        accepts={[Types.FILE, Types.FOLDER]}
                        dragTarget={Types.FOLDER}
                        isValidDrop={this.isSameNode}
                        onDrop={this.moveFileOrFolder}
                        node={node}
                        render={({ isOver, didDrop, canDrop }) => {
                            return (
                                <SidebarContainerView
                                    didDrop={didDrop}
                                    isOver={isOver && canDrop}
                                    isContainer={false}
                                    isExpanded={node.expanded}
                                    text={node.name}
                                    isFocused={this.props.isSelected}
                                    indentationLevel={node.indentationLevel}
                                    onClick={stopPropagation(() => this.props.onClick())}
                                />
                            )
                        }}
                    />
                )
            default:
                return <div>{JSON.stringify(node)}</div>
        }
    }
}

export interface IExplorerViewContainerProps {
    moveFileOrFolder: (source: Node, dest: Node) => void
    onSelectionChanged: (id: string) => void
    onClick: (id: string) => void
}

export interface IExplorerViewProps extends IExplorerViewContainerProps {
    nodes: ExplorerSelectors.ExplorerNode[]
    isActive: boolean
}

import { SidebarEmptyPaneView } from "./../../UI/components/SidebarEmptyPaneView"

import { commandManager } from "./../CommandManager"

export class ExplorerView extends React.PureComponent<IExplorerViewProps, {}> {
    public render(): JSX.Element {
        const ids = this.props.nodes.map(node => node.id)

        if (!this.props.nodes || !this.props.nodes.length) {
            return (
                <SidebarEmptyPaneView
                    active={this.props.isActive}
                    contentsText="Nothing to show here, yet!"
                    actionButtonText="Open a Folder"
                    onClickButton={() => commandManager.executeCommand("workspace.openFolder")}
                />
            )
        }

        return (
            <VimNavigator
                ids={ids}
                active={this.props.isActive}
                onSelectionChanged={this.props.onSelectionChanged}
                onSelected={id => this.props.onClick(id)}
                render={(selectedId: string) => {
                    const nodes = this.props.nodes.map(node => (
                        <NodeView
                            moveFileOrFolder={this.props.moveFileOrFolder}
                            node={node}
                            isSelected={node.id === selectedId}
                            onClick={() => this.props.onClick(node.id)}
                        />
                    ))

                    return (
                        <div className="explorer enable-mouse">
                            <div className="items">{nodes}</div>
                        </div>
                    )
                }}
            />
        )
    }
}

const mapStateToProps = (
    state: IExplorerState,
    containerProps: IExplorerViewContainerProps,
): IExplorerViewProps => {
    return {
        ...containerProps,
        isActive: state.hasFocus,
        nodes: ExplorerSelectors.mapStateToNodeList(state),
    }
}

export const Explorer = compose(connect(mapStateToProps), DND.DragDropContext(HTML5Backend))(
    ExplorerView,
)
