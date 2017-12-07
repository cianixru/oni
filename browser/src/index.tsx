/**
 * index.tsx
 *
 * Entry point for the BrowserWindow process
 */

import { ipcRenderer } from "electron"
import * as minimist from "minimist"
import * as Log from "./Log"
import { pluginManager } from "./Plugins/PluginManager"

import * as AutoClosingPairs from "./Services/AutoClosingPairs"
import { autoUpdater, constructFeedUrl } from "./Services/AutoUpdate"
import * as BrowserWindowConfigurationSynchronizer from "./Services/BrowserWindowConfigurationSynchronizer"
import { commandManager } from "./Services/CommandManager"
import { configuration, IConfigurationValues } from "./Services/Configuration"
import { editorManager } from "./Services/EditorManager"
import { inputManager } from "./Services/InputManager"
import { languageManager } from "./Services/Language"
import * as Themes from "./Services/Themes"

import { createLanguageClientsFromConfiguration } from "./Services/Language"

import * as UI from "./UI/index"

require("./overlay.less") // tslint:disable-line

const start = async (args: string[]): Promise<void> => {

    UI.activate()

    const parsedArgs = minimist(args)

    // Helper for debugging:
    window["UI"] = UI // tslint:disable-line no-string-literal

    const initialConfigParsingError = configuration.getParsingError()
    if (initialConfigParsingError) {
        Log.error(initialConfigParsingError)
    }

    const configChange = (newConfigValues: Partial<IConfigurationValues>) => {
        let prop: keyof IConfigurationValues
        for (prop in newConfigValues) {
            UI.Actions.setConfigValue(prop, newConfigValues[prop])
        }
    }

    configuration.start()
    BrowserWindowConfigurationSynchronizer.activate(configuration)

    configChange(configuration.getValues()) // initialize values
    configuration.onConfigurationChanged.subscribe(configChange)

    performance.mark("NeovimInstance.Plugins.Discover.Start")
    pluginManager.discoverPlugins()
    performance.mark("NeovimInstance.Plugins.Discover.End")

    await Themes.activate(configuration)

    UI.Actions.setColors(Themes.getThemeManagerInstance().getColors())

    await UI.startEditors(parsedArgs._)

    const api = pluginManager.startApi()
    configuration.activate(api)

    createLanguageClientsFromConfiguration(configuration.getValues())

    AutoClosingPairs.activate(configuration, editorManager, inputManager, languageManager)

    UI.Actions.setLoadingComplete()

    checkForUpdates()
}

ipcRenderer.on("init", (_evt: any, message: any) => {
    process.chdir(message.workingDirectory)
    start(message.args)
})

ipcRenderer.on("execute-command", (_evt: any, command: string) => {
    commandManager.executeCommand(command, null)
})

const checkForUpdates = async (): Promise<void> => {
    const feedUrl = await constructFeedUrl("https://api.onivim.io/v1/update")

    autoUpdater.onUpdateAvailable.subscribe(() => Log.info("Update available."))
    autoUpdater.onUpdateNotAvailable.subscribe(() => Log.info("Update not available."))

    autoUpdater.checkForUpdates(feedUrl)
}
