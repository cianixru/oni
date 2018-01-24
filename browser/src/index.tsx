/**
 * index.tsx
 *
 * Entry point for the BrowserWindow process
 */

import { ipcRenderer } from "electron"
import * as minimist from "minimist"
import * as path from "path"
import * as Log from "./Log"
import * as Performance from "./Performance"
import * as Utility from "./Utility"

import { IConfigurationValues } from "./Services/Configuration/IConfigurationValues"

const start = async (args: string[]): Promise<void> => {
    Performance.startMeasure("Oni.Start")

    const Shell = await import("./UI/Shell")
    Shell.activate()

    const configurationPromise = import("./Services/Configuration")
    const pluginManagerPromise = import("./Plugins/PluginManager")
    const themesPromise = import("./Services/Themes")
    const iconThemesPromise = import("./Services/IconThemes")

    const sidebarPromise = import("./Services/Sidebar")
    const overlayPromise = import("./Services/Overlay")
    const statusBarPromise = import("./Services/StatusBar")
    const startEditorsPromise = import("./startEditors")

    const sharedNeovimInstancePromise = import("./neovim/SharedNeovimInstance")
    const autoClosingPairsPromise = import("./Services/AutoClosingPairs")
    const browserWindowConfigurationSynchronizerPromise = import("./Services/BrowserWindowConfigurationSynchronizer")
    const colorsPromise = import("./Services/Colors")
    const diagnosticsPromise = import("./Services/Diagnostics")
    const editorManagerPromise = import("./Services/EditorManager")
    const globalCommandsPromise = import("./Services/Commands/GlobalCommands")
    const inputManagerPromise = import("./Services/InputManager")
    const languageManagerPromise = import("./Services/Language")
    const snippetPromise = import("./Services/Snippets")
    const workspacePromise = import("./Services/Workspace")

    const themePickerPromise = import("./Services/Themes/ThemePicker")
    const cssPromise = import("./CSS")
    const completionProvidersPromise = import("./Services/Completion/CompletionProviders")

    const parsedArgs = minimist(args)
    const currentWorkingDirectory = process.cwd()
    const filesToOpen = parsedArgs._.map((arg) => path.join(currentWorkingDirectory, arg))

    // Helper for debugging:
     Performance.startMeasure("Oni.Start.Config")

    const { configuration } = await configurationPromise

    const initialConfigParsingErrors = configuration.getErrors()
    if (initialConfigParsingErrors && initialConfigParsingErrors.length > 0) {
        initialConfigParsingErrors.forEach((err: Error) => Log.error(err))
    }

    const configChange = (newConfigValues: Partial<IConfigurationValues>) => {
        let prop: keyof IConfigurationValues
        for (prop in newConfigValues) {
            Shell.Actions.setConfigValue(prop, newConfigValues[prop])
        }
    }

    configuration.onConfigurationError.subscribe((err) => {
        // TODO: Better / nicer handling of error:
        alert(err)
    })

    configuration.start()

    configChange(configuration.getValues()) // initialize values
    configuration.onConfigurationChanged.subscribe(configChange)
    Performance.endMeasure("Oni.Start.Config")

    const PluginManager = await pluginManagerPromise
    PluginManager.activate(configuration)
    const pluginManager = PluginManager.getInstance()

    Performance.startMeasure("Oni.Start.Plugins.Discover")
    pluginManager.discoverPlugins()
    Performance.endMeasure("Oni.Start.Plugins.Discover")

    Performance.startMeasure("Oni.Start.Themes")
    const Themes = await themesPromise
    const IconThemes = await iconThemesPromise
    await Promise.all([
        Themes.activate(configuration, pluginManager),
        IconThemes.activate(configuration, pluginManager)
    ])

    const Colors = await colorsPromise
    Colors.activate(configuration, Themes.getThemeManagerInstance())
    Shell.initializeColors(Colors.getInstance())
    Performance.endMeasure("Oni.Start.Themes")

    const BrowserWindowConfigurationSynchronizer = await browserWindowConfigurationSynchronizerPromise
    BrowserWindowConfigurationSynchronizer.activate(configuration, Colors.getInstance())

    const { editorManager } = await editorManagerPromise

    const Workspace = await workspacePromise
    Workspace.activate(configuration, editorManager)
    const workspace = Workspace.getInstance()

    const StatusBar = await statusBarPromise
    StatusBar.activate(configuration)
    const statusBar = StatusBar.getInstance()

    const Overlay = await overlayPromise
    Overlay.activate()

    const LanguageManager = await languageManagerPromise
    LanguageManager.activate(configuration, editorManager, statusBar, workspace)
    const languageManager = LanguageManager.getInstance()

    Performance.startMeasure("Oni.Start.Editors")
    const SharedNeovimInstance = await sharedNeovimInstancePromise
    const { startEditors } = await startEditorsPromise

    const CSS = await cssPromise
    CSS.activate()

    Shell.Actions.setLoadingComplete()

    const Diagnostics = await diagnosticsPromise
    const diagnostics = Diagnostics.getInstance()

    const CompletionProviders = await completionProvidersPromise
    CompletionProviders.activate(languageManager)

   await Promise.race([Utility.delay(5000),
     Promise.all([
        SharedNeovimInstance.activate(configuration, pluginManager),
        startEditors(filesToOpen, Colors.getInstance(), CompletionProviders.getInstance(), configuration, diagnostics, languageManager, pluginManager, Themes.getThemeManagerInstance(), workspace)
    ])
   ])
    Performance.endMeasure("Oni.Start.Editors")

    Performance.startMeasure("Oni.Start.Sidebar")
    const Sidebar = await sidebarPromise
    Sidebar.activate(configuration, workspace)
    Performance.endMeasure("Oni.Start.Sidebar")

    const createLanguageClientsFromConfiguration = LanguageManager.createLanguageClientsFromConfiguration

    diagnostics.start(languageManager)

    Performance.startMeasure("Oni.Start.Activate")
    const api = pluginManager.startApi()
    configuration.activate(api)

    createLanguageClientsFromConfiguration(configuration.getValues())

    const { inputManager } = await inputManagerPromise
    const { commandManager } = await import("./Services/CommandManager")

    const AutoClosingPairs = await autoClosingPairsPromise
    AutoClosingPairs.activate(configuration, editorManager, inputManager, languageManager)

    const GlobalCommands = await globalCommandsPromise
    GlobalCommands.activate(commandManager)

    const Snippets = await snippetPromise
    Snippets.activate()

    const ThemePicker = await themePickerPromise
    ThemePicker.activate(configuration, Themes.getThemeManagerInstance())

    Performance.endMeasure("Oni.Start.Activate")

    checkForUpdates()

    Performance.endMeasure("Oni.Start")
    ipcRenderer.send("Oni.started", "started")
}

ipcRenderer.on("init", (_evt: any, message: any) => {
    process.chdir(message.workingDirectory)
    start(message.args)
})

ipcRenderer.on("execute-command", async (_evt: any, command: string, arg?: any) => {
    const { commandManager } = await import("./Services/CommandManager")
    commandManager.executeCommand(command, arg)
})

const checkForUpdates = async (): Promise<void> => {
    const AutoUpdate = await import("./Services/AutoUpdate")
    const { autoUpdater, constructFeedUrl } = AutoUpdate

    const feedUrl = await constructFeedUrl("https://api.onivim.io/v1/update")

    autoUpdater.onUpdateAvailable.subscribe(() => Log.info("Update available."))
    autoUpdater.onUpdateNotAvailable.subscribe(() => Log.info("Update not available."))

    autoUpdater.checkForUpdates(feedUrl)
}
