/**
 * DefaultConfiguration.ts
 *
 * Specifies Oni default settings
 */

import * as os from "os"
import * as path from "path"

import * as Platform from "./../../Platform"

import { IConfigurationValues } from "./IConfigurationValues"

const noop = () => { } // tslint:disable-line no-empty

const BaseConfiguration: IConfigurationValues = {
    activate: noop,
    deactivate: noop,

    "debug.fixedSize": null,
    "debug.neovimPath": null,

    "oni.audio.bellUrl": path.join(__dirname, "audio", "beep.wav"),

    "oni.useDefaultConfig": true,

    "oni.loadInitVim": false,

    "oni.useExternalPopupMenu": true,

    "oni.hideMenu": false,

    "oni.exclude": ["**/node_modules/**"],
    "oni.bookmarks": [],

    "editor.backgroundOpacity": 1.0,
    "editor.backgroundImageUrl": null,
    "editor.backgroundImageSize": "cover",

    "editor.clipboard.enabled": true,

    "editor.quickInfo.enabled": true,
    "editor.quickInfo.delay": 500,

    "editor.completions.enabled": true,
    "editor.errors.slideOnFocus": true,
    "editor.formatting.formatOnSwitchToNormalMode": false,

    "editor.fontLigatures": true,
    "editor.fontSize": "12px",
    "editor.fontFamily": "",

    "editor.linePadding": 2,

    "editor.quickOpen.execCommand": null,

    "editor.scrollBar.visible": true,

    "editor.fullScreenOnStart": false,

    "editor.cursorLine": true,
    "editor.cursorLineOpacity": 0.1,

    "editor.cursorColumn": false,
    "editor.cursorColumnOpacity": 0.1,

    "environment.additionalPaths": [],

    "recorder.copyScreenshotToClipboard": false,
    "recorder.outputPath": os.tmpdir(),

    "statusbar.enabled": true,
    "statusbar.fontSize": "0.9em",

    "tabs.enabled": true,
    "tabs.showVimTabs": false,
}

const MacConfigOverrides: Partial<IConfigurationValues> = {
    "editor.fontFamily": "Menlo",
    "environment.additionalPaths": [
        "/usr/bin",
        "/usr/local/bin",
    ],
}

const WindowsConfigOverrides: Partial<IConfigurationValues> = {
    "editor.fontFamily": "Consolas",
}

const LinuxConfigOverrides: Partial<IConfigurationValues> = {
    "editor.fontFamily": "DejaVu Sans Mono",
    "environment.additionalPaths": [
        "/usr/bin",
        "/usr/local/bin",
    ],
}

const PlatformConfigOverride = Platform.isWindows() ? WindowsConfigOverrides : Platform.isLinux() ? LinuxConfigOverrides : MacConfigOverrides

export const DefaultConfiguration = {
    ...BaseConfiguration,
    ...PlatformConfigOverride,
}
