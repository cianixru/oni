/**
 * TutorialBufferLayer.tsx
 */

import * as React from "react"

import * as Oni from "oni-api"

import styled from "styled-components"

import { NeovimEditor } from "./../../../Editor/NeovimEditor"

import { getInstance as getPluginManagerInstance } from "./../../../Plugins/PluginManager"
import { getInstance as getColorsInstance } from "./../../Colors"
import { getInstance as getCompletionProvidersInstance } from "./../../Completion"
import { configuration } from "./../../Configuration"
import { getInstance as getDiagnosticsInstance } from "./../../Diagnostics"
import { getInstance as getLanguageManagerInstance } from "./../../Language"
import { getInstance as getMenuManagerInstance } from "./../../Menu"
import { getInstance as getOverlayInstance } from "./../../Overlay"
import { getInstance as getSnippetManagerInstance } from "./../../Snippets"
import { getThemeManagerInstance } from "./../../Themes"
import { getInstance as getTokenColorsInstance } from "./../../TokenColors"
import { getInstance as getWorkspaceInstance } from "./../../Workspace"

import { boxShadow, withProps } from "./../../../UI/components/common"
import { FlipCard } from "./../../../UI/components/FlipCard"
import { Icon } from "./../../../UI/Icon"

import { ITutorial } from "./ITutorial"
import { ITutorialState, TutorialGameplayManager } from "./TutorialGameplayManager"
import * as Tutorials from "./Tutorials"

export class TutorialBufferLayer implements Oni.BufferLayer {
    private _editor: NeovimEditor
    private _tutorialGameplayManager: TutorialGameplayManager
    private _initPromise: Promise<void>

    private _isCompleted: boolean

    public get id(): string {
        return "oni.tutorial"
    }

    public get friendlyName(): string {
        return "Tutorial"
    }

    constructor() {
        // TODO: Streamline dependences for NeovimEditor, so it's easier just to spin one up..
        this._editor = new NeovimEditor(
            getColorsInstance(),
            getCompletionProvidersInstance(),
            configuration,
            getDiagnosticsInstance(),
            getLanguageManagerInstance(),
            getMenuManagerInstance(),
            getOverlayInstance(),
            getPluginManagerInstance(),
            getSnippetManagerInstance(),
            getThemeManagerInstance(),
            getTokenColorsInstance(),
            getWorkspaceInstance(),
        )

        this._editor.onNeovimQuit.subscribe(() => {
            alert("quit!")
        })

        this._initPromise = this._editor.init([]).then(() => {
            this._editor.enter()
        })

        this._tutorialGameplayManager = new TutorialGameplayManager(this._editor)

        this._tutorialGameplayManager.onCompleted.subscribe(() => {
            this._isCompleted = true
            alert("Completed!")
        })
    }

    public handleInput(key: string): boolean {
        if (this._isCompleted) {
            this._isCompleted = false
            this._tutorialGameplayManager.start(
                new Tutorials.SwitchModeTutorial(),
                this._editor.activeBuffer,
            )
        } else {
            this._editor.input(key)
        }
        return true
    }

    public render(context: Oni.BufferLayerRenderContext): JSX.Element {
        return (
            <TutorialBufferLayerView
                editor={this._editor}
                renderContext={context}
                tutorialManager={this._tutorialGameplayManager}
            />
        )
    }

    public async startTutorial(tutorial: ITutorial): Promise<void> {
        await this._initPromise
        this._tutorialGameplayManager.start(tutorial, this._editor.activeBuffer)
        this._editor.activeBuffer.addLayer(new GameplayBufferLayer(this._tutorialGameplayManager))
    }
}

export class GameplayBufferLayer implements Oni.BufferLayer {
    public get id(): string {
        return "oni.layer.gameplay"
    }

    public get friendlyName(): string {
        return "Gameplay"
    }

    constructor(private _tutorialGameplayManager: TutorialGameplayManager) {}

    public render(context: Oni.BufferLayerRenderContext): JSX.Element {
        return (
            <GameplayBufferLayerView
                context={context}
                tutorialGameplay={this._tutorialGameplayManager}
            />
        )
    }
}

export interface IGameplayBufferLayerViewProps {
    tutorialGameplay: TutorialGameplayManager
    context: Oni.BufferLayerRenderContext
}

export interface IGameplayBufferLayerViewState {
    renderFunction: (context: Oni.BufferLayerRenderContext) => JSX.Element
}

export class GameplayBufferLayerView extends React.PureComponent<
    IGameplayBufferLayerViewProps,
    IGameplayBufferLayerViewState
> {
    constructor(props: IGameplayBufferLayerViewProps) {
        super(props)

        this.state = {
            renderFunction: () => null,
        }
    }

    public componentDidMount(): void {
        this.props.tutorialGameplay.onStateChanged.subscribe(newState => {
            this.setState({
                renderFunction: newState.renderFunc,
            })
        })
    }

    public render(): JSX.Element {
        if (this.state.renderFunction) {
            return this.state.renderFunction(this.props.context)
        }

        return null
    }
}

export interface ITutorialBufferLayerViewProps {
    renderContext: Oni.BufferLayerRenderContext
    tutorialManager: TutorialGameplayManager
    editor: NeovimEditor
}

export interface ITutorialBufferLayerState {
    tutorialState: ITutorialState
}

const TutorialWrapper = withProps<{}>(styled.div)`
    position: relative;
    width: 100%;
    height: 100%;
    background-color: ${p => p.theme.background};
    color: ${p => p.theme.foreground};

    display: flex;
    flex-direction: column;
    padding-left: 1em;
    `

const TutorialSectionWrapper = styled.div`
    width: 80%;
    max-width: 1000px;
    flex: 0 0 auto;
`

const MainTutorialSectionWrapper = styled.div`
    flex: 1 1 auto;
    width: 100%;
    height: 100%;

    display: flex;
    justify-content: center;
    align-items: center;
`

const PrimaryHeader = styled.div`
    padding-top: 2em;
    font-size: 2em;
`

const SubHeader = styled.div`
    font-size: 1.6em;
`

const SectionHeader = styled.div`
    font-size: 1.1em;
    font-weight: bold;
`

const Section = styled.div`
    padding-top: 1em;
    padding-bottom: 2em;
`

export interface IGoalViewProps {
    active: boolean
    completed: boolean
    description: string
    visible: boolean
}

const GoalWrapper = withProps<IGoalViewProps>(styled.div)`
    ${p => (p.active ? boxShadow : "")};
    display: ${p => (p.visible ? "flex" : "none")};
    background-color: ${p => p.theme["editor.background"]};
    transition: all 0.5s linear;

    justify-content: center;
    align-items: center;
    flex-direction: row;

    margin: 1em;
`

const IconWrapper = withProps<IGoalViewProps>(styled.div)`
    display: flex;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.2);

    color: ${p => (p.completed ? p.theme["highlight.mode.insert.background"] : p.theme.foreground)};
`

export const GoalView = (props: IGoalViewProps): JSX.Element => {
    return (
        <GoalWrapper {...props} key={props.description}>
            <div style={{ width: "48px", height: "48px", flex: "0 0 auto" }}>
                <FlipCard
                    isFlipped={props.completed}
                    front={
                        <IconWrapper {...props}>
                            <Icon name="circle" />
                        </IconWrapper>
                    }
                    back={
                        <IconWrapper {...props}>
                            <Icon name="check" />
                        </IconWrapper>
                    }
                />
            </div>
            <div style={{ width: "100%", flex: "1 1 auto", padding: "1em" }}>
                {props.description}
            </div>
        </GoalWrapper>
    )
}

export class TutorialBufferLayerView extends React.PureComponent<
    ITutorialBufferLayerViewProps,
    ITutorialBufferLayerState
> {
    constructor(props: ITutorialBufferLayerViewProps) {
        super(props)

        this.state = {
            tutorialState: {
                goals: [],
                activeGoalIndex: -1,
                metadata: null,
                completionInfo: { completed: false },
            },
        }
    }

    public componentDidMount(): void {
        this.props.tutorialManager.onStateChanged.subscribe(newState => {
            this.setState({ tutorialState: newState })
        })
    }

    public render(): JSX.Element {
        if (!this.state.tutorialState || !this.state.tutorialState.metadata) {
            return null
        }

        const title = this.state.tutorialState.metadata.name
        const description = this.state.tutorialState.metadata.description

        const activeIndex = this.state.tutorialState.activeGoalIndex
        const goals = this.state.tutorialState.goals.map((goal, idx) => {
            const isCompleted = idx < activeIndex
            const visible = Math.abs(idx - activeIndex) < 2
            return (
                <GoalView
                    completed={isCompleted}
                    description={goal}
                    active={idx === activeIndex}
                    visible={visible}
                />
            )
        })

        return (
            <TutorialWrapper>
                <TutorialSectionWrapper>
                    <PrimaryHeader>Tutorial</PrimaryHeader>
                    <SubHeader>{title}</SubHeader>
                </TutorialSectionWrapper>
                <MainTutorialSectionWrapper>
                    <div
                        style={{
                            width: "75%",
                            height: "75%",
                            boxShadow: "3px 7px 10px 7px rgba(0, 0, 0, 0.2)",
                        }}
                    >
                        <FlipCard
                            isFlipped={this.state.tutorialState.completionInfo.completed}
                            front={this.props.editor.render()}
                            back={
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        backgroundColor: "black",
                                    }}
                                >
                                    Completed
                                </div>
                            }
                        />
                    </div>
                </MainTutorialSectionWrapper>
                <TutorialSectionWrapper>
                    <SectionHeader>Description:</SectionHeader>
                    <Section>{description}</Section>
                    <SectionHeader>Goals:</SectionHeader>
                    <Section>
                        <div>{goals}</div>
                    </Section>
                    <Section />
                </TutorialSectionWrapper>
            </TutorialWrapper>
        )
    }
}
