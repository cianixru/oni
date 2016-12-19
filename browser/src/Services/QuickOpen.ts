/**
 * QuickOpen.ts
 *
 * Manages the quick open menu
 */

import { execSync } from "child_process"
import * as path from "path"

import * as _ from "lodash"
import * as Q from "q"
import * as recursive from "recursive-readdir"

import * as Config from "./../Config"
import { INeovimInstance } from "./../NeovimInstance"
import * as PromiseHelper from "./../PromiseHelper"
import * as UI from "./../UI/index"
import * as Git from "./Git"

const recursiveQ = Q.denodeify<string[]>(recursive)

export class QuickOpen {
    private _seenItems: string[] = []

    constructor(neovimInstance: INeovimInstance) {
        UI.events.on("menu-item-selected:quickOpen", (selectedItem: any) => {
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
        const openPromise = Git.isGitRepository()
            .then((isGit) => {
                if (isGit) {
                    return Q.all([Git.getTrackedFiles(), Git.getUntrackedFiles()])
                        .then((values: [string[], string[]]) => {
                            const allFiles = _.flatten(values)
                            this._showMenuFromFiles(allFiles)
                        })
                } else {
                    // TODO: This async call is being dropped, if we happen to use the promise
                    return recursiveQ(process.cwd())
                        .then((files: string[]) => {
                            this._showMenuFromFiles(files)
                        })
                }
            })

        PromiseHelper.wrapPromiseAndNotifyError("editor.quickOpen.show", openPromise)
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
