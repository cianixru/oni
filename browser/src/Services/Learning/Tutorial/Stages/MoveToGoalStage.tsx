/**
 * TutorialManager
 */

import * as Oni from "oni-api"
import * as React from "react"

import * as types from "vscode-languageserver-types"

import styled, { keyframes } from "styled-components"

import { ITutorialContext, ITutorialStage } from "./../ITutorial"

const SpinnerKeyFrames = keyframes`
    0% {transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
`

const TopArrow = styled.div`
    animation: ${SpinnerKeyFrames} 2s linear infinite;
    border-top: 6px solid white;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-bottom: 3px solid transparent;
    opacity: 0.8;
`

const BottomArrow = styled.div`
    animation: ${SpinnerKeyFrames} 2s linear infinite;
    margin-top: 2px;
    border-top: 3px solid transparent;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-bottom: 6px solid white;
    opacity: 0.8;
`
export class MoveToGoalStage implements ITutorialStage {
    private _goalColumn: number
    public get goalName(): string {
        return this._goalName
    }

    constructor(private _goalName: string, private _line: number, private _column?: number) {}

    public async tickFunction(context: ITutorialContext): Promise<boolean> {
        const cursorPosition = await (context.buffer as any).getCursorPosition()

        this._goalColumn = this._column === null ? cursorPosition.character : this._column

        return cursorPosition.line === this._line && cursorPosition.character === this._goalColumn
    }

    public render(context: Oni.BufferLayerRenderContext): JSX.Element {
        if (typeof this._goalColumn !== "number") {
            return null
        }

        const screenPosition = context.bufferToScreen(
            types.Position.create(this._line, this._goalColumn),
        )
        const pixelPosition = context.screenToPixel(screenPosition)

        if (pixelPosition.pixelX < 0 || pixelPosition.pixelY < 0) {
            return null
        }

        return (
            <div
                style={{
                    position: "absolute",
                    top: pixelPosition.pixelY.toString() + "px",
                    left: pixelPosition.pixelX.toString() + "px",
                }}
            >
                <TopArrow />
                <BottomArrow />
            </div>
        )
    }
}
