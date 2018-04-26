/**
 * TutorialManager
 */

import * as Oni from "oni-api"

import { Event, IEvent } from "oni-types"
import { ITutorial, ITutorialMetadata, ITutorialStage } from "./ITutorial"

export interface ITutorialState {
    metadata: ITutorialMetadata
    renderFunc?: (context: Oni.BufferLayerRenderContext) => JSX.Element
    activeGoalIndex: number
    goals: string[]
}

/**
 * Class that manages the state / lifecycle of the tutorial
 * - Calls the 'tick' function
 * - Calls the 'render' function
 */

export const TICK_RATE = 50 /* 50 ms, or 20 times pers second */

export class TutorialGameplayManager {
    private _activeTutorial: ITutorial
    private _currentStageIdx: number
    private _onStateChanged = new Event<ITutorialState>()
    private _onCompleted = new Event<boolean>()
    private _currentState: ITutorialState = null
    private _onTick = new Event<void>()

    private _isTickInProgress: boolean = false
    private _buf: Oni.Buffer
    private _pendingTimer: number | null = null

    public get onStateChanged(): IEvent<ITutorialState> {
        return this._onStateChanged
    }

    public get onCompleted(): IEvent<boolean> {
        return this._onCompleted
    }

    public get onTick(): IEvent<void> {
        return this._onTick
    }

    public get currentState(): ITutorialState {
        return this._currentState
    }

    public get currentStage(): ITutorialStage {
        return this._activeTutorial.stages[this._currentStageIdx]
    }

    public get currentTutorial(): ITutorial {
        return this._activeTutorial
    }

    constructor(private _editor: Oni.Editor) {}

    public start(tutorial: ITutorial, buffer: Oni.Buffer): void {
        this._buf = buffer
        this._currentStageIdx = 0
        this._activeTutorial = tutorial

        this._pendingTimer = window.setInterval(() => this._tick(), TICK_RATE)

        this._tick()
    }

    public stop(): void {
        if (this._pendingTimer) {
            window.clearInterval(this._pendingTimer)
            this._pendingTimer = null
        }
    }

    private async _tick(): Promise<void> {
        if (this._isTickInProgress) {
            return
        }

        if (!this.currentStage) {
            return
        }

        this._isTickInProgress = true

        const result = await this.currentStage.tickFunction({
            editor: this._editor,
            buffer: this._buf,
        })
        this._onTick.dispatch()

        this._isTickInProgress = false
        if (result) {
            this._currentStageIdx++

            if (this._currentStageIdx >= this._activeTutorial.stages.length) {
                this._onCompleted.dispatch(true)
            }
        }

        const goalsToSend = this._activeTutorial.stages.map(f => f.goalName)

        const newState: ITutorialState = {
            metadata: this._activeTutorial.metadata,
            goals: goalsToSend,
            activeGoalIndex: this._currentStageIdx,
            renderFunc: (context: Oni.BufferLayerRenderContext) =>
                this.currentStage && this.currentStage.render
                    ? this.currentStage.render(context)
                    : null,
        }
        this._currentState = newState
        this._onStateChanged.dispatch(newState)
    }
}
