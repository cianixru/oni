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

    const UnhandledErrorMonitor = await import("./Services/UnhandledErrorMonitor")
    UnhandledErrorMonitor.activate()

    const Shell = await import("./UI/Shell")
    Shell.activate()

    const configurationPromise = import("./Services/Configuration")
    const configurationCommandsPromise = import("./Services/Configuration/ConfigurationCommands")
    const pluginManagerPromise = import("./Plugins/PluginManager")
    const themesPromise = import("./Services/Themes")
    const iconThemesPromise = import("./Services/IconThemes")

    const sidebarPromise = import("./Services/Sidebar")
    const overlayPromise = import("./Services/Overlay")
    const statusBarPromise = import("./Services/StatusBar")
    const startEditorsPromise = import("./startEditors")

    const menuPromise = import("./Services/Menu")

    const sharedNeovimInstancePromise = import("./neovim/SharedNeovimInstance")
    const browserWindowConfigurationSynchronizerPromise = import("./Services/BrowserWindowConfigurationSynchronizer")
    const colorsPromise = import("./Services/Colors")
    const tokenColorsPromise = import("./Services/TokenColors")
    const diagnosticsPromise = import("./Services/Diagnostics")
    const editorManagerPromise = import("./Services/EditorManager")
    const globalCommandsPromise = import("./Services/Commands/GlobalCommands")
    const inputManagerPromise = import("./Services/InputManager")
    const languageManagerPromise = import("./Services/Language")
    const notificationsPromise = import("./Services/Notifications")
    const snippetPromise = import("./Services/Snippets")
    const keyDisplayerPromise = import("./Services/KeyDisplayer")
    const taksPromise = import("./Services/Tasks")
    const workspacePromise = import("./Services/Workspace")
    const workspaceCommandsPromise = import("./Services/Workspace/WorkspaceCommands")

    const themePickerPromise = import("./Services/Themes/ThemePicker")
    const cssPromise = import("./CSS")
    const completionProvidersPromise = import("./Services/Completion/CompletionProviders")

    const parsedArgs = minimist(args)
    const currentWorkingDirectory = process.cwd()
    const filesToOpen = parsedArgs._.map(
        arg => (path.isAbsolute(arg) ? arg : path.join(currentWorkingDirectory, arg)),
    )

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
        IconThemes.activate(configuration, pluginManager),
    ])

    const Colors = await colorsPromise
    Colors.activate(configuration, Themes.getThemeManagerInstance())
    Shell.initializeColors(Colors.getInstance())
    Performance.endMeasure("Oni.Start.Themes")

    const TokenColors = await tokenColorsPromise
    TokenColors.activate(configuration, Themes.getThemeManagerInstance())

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
    const overlayManager = Overlay.getInstance()

    const sneakPromise = import("./Services/Sneak")
    const { commandManager } = await import("./Services/CommandManager")
    const Sneak = await sneakPromise
    Sneak.activate(commandManager, overlayManager)

    const Menu = await menuPromise
    Menu.activate(configuration, overlayManager)
    const menuManager = Menu.getInstance()

    const Notifications = await notificationsPromise
    Notifications.activate(configuration, overlayManager)

    configuration.onConfigurationError.subscribe(err => {
        const notifications = Notifications.getInstance()
        const notification = notifications.createItem()
        notification.setContents("Error Loading Configuration", err.toString())
        notification.setLevel("error")
        notification.onClick.subscribe(() =>
            commandManager.executeCommand("oni.config.openConfigJs"),
        )
        notification.show()
    })

    UnhandledErrorMonitor.start(Notifications.getInstance())

    const Tasks = await taksPromise
    Tasks.activate(menuManager)
    const tasks = Tasks.getInstance()

    const LanguageManager = await languageManagerPromise
    LanguageManager.activate(configuration, editorManager, statusBar, workspace)
    const languageManager = LanguageManager.getInstance()

    Performance.startMeasure("Oni.Start.Editors")
    const SharedNeovimInstance = await sharedNeovimInstancePromise
    const { startEditors } = await startEditorsPromise

    const CSS = await cssPromise
    CSS.activate()

    const Snippets = await snippetPromise
    Snippets.activate(commandManager)

    Shell.Actions.setLoadingComplete()

    const Diagnostics = await diagnosticsPromise
    const diagnostics = Diagnostics.getInstance()

    const CompletionProviders = await completionProvidersPromise
    CompletionProviders.activate(languageManager)

    const initializeAllEditors = async () => {
        await startEditors(
            filesToOpen,
            Colors.getInstance(),
            CompletionProviders.getInstance(),
            configuration,
            diagnostics,
            languageManager,
            menuManager,
            overlayManager,
            pluginManager,
            Snippets.getInstance(),
            tasks,
            Themes.getThemeManagerInstance(),
            TokenColors.getInstance(),
            workspace,
        )

        await SharedNeovimInstance.activate(configuration, pluginManager)
    }

    await Promise.race([Utility.delay(5000), initializeAllEditors()])
    Performance.endMeasure("Oni.Start.Editors")

    Performance.startMeasure("Oni.Start.Sidebar")
    const Sidebar = await sidebarPromise
    const Explorer = await import("./Services/Explorer")
    const Search = await import("./Services/Search")

    Sidebar.activate(configuration, workspace)
    const sidebarManager = Sidebar.getInstance()

    Explorer.activate(commandManager, editorManager, Sidebar.getInstance(), workspace)
    Search.activate(commandManager, editorManager, Sidebar.getInstance(), workspace)
    Performance.endMeasure("Oni.Start.Sidebar")

    const createLanguageClientsFromConfiguration =
        LanguageManager.createLanguageClientsFromConfiguration

    diagnostics.start(languageManager)

    const Browser = await import("./Services/Browser")
    Browser.activate(commandManager, configuration, editorManager)

    Performance.startMeasure("Oni.Start.Activate")
    const api = pluginManager.startApi()
    configuration.activate(api)

    Snippets.activateCompletionProvider(CompletionProviders.getInstance(), pluginManager)

    createLanguageClientsFromConfiguration(configuration.getValues())

    const { inputManager } = await inputManagerPromise

    const autoClosingPairsPromise = import("./Services/AutoClosingPairs")

    const ConfigurationCommands = await configurationCommandsPromise
    ConfigurationCommands.activate(commandManager, configuration, editorManager)

    const AutoClosingPairs = await autoClosingPairsPromise
    AutoClosingPairs.activate(configuration, editorManager, inputManager, languageManager)

    const GlobalCommands = await globalCommandsPromise
    GlobalCommands.activate(commandManager, menuManager, tasks)

    const WorkspaceCommands = await workspaceCommandsPromise
    WorkspaceCommands.activateCommands(
        configuration,
        editorManager,
        Snippets.getInstance(),
        workspace,
    )

    const KeyDisplayer = await keyDisplayerPromise
    KeyDisplayer.activate(commandManager, inputManager, overlayManager)

    const ThemePicker = await themePickerPromise
    ThemePicker.activate(configuration, menuManager, Themes.getThemeManagerInstance())

    const Bookmarks = await import("./Services/Bookmarks")
    Bookmarks.activate(configuration, editorManager, Sidebar.getInstance())

    const PluginsSidebarPane = await import("./Plugins/PluginSidebarPane")
    PluginsSidebarPane.activate(configuration, pluginManager, sidebarManager)

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
