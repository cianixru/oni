/**
 * CSS.ts
 *
 * Entry point for loading all of Oni's CSS
 */

export const activate = () => {
    require("./overlay.less") // tslint:disable-line

    require("./Services/ContextMenu/ContextMenu.less") // tslint:disable-line

    require("./Services/Explorer/Explorer.less") // tslint:disable-line
    require("./Services/Menu/Menu.less")
    require("./Services/Sidebar/Sidebar.less")

    require("./UI/components/Error.less")
    require("./UI/components/InstallHelp.less")
    require("./UI/components/QuickInfo.less")
    require("./UI/components/StatusBar.less")
    require("./UI/components/Tabs.less")
}
