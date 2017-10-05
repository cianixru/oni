import * as fs from "fs"
import * as cloneDeep from "lodash/cloneDeep"
import * as isError from "lodash/isError"
import * as path from "path"

import { Event, IEvent } from "./../../Event"
import { applyDefaultKeyBindings } from "./../../Input/KeyBindings"
import * as Log from "./../../Log"
import * as Performance from "./../../Performance"
import * as Platform from "./../../Platform"
import { diff } from "./../../Utility"

import { DefaultConfiguration } from "./DefaultConfiguration"
import { IConfigurationValues } from "./IConfigurationValues"

export class Configuration implements Oni.Configuration {

    private _onConfigurationChangedEvent: Event<Partial<IConfigurationValues>> = new Event<Partial<IConfigurationValues>>()
    private _oniApi: Oni.Plugin.Api = null
    private _config: IConfigurationValues = null

    public get userJsConfig(): string {
        return path.join(this.getUserFolder(), "config.js")
    }

    public get onConfigurationChanged(): IEvent<Partial<IConfigurationValues>> {
        return this._onConfigurationChangedEvent
    }

    constructor() {
        Performance.mark("Config.load.start")

        this.applyConfig()
        // use watch() on the directory rather than on config.js because it watches
        // file references and changing a file in Vim typically saves a tmp file
        // then moves it over to the original filename, causing watch() to lose its
        // reference. Instead, watch() can watch the folder for the file changes
        // and continue to fire when file references are swapped out.
        // Unfortunately, this also means the 'change' event fires twice.
        // I could use watchFile() but that polls every 5 seconds.  Not ideal.
        if (fs.existsSync(this.getUserFolder())) {
            fs.watch(this.getUserFolder(), (event, filename) => {
                if ((event === "change" && filename === "config.js") ||
                     (event === "rename" && filename === "config.js")) {
                    // invalidate the Config currently stored in cache
                    delete global["require"].cache[global["require"].resolve(this.userJsConfig)] // tslint:disable-line no-string-literal
                    this.applyConfig()
                }
            })
        }

        Performance.mark("Config.load.end")
    }

    public hasValue(configValue: keyof IConfigurationValues): boolean {
        return !!this.getValue(configValue)
    }

    public getValue<K extends keyof IConfigurationValues>(configValue: K, defaultValue?: any) {
        if (typeof this._config[configValue] === "undefined") {
            return defaultValue
        } else {
            return this._config[configValue]
        }
    }

    public getValues(): IConfigurationValues {
        return cloneDeep(this._config)
    }

    public getUserFolder(): string {
        return path.join(Platform.getUserHome(), ".oni")
    }

    // Emitting event is not enough, at startup nobody's listening yet
    // so we can't emit the parsing error to anyone when it happens
    public getParsingError(): Error | null {
        const maybeError = this.getUserRuntimeConfig()
        return isError(maybeError) ? maybeError : null
    }

    public activate(oni: Oni.Plugin.Api): void {
        this._oniApi = oni

        this._activateIfOniObjectIsAvailable()
    }

    private applyConfig(): void {
        const previousConfig = this._config

        const userRuntimeConfigOrError = this.getUserRuntimeConfig()
        if (isError(userRuntimeConfigOrError)) {
            Log.error(userRuntimeConfigOrError)
            this._config = { ...DefaultConfiguration }
        } else {
            this._config = { ...DefaultConfiguration, ...userRuntimeConfigOrError}
        }

        this._deactivate()
        this._activateIfOniObjectIsAvailable()

        this._notifyListeners(previousConfig)
    }

    private _activateIfOniObjectIsAvailable(): void {
        if (this._config && this._config.activate && this._oniApi) {
            applyDefaultKeyBindings(this._oniApi, this)

            try {
                this._config.activate(this._oniApi)
            } catch (e) {
                alert("[Config Error] Failed to activate " + this.userJsConfig + ":\n" + (e as Error).message)
            }
        }
    }

    private _deactivate(): void {
        if (this._config && this._config.deactivate) {
            this._config.deactivate()
        }
    }

    private getUserRuntimeConfig(): IConfigurationValues | Error {
        let userRuntimeConfig: IConfigurationValues | null = null
        let error: Error | null = null
        if (fs.existsSync(this.userJsConfig)) {
            try {
                userRuntimeConfig = global["require"](this.userJsConfig) // tslint:disable-line no-string-literal
            } catch (e) {
                e.message = "[Config Error] Failed to parse " + this.userJsConfig + ":\n" + (e as Error).message
                error = e

                alert(e.message)
            }
        }
        return error ? error : userRuntimeConfig
    }

    private _notifyListeners(previousConfig?: Partial<IConfigurationValues>): void {
        previousConfig = previousConfig || {}

        const changedValues = diff(this._config, previousConfig)

        const diffObject = changedValues.reduce((previous: Partial<IConfigurationValues>, current: string) => {

            const currentValue = this._config[current]

            // Skip functions, because those will always be different
            if (currentValue && typeof currentValue === "function") {
                return previous
            }

            return {
                ...previous,
                [current]: this._config[current],
            }
        }, {})

        this._onConfigurationChangedEvent.dispatch(diffObject)
    }
}

export const configuration = new Configuration()
