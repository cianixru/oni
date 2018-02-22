/**
 * WindowSplits.tsx
 *
 * UI that hosts all the `Editor` instances
 */

import * as React from "react"

import { connect } from "react-redux"

import { WindowSplitHost } from "./WindowSplitHost"

import {
    IAugmentedSplitInfo,
    ISplitInfo,
    leftDockSelector,
    WindowManager,
    WindowState,
} from "./../../Services/WindowManager"

import { noop } from "./../../Utility"

export interface IWindowSplitsProps extends IWindowSplitsContainerProps {
    activeSplitId: string
    splitRoot: ISplitInfo<IAugmentedSplitInfo>
    leftDock: IAugmentedSplitInfo[]
}

export interface IWindowSplitsContainerProps {
    windowManager: WindowManager
}

export interface IDockProps {
    activeSplitId: string
    splits: IAugmentedSplitInfo[]
}

export class Dock extends React.PureComponent<IDockProps, {}> {
    public render(): JSX.Element {
        const docks = this.props.splits.map((s, i) => {
            return (
                <div style={{ display: "flex", flexDirection: "row" }} key={s.id}>
                    <WindowSplitHost
                        key={i}
                        containerClassName="split"
                        split={s}
                        isFocused={this.props.activeSplitId === s.id}
                        onClick={noop}
                    />
                    <div className="split-spacer vertical" />
                </div>
            )
        })

        return <div className="dock container fixed horizontal">{docks}</div>
    }
}

export interface IWindowSplitViewProps {
    activeSplitId: string
    split: ISplitInfo<IAugmentedSplitInfo>
    windowManager: WindowManager
}

export class WindowSplitView extends React.PureComponent<IWindowSplitViewProps, {}> {
    public render(): JSX.Element {
        const className =
            this.props.split.direction === "horizontal"
                ? "container horizontal full"
                : "container vertical full"
        const dividerClassName =
            this.props.split.direction === "horizontal"
                ? "split-spacer vertical"
                : "split-spacer horizontal"

        const splits = this.props.split.splits
        const editors = splits.map((splitNode, i) => {
            if (splitNode.type === "Split") {
                return (
                    <WindowSplitView
                        split={splitNode}
                        activeSplitId={this.props.activeSplitId}
                        windowManager={this.props.windowManager}
                    />
                )
            } else {
                const split: IAugmentedSplitInfo = splitNode.contents

                if (!split) {
                    return null
                } else {
                    const divider = i !== 0 ? <div className={dividerClassName} /> : null
                    return (
                        <div className={className}>
                            {divider}
                            <WindowSplitHost
                                containerClassName={"editor"}
                                key={i}
                                split={split}
                                isFocused={split.id === this.props.activeSplitId}
                                onClick={() => {
                                    this.props.windowManager.focusSplit(split.id)
                                }}
                            />
                        </div>
                    )
                }
            }
        })

        return <div className={className}>{editors}</div>
    }
}

export class WindowSplitsView extends React.PureComponent<IWindowSplitsProps, {}> {
    public render() {
        if (!this.props.splitRoot) {
            return null
        }

        const containerStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: "100%",
        }

        return (
            <div style={containerStyle}>
                <div className="container horizontal full">
                    <Dock splits={this.props.leftDock} activeSplitId={this.props.activeSplitId} />
                    <WindowSplitView
                        split={this.props.splitRoot}
                        windowManager={this.props.windowManager}
                        activeSplitId={this.props.activeSplitId}
                    />
                </div>
            </div>
        )
    }
}

const mapStateToProps = (
    state: WindowState,
    containerProps: IWindowSplitsContainerProps,
): IWindowSplitsProps => {
    return {
        ...containerProps,
        activeSplitId: state.focusedSplitId,
        leftDock: leftDockSelector(state),
        splitRoot: state.primarySplit,
    }
}

export const WindowSplits = connect(mapStateToProps)(WindowSplitsView)
