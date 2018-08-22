import * as React from "react"

import { inputManager } from "../../../Services/InputManager"
import styled from "../common"
import { SectionTitle, Title } from "./../SectionTitle"

const sidebarCommands = [
    { command: "vcs.openFile", description: "Open the currently selected file" },
    { command: "vcs.unstage", description: "Unstage the currently selected file" },
    { command: "vcs.commitAll", description: "Commit all staged files" },
    { command: "vcs.refresh", description: "Manually refresh vcs pane" },
    { command: "vcs.sidebar.toggle", description: "Toggle vcs pane" },
]
const getBoundKeys = (commands = sidebarCommands) => {
    return commands.map(({ command, ...rest }) => ({
        key: inputManager.getBoundKeys(command)[0] || "Unbound",
        ...rest,
    }))
}

const HelpContainer = styled.div``

const CommandExplainer = styled.div`
    padding: 0 0.5em;
`

export const Description = styled.p`
    margin: 0.5em 0;
`

const Command = styled.span`
    color: ${p => p.theme["highlight.mode.insert.foreground"]};
    background-color: ${p => p.theme["highlight.mode.insert.background"]};
`

const wrapInBrackets = (str: string) => {
    return str.startsWith("<") && str.endsWith(">") ? str : `<${str}>`
}

const Help: React.SFC<{}> = props => {
    const commands = getBoundKeys()
    return (
        <HelpContainer>
            <SectionTitle>
                <Title>Help</Title>?
            </SectionTitle>
            {commands.map(command => (
                <CommandExplainer key={command.key}>
                    <Description>
                        {command.description} - <Command>{wrapInBrackets(command.key)}</Command>
                    </Description>
                </CommandExplainer>
            ))}
        </HelpContainer>
    )
}

export default Help
