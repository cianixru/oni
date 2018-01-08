/**
 * NeovimLayersView.tsx
 *
 * Renders layers above vim windows
 */

import * as React from "react"
import { connect } from "react-redux"

import * as Oni from "oni-api"

import { NeovimActiveWindow } from "./NeovimActiveWindow"

import * as State from "./NeovimEditorStore"

import { EmptyArray } from "./../../Utility"

export interface NeovimLayersViewProps {
    activeWindowId: number
    windows: State.IWindow[]
    layers: State.Layers
}

export class NeovimLayersView extends React.PureComponent<NeovimLayersViewProps, {}> {
    public render(): JSX.Element {

        const containers = this.props.windows.map((windowState) => {
            const layers = this.props.layers[windowState.bufferId] || (EmptyArray as Oni.EditorLayer[])

            const layerContext = {
                isActive: windowState.windowId === this.props.activeWindowId,
                windowId: windowState.windowId,

                bufferToScreen: windowState.bufferToScreen,
                screenToPixel: windowState.screenToPixel,
                dimensions: windowState.dimensions,
            }

            const layerElements = layers.map((l) => {
                return l.render(layerContext)
            })

            const dimensions = getWindowPixelDimensions(windowState)

            return <NeovimActiveWindow {...dimensions}>
                    {layerElements}
                </NeovimActiveWindow>
        })

        return <div className="stack layer">
                    {containers}
                </div>
    }
}

const getWindowPixelDimensions = (win: State.IWindow) => {
    const start = win.screenToPixel({
        screenX: win.dimensions.x,
        screenY: win.dimensions.y,
    })

    const size = win.screenToPixel({
        screenX: win.dimensions.width,
        screenY: win.dimensions.height,
    })

    return {
        pixelX: start.pixelX,
        pixelY: start.pixelY,
        pixelWidth: size.pixelX,
        pixelHeight: size.pixelY,
    }
}

const mapStateToProps = (state: State.IState): NeovimLayersViewProps => {
    if (!state.activeVimTabPage) {
        return {
            activeWindowId: -1,
            layers: {},
            windows: [],
        }
    }

    const windows = state.activeVimTabPage.windowIds.map((windowId) => {
        return state.windowState.windows[windowId]
    })

    return {
        activeWindowId: state.windowState.activeWindow,
        windows,
        layers: state.layers,
    }
}

export const NeovimLayers = connect(mapStateToProps)(NeovimLayersView)
