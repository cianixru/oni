import * as fs from "fs"
import * as path from "path"

import * as Oni from "oni-api"

import { Configuration, getUserConfigFolderPath } from "./../Services/Configuration"

import { AnonymousPlugin } from "./AnonymousPlugin"
import { Plugin } from "./Plugin"

const corePluginsRoot = path.join(__dirname, "vim", "core")
const defaultPluginsRoot = path.join(__dirname, "vim", "default")
const extensionsRoot = path.join(__dirname, "extensions")

export class PluginManager implements Oni.IPluginManager {
    private _rootPluginPaths: string[] = []
    private _plugins: Plugin[] = []
    private _anonymousPlugin: AnonymousPlugin
    private _pluginsActivated: boolean = false

    public get plugins(): Plugin[] {
        return this._plugins
    }

    constructor(private _config: Configuration) {}

    public discoverPlugins(): void {
        const corePluginRootPaths: string[] = [corePluginsRoot, extensionsRoot]
        const corePlugins: Plugin[] = this._getAllPluginPaths(corePluginRootPaths).map(p =>
            this._createPlugin(p, "core"),
        )

        let defaultPluginRootPaths: string[] = []
        let defaultPlugins: Plugin[] = []
        if (this._config.getValue("oni.useDefaultConfig")) {
            defaultPluginRootPaths = [defaultPluginsRoot, path.join(defaultPluginsRoot, "bundle")]

            defaultPlugins = this._getAllPluginPaths(defaultPluginRootPaths).map(p =>
                this._createPlugin(p, "default"),
            )
        }

        const userPluginsRootPath = [path.join(getUserConfigFolderPath(), "plugins")]
        const userPlugins = this._getAllPluginPaths(userPluginsRootPath).map(p =>
            this._createPlugin(p, "user"),
        )

        this._rootPluginPaths = [
            ...corePluginRootPaths,
            ...defaultPluginRootPaths,
            ...userPluginsRootPath,
        ]
        this._plugins = [...corePlugins, ...defaultPlugins, ...userPlugins]

        this._anonymousPlugin = new AnonymousPlugin()
    }

    public startApi(): Oni.Plugin.Api {
        this._plugins.forEach(plugin => {
            plugin.activate()
        })

        this._pluginsActivated = true

        return this._anonymousPlugin.oni
    }

    public getAllRuntimePaths(): string[] {
        const pluginPaths = this._getAllPluginPaths(this._rootPluginPaths)

        return pluginPaths.concat(this._rootPluginPaths)
    }

    public get loaded(): boolean {
        return this._pluginsActivated
    }

    public getPlugin(name: string): any {
        for (const plugin of this._plugins) {
            if (plugin.name === name) {
                return plugin.instance
            }
        }
        return null
    }

    private _createPlugin(pluginRootDirectory: string, source: string): Plugin {
        return new Plugin(pluginRootDirectory, source)
    }

    private _getAllPluginPaths(rootPluginPaths: string[]): string[] {
        const paths: string[] = []
        rootPluginPaths.forEach(rp => {
            const subPaths = getDirectories(rp)
            paths.push(...subPaths)
        })

        return paths
    }
}

let _pluginManager: PluginManager = null

export const activate = (configuration: Configuration): void => {
    _pluginManager = new PluginManager(configuration)
}

export const getInstance = (): PluginManager => _pluginManager

function getDirectories(rootPath: string): string[] {
    if (!fs.existsSync(rootPath)) {
        return []
    }

    return fs
        .readdirSync(rootPath)
        .map(f => path.join(rootPath.toString(), f))
        .filter(f => fs.statSync(f).isDirectory())
}
