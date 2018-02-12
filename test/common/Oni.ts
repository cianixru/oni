import * as assert from "assert"
import * as path from "path"

import { Application } from "spectron"

const log = (msg: string) => {
    console.log(msg) // tslint:disable-line no-console
}

const isCiBuild = () => {
    const ciBuild = !!(
        process.env.ONI_AUTOMATION_USE_DIST_BUILD ||
        process.env.CONTINUOUS_INTEGRATION /* set by travis */ ||
        process.env.APPVEYOR
    ) /* set by appveyor */
    log("isCiBuild: " + ciBuild)
    return ciBuild
}

const getExecutablePathOnCiMachine = () => {
    switch (process.platform) {
        case "win32":
            return path.join(__dirname, "..", "..", "..", "dist", "win-ia32-unpacked", "Oni.exe")
        case "darwin":
            return path.join(
                __dirname,
                "..",
                "..",
                "..",
                "dist",
                "mac",
                "Oni.app",
                "Contents",
                "MacOS",
                "Oni",
            )
        case "linux":
            const archFlag = process.arch === "x64" ? "" : "ia32-"
            return path.join(
                __dirname,
                "..",
                "..",
                "..",
                "dist",
                `linux-${archFlag}unpacked`,
                "oni",
            )
        default:
            throw new Error(`Unable to find Oni executable for platform ${process.platform}`)
    }
}

const getExecutablePathLocally = () => {
    const nodeModulesBinPath = path.join(__dirname, "..", "..", "..", "node_modules", ".bin")
    return process.platform === "win32"
        ? path.join(nodeModulesBinPath, "electron.cmd")
        : path.join(nodeModulesBinPath, "electron")
}

const getArgsForCiMachine = () => []
const getArgsForLocalExecution = () => [
    path.join(__dirname, "..", "..", "..", "lib", "main", "src", "main.js"),
]

export interface OniStartOptions {
    configurationPath?: string
}

export class Oni {
    private _app: Application

    public get client(): any {
        return this._app.client
    }

    public async start(options: OniStartOptions = {}): Promise<void> {
        const ciBuild = isCiBuild()
        const executablePath = ciBuild ? getExecutablePathOnCiMachine() : getExecutablePathLocally()
        const executableArgs = ciBuild ? getArgsForCiMachine() : getArgsForLocalExecution()
        log("Using executable path: " + executablePath)
        log("Using executable args: " + executableArgs)

        log("Start options: " + JSON.stringify(options))

        this._app = new Application({
            path: executablePath,
            args: executableArgs,
            env: options.configurationPath ? { ONI_CONFIG_FILE: options.configurationPath } : {},
        })

        log("Oni starting...")
        await this._app.start()
        log("Oni started. Waiting for window load..")
        await this.client.waitUntilWindowLoaded()
        const count = await this.client.getWindowCount()
        assert.equal(count, 1)

        log("Window loaded.")
    }

    public async close(): Promise<void> {
        log("Closing Oni...")
        if (this._app && this._app.isRunning()) {
            await this._app.stop()
        }
        log("Oni closed.")
    }
}
