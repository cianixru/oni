/**
 * ExplorerFileSystem.ts
 *
 * State management for the explorer split
 */

import * as fs from "fs"
import * as path from "path"

import { FolderOrFile } from "./ExplorerStore"

/**
 * An abstraction of the node filesystem APIs to enable testing
 */
export interface IFileSystem {
    readdir(fullPath: string): Promise<FolderOrFile[]>
}

export class FileSystem implements IFileSystem {

    constructor(
        private _fs: typeof fs,
    ) {}

    public readdir(directoryPath: string): Promise<FolderOrFile[]> {
        const files = this._fs.readdirSync(directoryPath)

        const filesAndFolders = files.map((f) => {
            const fullPath = path.join(directoryPath, f)
            const stat = this._fs.statSync(fullPath)
            if (stat.isDirectory()) {
                return {
                    type: "folder",
                    fullPath,
                } as FolderOrFile
            } else {
                return {
                    type: "file",
                    fullPath,
                } as FolderOrFile
            }
        })

        return Promise.resolve(filesAndFolders)
    }
}
