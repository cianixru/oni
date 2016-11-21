import * as os from "os"

const DefaultConfig: any = {
    // "debug.fixedSize": { rows: 10, columns: 100 }
    "debug.incrementalRenderRegions": false,

    "prototype.editor.backgroundOpacity": 0.5,

    "vim.loadVimPlugins": true,
    "oni.loadPlugins": true,

    "editor.fontSize": "14px",
    "editor.quickInfo.enabled": true,
    "editor.completions.enabled": true,
    "editor.errors.slideOnFocus": true,

}

const MacConfig: any = {
    "editor.fontFamily": "Monaco"
}

const WindowsConfig: any = {
    "editor.fontFamily": "Consolas"
}

const isMac = os.platform() === "darwin"

const DefaultPlatformConfig = isMac ? MacConfig : WindowsConfig

const Config = Object.assign({}, DefaultConfig, DefaultPlatformConfig);

export function hasValue(configValue: string): boolean {
    return !!getValue<any>(configValue)
}

export function getValue<T>(configValue: string): T {
    return Config[configValue]
}
