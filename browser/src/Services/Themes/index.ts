export * from "./ThemeManager"

import { PluginManager } from "./../../Plugins/PluginManager"

import { Configuration, IConfigurationValues } from "./../Configuration"
import { activateThemes, getThemeManagerInstance } from "./ThemeManager"

export const activate = async (configuration: Configuration, pluginManager: PluginManager): Promise<void> => {

    activateThemes(pluginManager)

    const updateColorScheme = async (configurationValues: Partial<IConfigurationValues>): Promise<void> => {
        const colorscheme = configurationValues["ui.colorscheme"]
        if (colorscheme) {
            const themeManager = getThemeManagerInstance()
            await themeManager.setTheme(colorscheme)
        }
    }

    configuration.onConfigurationChanged.subscribe((newValues: Partial<IConfigurationValues>) => {
        updateColorScheme(newValues)
    })

    await updateColorScheme(configuration.getValues())
}
