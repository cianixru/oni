/**
 * QuickOpen.ts
 *
 * Manages the quick open menu
 */

import * as path from "path"
import { execSync } from "child_process"

import * as Q from "q"
import * as _ from "lodash"
import * as recursive from "recursive-readdir"

import { INeovimInstance } from "./../NeovimInstance"
import * as UI from "./../UI/index"
import * as Git from "./Git"
import * as Config from "./../Config"

export class QuickOpen {
    private _seenItems: string[] = []

    constructor(neovimInstance: INeovimInstance) {
        UI.events.on("menu-item-selected", (selectedItem: any) => {
            const arg = selectedItem.selectedOption
            const fullPath = path.join(arg.detail, arg.label)

            this._seenItems.push(fullPath)

            if (!selectedItem.openInSplit) {
                neovimInstance.command("e! " + fullPath)
            } else {
                neovimInstance.command("vsp! " + fullPath)
            }
        })

    }

    public show(): void {
        const overrriddenCommand = Config.getValue<string>("editor.quickOpen.execCommand")

        // Overridden strategy
        if (overrriddenCommand) {
            const files = execSync(overrriddenCommand)
                            .toString("utf8")
                            .split("\n")
            this._showMenuFromFiles(files)
            return
        }

        // Default strategy
        //  If git repo, use git ls-files
        //  Otherwise, find all files recursively
        Git.isGitRepository()
            .then((isGit) => {
                if (isGit) {
                    return Q.all([Git.getTrackedFiles(), Git.getUntrackedFiles()])
                        .then((values: [string[], string[]]) => {
                            const allFiles = _.flatten(values)
                            this._showMenuFromFiles(allFiles)
                        })
                } else {
                    // TODO: This async call is being dropped, if we happen to use the promise
                    recursive(process.cwd(), (err: Error, files: string[]) => {
                        if (!err) {
                            this._showMenuFromFiles(files)
                        }
                    })
                    return
                }
            })
    }

    private _showMenuFromFiles(files: string[]): void {
        const options = files.map((untrimmedFile) => {
            const f = untrimmedFile.trim()
            const file = path.basename(f)
            const folder = path.dirname(f)
            const fullPath = path.join(folder, file)
            return {
                icon: "file-text-o",
                label: file,
                detail: folder,
                pinned: this._seenItems.indexOf(fullPath) >= 0,
            }
        })
        UI.showPopupMenu("quickOpen", options)
    }
}
