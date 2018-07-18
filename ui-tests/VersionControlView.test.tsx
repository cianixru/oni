import { shallow } from "enzyme"
import { shallowToJson } from "enzyme-to-json"
import * as React from "react"

import {
    DefaultState,
    VersionControlState,
} from "./../browser/src/Services/VersionControl/VersionControlStore"
import {
    GitStatus,
    SectionTitle,
    VersionControlView,
} from "./../browser/src/Services/VersionControl/VersionControlView"

const noop = () => ({})

jest.mock("./../browser/src/neovim/SharedNeovimInstance", () => ({
    getInstance: () => ({
        bindToMenu: () => ({
            setItems: jest.fn(),
            onCursorMoved: {
                subscribe: jest.fn(),
            },
        }),
    }),
}))

const makePromise = (arg?: any) => Promise.resolve(arg)

jest.mock("../browser/src/UI/components/Sneakable", () => {
    const React = require("react") // tslint:disable-line
    return { Sneakable: () => <div /> }
})

describe("<VersionControlView />", () => {
    const state = { ...DefaultState, activated: true, hasFocus: true }
    const container = shallow(<VersionControlView {...state} getStatus={() => makePromise({})} />)
    it("renders without crashing", () => {
        expect(container.length).toBe(1)
    })

    it("should render an untracked, staged and modified section", () => {
        const sections = container.dive().find(GitStatus).length
        expect(sections).toBe(3)
    })

    it("shouldn't show a section if it has no content", () => {
        const wrapper = shallow(
            <GitStatus
                onClick={noop}
                toggleVisibility={noop}
                visibility={true}
                titleId="modified"
                selectedId="file1"
                icon="M"
                files={null}
            />,
        )
        expect(wrapper.find(SectionTitle).length).toBe(0)
    })

    it("should match the last recorded snapshot unless a change was made", () => {
        const wrapper = shallow(
            <GitStatus
                titleId="modified"
                visibility={true}
                toggleVisibility={noop}
                onClick={noop}
                selectedId="file1"
                icon="M"
                files={["test1", "test2"]}
            />,
        )
        expect(shallowToJson(wrapper)).toMatchSnapshot()
    })

    it("should render the correct number of modified files from the store in the correct section from of the pane", () => {
        const stateCopy = {
            ...DefaultState,
            activated: true,
            hasFocus: true,
            status: {
                currentBranch: null,
                staged: [],
                conflicted: [],
                created: [],
                modified: ["test1", "test2"],
                remoteTrackingBranch: null,
                deleted: [],
                untracked: [],
                ahead: null,
                behind: null,
            },
        }

        const statusComponent = shallow(
            <VersionControlView {...stateCopy} getStatus={() => makePromise({})} />,
        )
            .dive()
            .findWhere(component => component.prop("titleId") === "modified")

        expect(statusComponent.prop("files").length).toBe(2)
    })
})
