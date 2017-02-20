const electron = require('electron')
const os = require('os')

// Module to control application life.
const defaultMenu = require('electron-default-menu');
const { Menu, app, shell, dialog } = electron;


const buildMenu = (mainWindow) => {
    let menu = []

    const executeVimCommand = (command) => mainWindow.webContents.send("menu-item-click", command)

    const executeOniCommand = (command) => mainWindow.webContents.send("execute-command", command)

    let firstMenu = os.platform() == "win32" ? 'File' : 'Oni';
    menu.unshift({
        label: firstMenu,
        submenu: [
            {
                label: 'Open...',
                click: (item, focusedWindow) => {
                    dialog.showOpenDialog(mainWindow, ['openFile'], (name) => {
                        if (name) {
                            executeVimCommand(":e " + name)
                        }
                    })
                }
            },
            {
                label: 'Split Open...',
                click: (item, focusedWindow) => {
                    dialog.showOpenDialog(mainWindow, ['openFile'], (name) => {
                        if (name) {
                            executeVimCommand(":sp " + name)
                        }
                    })
                }
            },
            {
                label: 'Tab Open...',
                click: (item, focusedWindow) => {
                    dialog.showOpenDialog(mainWindow, ['openFile'], (name) => {
                        if (name) {
                            executeVimCommand(":tabnew " + name)
                        }
                    })
                }
            },
            {
                label: 'New',
                click: (item, focusedWindow) => executeVimCommand(":enew")
            },
            {
                label: 'Close',
                click: (item, focusedWindow) => executeVimCommand(":close")
            },
            {
                type: 'separator'
            },
            {
                label: 'Preferences',
                submenu: [
                {
                    label: "Edit configuration",
                    click: () => executeOniCommand("oni.config.openConfigJs")
                },
                {
                    label: "Edit NeoVim configuration",
                    click: () => executeOniCommand("oni.config.openInitVim")
                }
                ]
            },
            {
                type: 'separator'
            },
            {
                label: 'Save',
                click: (item, focusedWindow) => executeVimCommand(":w")
            },
            {
                label: 'Save As...',
                click: (item, focusedWindow) => {
                    dialog.showSaveDialog(mainWindow, {}, (name) => {
                        if (name) {
                            executeVimCommand(":save " + name)
                        }
                    })
                }
            },
            {
                label: 'Save All',
                click: (item, focusedWindow) => executeVimCommand(":wall")
            },
            {
                type: 'separator'
            },
            {
                label: 'Quit',
                click: (item, focusedWindow) => {
                    app.quit()
                }
            }
        ]
    })

    // Edit menu
    menu.push({
        label: "Edit",
        submenu:  [

       {
           label: 'Undo',
           click: (item, focusedWindow) => executeVimCommand("u")
       },
       {
           label: 'Redo',
           click: (item, focusedWindow) => executeVimCommand("\\<C-r>")
       },
       {
           label: 'Repeat',
           click: (item, focusedWindow) => executeVimCommand(".")
       },
       {
           type: 'separator'
       },
       {
           label: 'Cut',
           click: (item, focusedWindow) => executeVimCommand('\\"+x')
       },
       {
           label: 'Copy',
           click: (item, focusedWindow) => executeVimCommand('\\"+y')
       },
       {
           label: 'Paste',
           click: (item, focusedWindow) => executeVimCommand('\\"+gP')
       },
       {
           label: 'Paste Line Before',
           click: (item, focusedWindow) => executeVimCommand("[p")
       },
       {
           label: 'Paste Line After',
           click: (item, focusedWindow) => executeVimCommand("]p")
       },
       {
           label: 'Select All',
           click: (item, focusedWindow) => executeVimCommand("ggVG")
       }
    ]})

    // Window menu
    menu.push({

        label:  'Split',
    submenu : [
        {
           label: 'New Horizontal Split',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>n")
        },
        {
           label: 'Split File Horizontally',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>s")
        },
        {
           label: 'Split File Vertically',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>v")
        },
        {
           label: 'File Explorer Split',
           click: (item, focusedWindow) => executeVimCommand(":Lexplore | vertical resize 30")
        },
        {
            type: 'separator'
        },
        {
           label: 'Close',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>c")
        },
        {
           label: 'Close Other Split(s)',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>o")
        },
        {
            type: 'separator'
        },
        {
           label: 'Move To',
           submenu: [
           {
                label: 'Top',
                click: (item, focusedWindow) => executeVimCommand("\\<C-w>K")
            },
            {
                label: 'Bottom',
                click: (item, focusedWindow) => executeVimCommand("\\<C-w>J")
            },
            {
                label: 'Left Side',
                click: (item, focusedWindow) => executeVimCommand("\\<C-w>H")
            },
            {
                label: 'Right Side',
                click: (item, focusedWindow) => executeVimCommand("\\<C-w>L")
            }]
        },
        {
           label: 'Rotate Up',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>R")
        },
        {
           label: 'Rotate Down',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>r")
        },
        {
            type: 'separator'
        },
        {
           label: 'Equal Size',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>=")
        },
        {
           label: 'Max Height',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>_")
        },
        {
           label: 'Min Height',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>1_")
        },
        {
           label: 'Max Width',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>|")
        },
        {
           label: 'Min Width',
           click: (item, focusedWindow) => executeVimCommand("\\<C-w>1|")
        }
    ]})

    menu.push({
        label: "Develop",
        submenu: [
            {
                label: 'Open DevTools',
                click: () => executeOniCommand('oni.debug.openDevTools')
            }
        ]})

    // Help menu
    menu.push({
        label: "Help",
        submenu: [
        {
            label: 'Learn more',
            click: (item, focusedWindow) => {
                shell.openExternal('https://github.com/extr0py/oni#introduction');
            }
        },
        {
            label: 'Issues',
            click: (item, focusedWindow) => {
                shell.openExternal('https://github.com/extr0py/oni/issues');
            }
        },
        {
            label: 'Github',
            click: (item, focusedWindow) => {
                shell.openExternal('https://github.com/extr0py/oni');
            }
        }
    ]})

    return Menu.buildFromTemplate(menu)
}

module.exports = {
    buildMenu: buildMenu
}
