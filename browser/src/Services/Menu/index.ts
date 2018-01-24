export * from "./Menu"
export * from "./MenuComponent"
export * from "./MenuFilter"

import { OverlayManager } from "./../Overlay"
import { MenuManager } from "./Menu"

let _menuManager: MenuManager

export const activate = (overlayManager: OverlayManager) => {
    _menuManager = new MenuManager(overlayManager)
}

export const getInstance = (): MenuManager => {
    return _menuManager
}
