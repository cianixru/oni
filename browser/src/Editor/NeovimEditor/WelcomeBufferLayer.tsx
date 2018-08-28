/**
 * NeovimEditor.ts
 *
 * IEditor implementation for Neovim
 */

import * as Oni from "oni-api"
import * as Log from "oni-core-logging"
import { Event } from "oni-types"
import * as React from "react"

import { getMetadata } from "./../../Services/Metadata"
import styled, {
    Css,
    css,
    enableMouse,
    getSelectedBorder,
    keyframes,
} from "./../../UI/components/common"

// const entrance = keyframes`
//     0% { opacity: 0; transform: translateY(2px); }
//     100% { opacity: 0.5; transform: translateY(0px); }
// `

// const enterLeft = keyframes`
//     0% { opacity: 0; transform: translateX(-4px); }
//     100% { opacity: 1; transform: translateX(0px); }
// `

// const enterRight = keyframes`
//     0% { opacity: 0; transform: translateX(4px); }
//     100% { opacity: 1; transform: translateX(0px); }
// `

const entranceFull = keyframes`
    0% {
        opacity: 0;
        transform: translateY(8px);
    }
    100% {
        opacity: 1;
        transform: translateY(0px);
    }
`
const WelcomeWrapper = styled.div`
    background-color: ${p => p.theme["editor.background"]};
    color: ${p => p.theme["editor.foreground"]};
    overflow-y: hidden;
    user-select: none;
    pointer-events: all;
    width: 100%;
    height: 100%;
    opacity: 0;
    animation: ${entranceFull} 0.25s ease-in 0.1s forwards ${enableMouse};
`
interface IColumnProps {
    alignment?: string
    flex?: string
    height?: string
    overflowY?: string
}

const Column = styled<IColumnProps, "div">("div")`
    background: ${p => p.theme["editor.background"]};
    display: flex;
    justify-content: center;
    align-items: ${({ alignment }) => alignment || "center"};
    flex-direction: column;
    width: 100%;
    flex: ${({ flex }) => flex || "1 1 auto"};
    height: ${({ height }) => height || `auto`};
    ${({ overflowY }) => overflowY && `overflow-y: ${overflowY}`};
`

const Row = styled<{ extension?: Css }, "div">("div")`
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: row;
    opacity: 0;
    ${({ extension }) => extension};
`

const TitleText = styled.div`
    font-size: 2em;
    text-align: right;
`

const SubtitleText = styled.div`
    font-size: 1.2em;
    text-align: right;
`

const HeroImage = styled.img`
    width: 192px;
    height: 192px;
    opacity: 0.4;
`

const SectionHeader = styled.div`
    margin-top: 1em;
    margin-bottom: 1em;

    font-size: 1.1em;
    font-weight: bold;
    text-align: center;
    width: 100%;
`

const WelcomeButtonHoverStyled = `
    transform: translateY(-1px);
    box-shadow: 0 4px 8px 2px rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
`

export interface WelcomeButtonWrapperProps {
    isSelected: boolean
    borderSize: string
}

const WelcomeButtonWrapper = styled<WelcomeButtonWrapperProps, "button">("button")`
    box-sizing: border-box;
    font-size: inherit;
    font-family: inherit;
    border: 0px solid ${props => props.theme.foreground};
    border-left: ${getSelectedBorder};
    border-right: 4px solid transparent;
    cursor: pointer;
    color: ${({ theme }) => theme.foreground};
    background-color: ${({ theme }) => theme.background};
    transform: ${({ isSelected }) => (isSelected ? "translateX(-4px)" : "translateX(0px)")};
    transition: transform 0.25s;
    width: 100%;
    margin: 8px 0px;
    padding: 8px;
    display: flex;
    flex-direction: row;
    &:hover {
        ${WelcomeButtonHoverStyled};
    }
`

const AnimatedContainer = styled<{ duration: string }, "div">("div")`
    width: 100%;
    animation: ${entranceFull} ${p => p.duration} ease-in 1s both;
`

const WelcomeButtonTitle = styled.span`
    font-size: 1.1em;
    font-weight: bold;
    margin: 4px;
    width: 100%;
`

const WelcomeButtonDescription = styled.span`
    font-size: 0.8em;
    opacity: 0.75;
    margin: 4px;
    width: 100%;
    text-align: right;
`

export interface WelcomeButtonProps {
    title: string
    description: string
    command: string
    selected: boolean
    onClick: () => void
}

interface IChromeDiv extends HTMLButtonElement {
    scrollIntoViewIfNeeded: () => void
}

export class WelcomeButton extends React.PureComponent<WelcomeButtonProps> {
    private _button = React.createRef<IChromeDiv>()

    public componentDidUpdate(prevProps: WelcomeButtonProps) {
        if (!prevProps.selected && this.props.selected) {
            this._button.current.scrollIntoViewIfNeeded()
        }
    }

    public render() {
        return (
            <WelcomeButtonWrapper
                borderSize="4px"
                innerRef={this._button}
                isSelected={this.props.selected}
                onClick={this.props.onClick}
            >
                <WelcomeButtonTitle>{this.props.title}</WelcomeButtonTitle>
                <WelcomeButtonDescription>{this.props.description}</WelcomeButtonDescription>
            </WelcomeButtonWrapper>
        )
    }
}

export interface WelcomeHeaderState {
    version: string
}

export interface OniWithActiveSection extends Oni.Plugin.Api {
    getActiveSection(): string
}

type ExecuteCommand = <T>(command: string, args?: T) => void

export interface IWelcomeInputEvent {
    direction: number
    select: boolean
}

interface ICommandMetadata<T = undefined> {
    command: string
    args?: T
}

export interface IWelcomeCommandsDictionary {
    openFile: ICommandMetadata
    openTutor: ICommandMetadata
    openDocs: ICommandMetadata
    openConfig: ICommandMetadata
    openThemes: ICommandMetadata
    openWorkspaceFolder: ICommandMetadata
    commandPalette: ICommandMetadata
    commandline: ICommandMetadata
}

export class WelcomeBufferLayer implements Oni.BufferLayer {
    public inputEvent = new Event<IWelcomeInputEvent>()

    public readonly welcomeCommands: IWelcomeCommandsDictionary = {
        openFile: {
            command: "oni.editor.newFile",
        },
        openWorkspaceFolder: {
            command: "workspace.openFolder",
        },
        commandPalette: {
            command: "quickOpen.show",
        },
        commandline: {
            command: "executeVimCommand",
        },
        openTutor: {
            command: "oni.tutor.open",
        },
        openDocs: {
            command: "oni.docs.open",
        },
        openConfig: {
            command: "oni.config.openUserConfig",
        },
        openThemes: {
            command: "oni.themes.open",
        },
    }

    constructor(private _oni: OniWithActiveSection) {}

    public get id() {
        return "oni.welcome"
    }

    public get friendlyName() {
        return "Welcome"
    }

    public isActive(): boolean {
        const activeSection = this._oni.getActiveSection()
        return activeSection === "editor"
    }

    public handleInput(key: string) {
        Log.info(`ONI WELCOME INPUT KEY: ${key}`)
        switch (key) {
            case "j":
                this.inputEvent.dispatch({ direction: 1, select: false })
                break
            case "k":
                this.inputEvent.dispatch({ direction: -1, select: false })
                break
            case "<enter>":
                this.inputEvent.dispatch({ direction: 0, select: true })
                break
            default:
                this.inputEvent.dispatch({ direction: 0, select: false })
        }
    }

    public executeCommand: ExecuteCommand = (cmd, args) => {
        if (cmd) {
            this._oni.commands.executeCommand(cmd, args)
        }
    }

    public render(context: Oni.BufferLayerRenderContext) {
        const active = this._oni.getActiveSection() === "editor"
        const ids = Object.values(this.welcomeCommands).map(({ command }) => command)
        return (
            <WelcomeWrapper>
                <WelcomeView
                    buttonIds={ids}
                    active={active}
                    inputEvent={this.inputEvent}
                    commands={this.welcomeCommands}
                    executeCommand={this.executeCommand}
                />
            </WelcomeWrapper>
        )
    }
}

export interface WelcomeViewProps {
    active: boolean
    buttonIds: string[]
    inputEvent: Event<IWelcomeInputEvent>
    commands: IWelcomeCommandsDictionary
    executeCommand: ExecuteCommand
}

export interface WelcomeViewState {
    version: string
    selectedId: string
    currentIndex: number
}

const buttonsRow = css`
    width: 100%;
    margin-top: 64px;
    opacity: 1;
`

const titleRow = css`
    width: 100%;
    padding-top: 32px;
    animation: ${entranceFull} 0.25s ease-in 0.25s forwards};
`

export class WelcomeView extends React.PureComponent<WelcomeViewProps, WelcomeViewState> {
    public state: WelcomeViewState = {
        version: null,
        currentIndex: 0,
        selectedId: this.props.buttonIds[0],
    }

    private _welcomeElement = React.createRef<HTMLDivElement>()

    public async componentDidMount() {
        const metadata = await getMetadata()
        this.setState({ version: metadata.version })
        this.props.inputEvent.subscribe(this.handleInput)
    }

    public handleInput = ({ direction, select }: IWelcomeInputEvent) => {
        const { currentIndex } = this.state

        const newIndex = this.getNextIndex(direction, currentIndex)
        const selectedId = this.props.buttonIds[newIndex]
        this.setState({ currentIndex: newIndex, selectedId })

        if (select && this.props.active) {
            const currentCommand = this.getCurrentCommand(selectedId)
            this.props.executeCommand(currentCommand.command, currentCommand.args)
        }
    }

    public getCurrentCommand(selectedId: string): ICommandMetadata {
        const { commands } = this.props
        const currentCommand = Object.values(commands).find(({ command }) => command === selectedId)
        return currentCommand
    }

    public getNextIndex(direction: number, currentIndex: number) {
        const nextPosition = currentIndex + direction
        switch (true) {
            case nextPosition < 0:
                return this.props.buttonIds.length - 1
            case nextPosition === this.props.buttonIds.length:
                return 0
            default:
                return nextPosition
        }
    }

    public componentDidUpdate() {
        if (this.props.active && this._welcomeElement && this._welcomeElement.current) {
            this._welcomeElement.current.focus()
        }
    }

    public render() {
        const { version } = this.state
        return version ? (
            <Column innerRef={this._welcomeElement} height="100%" data-id="welcome-screen">
                <Row extension={titleRow}>
                    <Column />
                    <Column alignment="flex-end">
                        <TitleText>Oni</TitleText>
                        <SubtitleText>Modern Modal Editing</SubtitleText>
                    </Column>
                    <Column flex="0 0">
                        <HeroImage src="images/oni-icon-no-border.svg" />
                    </Column>
                    <Column alignment="flex-start">
                        <SubtitleText>{`v${this.state.version}`}</SubtitleText>
                        <div>{"https://onivim.io"}</div>
                    </Column>
                    <Column />
                </Row>
                <Row extension={buttonsRow}>
                    <Column />
                    <WelcomeCommandsView
                        commands={this.props.commands}
                        selectedId={this.state.selectedId}
                        executeCommand={this.props.executeCommand}
                    />
                    <Column />
                </Row>
            </Column>
        ) : null
    }
}

export interface IWelcomeCommandsViewProps extends Partial<WelcomeViewProps> {
    selectedId: string
}

export class WelcomeCommandsView extends React.PureComponent<IWelcomeCommandsViewProps, {}> {
    public render() {
        const { commands, executeCommand } = this.props
        const isSelected = (command: string) => command === this.props.selectedId
        return (
            <Column>
                <AnimatedContainer duration="0.25s">
                    <SectionHeader>Quick Commands</SectionHeader>
                    <WelcomeButton
                        title="New File"
                        onClick={() => executeCommand(commands.openFile.command)}
                        description="Control + N"
                        command={commands.openFile.command}
                        selected={isSelected(commands.openFile.command)}
                    />
                    <WelcomeButton
                        title="Open File / Folder"
                        onClick={() => executeCommand(commands.openWorkspaceFolder.command)}
                        description="Control + O"
                        command={commands.openWorkspaceFolder.command}
                        selected={isSelected(commands.openWorkspaceFolder.command)}
                    />
                    <WelcomeButton
                        title="Command Palette"
                        onClick={() => executeCommand(commands.commandPalette.command)}
                        description="Control + Shift + P"
                        command={commands.commandPalette.command}
                        selected={isSelected(commands.commandPalette.command)}
                    />
                    <WelcomeButton
                        title="Vim Ex Commands"
                        description=":"
                        command="editor.openExCommands"
                        onClick={() => executeCommand(commands.commandline.command)}
                        selected={isSelected(commands.commandline.command)}
                    />
                </AnimatedContainer>
                <AnimatedContainer duration="0.25s">
                    <SectionHeader>Learn</SectionHeader>
                    <WelcomeButton
                        title="Tutor"
                        onClick={() => executeCommand(commands.openTutor.command)}
                        description="Learn modal editing with an interactive tutorial."
                        command={commands.openTutor.command}
                        selected={isSelected(commands.openTutor.command)}
                    />
                    <WelcomeButton
                        title="Documentation"
                        onClick={() => executeCommand(commands.openDocs.command)}
                        description="Discover what Oni can do for you."
                        command={commands.openDocs.command}
                        selected={isSelected(commands.openDocs.command)}
                    />
                </AnimatedContainer>
                <AnimatedContainer duration="0.25s">
                    <SectionHeader>Customize</SectionHeader>
                    <WelcomeButton
                        title="Configure"
                        onClick={() => executeCommand(commands.openConfig.command)}
                        description="Make Oni work the way you want."
                        command={commands.openConfig.command}
                        selected={isSelected(commands.openConfig.command)}
                    />
                    <WelcomeButton
                        title="Themes"
                        onClick={() => executeCommand(commands.openThemes.command)}
                        description="Choose a theme that works for you."
                        command={commands.openThemes.command}
                        selected={isSelected(commands.openThemes.command)}
                    />
                </AnimatedContainer>
            </Column>
        )
    }
}
