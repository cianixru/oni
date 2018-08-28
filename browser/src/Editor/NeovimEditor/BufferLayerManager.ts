/**
 * BufferLayerManager.ts
 *
 * BufferLayerManager tracks the lifecycle of 'buffer layers'
 */

import * as Oni from "oni-api"

export type BufferLayerFactory = (buf: Oni.Buffer) => Oni.BufferLayer
export type BufferFilter = (buf: Oni.Buffer) => boolean

export interface IBufferLayer extends Oni.BufferLayer {
    handleInput?: (key: string) => boolean
    isActive?: () => boolean
}

export const createBufferFilterFromLanguage = (language: string) => (buf: Oni.Buffer): boolean => {
    if (!language || language === "*") {
        return true
    } else {
        return buf.language === language
    }
}

export interface BufferLayerInfo {
    filter: BufferFilter
    layerFactory: BufferLayerFactory
}

export class BufferLayerManager {
    private _layers: BufferLayerInfo[] = []

    private _buffers: Oni.Buffer[] = []
    public addBufferLayer(
        filterOrLanguage: BufferFilter | string,
        layerFactory: BufferLayerFactory,
    ) {
        const filter: BufferFilter =
            typeof filterOrLanguage === "string"
                ? createBufferFilterFromLanguage(filterOrLanguage)
                : filterOrLanguage

        this._layers.push({
            filter,
            layerFactory,
        })

        this._buffers.forEach(buf => {
            if (filter(buf)) {
                buf.addLayer(layerFactory(buf))
            }
        })
    }

    public notifyBufferEnter(buf: Oni.Buffer): void {
        if (this._buffers.indexOf(buf) === -1) {
            this._buffers.push(buf)

            this._layers.forEach(layerInfo => {
                if (layerInfo.filter(buf)) {
                    buf.addLayer(layerInfo.layerFactory(buf))
                }
            })
        }
    }

    public notifyBufferFileTypeChanged(buf: Oni.Buffer): void {
        this._buffers = this._buffers.filter(b => b.id !== buf.id)
        this.notifyBufferEnter(buf)
    }
}

const getInstance = (() => {
    const instance = new BufferLayerManager()
    return () => instance
})()

export default getInstance

export const wrapReactComponentWithLayer = (
    id: string,
    component: JSX.Element,
): Oni.BufferLayer => {
    return {
        id,
        render: (context: Oni.BufferLayerRenderContext) => (context.isActive ? component : null),
    }
}
