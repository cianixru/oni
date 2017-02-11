const electron = require('electron')
const path = require("path")
// Module to control application life.
const defaultMenu = require('electron-default-menu');
const { Menu, app, shell, dialog } = electron;
const os = require('os');

const ipcMain = electron.ipcMain

const isDevelopment = process.env.NODE_ENV === "development" 

const isVerbose = process.argv.filter(arg => arg.indexOf("--verbose") >= 0).length > 0
const isDebug = process.argv.filter(arg => arg.indexOf("--debug") >= 0).length >0

// import * as derp from "./installDevTools"

if (isDebug || isDevelopment) {
    require("./installDevTools")
}

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const webContents = electron.webContents

ipcMain.on("cross-browser-ipc", (event, arg) => {
    const destinationId = arg.meta.destinationId
    const destinationWebContents = webContents.fromId(destinationId)

    log(`sending message to destinationId: ${destinationId}`)
    destinationWebContents.send("cross-browser-ipc", arg)
})

ipcMain.on("focus-next-instance", () => {
    log("focus-next-instance")
    focusNextInstance(1)
})

ipcMain.on("focus-previous-instance", () => {
    log("focus-previous-instance")
    focusNextInstance(-1)
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let windows = []

// Only enable 'single-instance' mode when we're not in the hot-reload mode
// Otherwise, all other open instances will also pick up the webpack bundle
if (!isDevelopment && !isDebug) {
    const shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        createWindow(commandLine.slice(2), workingDirectory)
    })

    if (shouldQuit) {
        app.quit()
    }
}

function createWindow(commandLineArguments, workingDirectory) {
    log(`Creating window with arguments: ${commandLineArguments} and working directory: ${workingDirectory}`)

    // Create the browser window.
    let mainWindow = new BrowserWindow({ width: 800, height: 600, icon: path.join(__dirname, "images", "Oni_128.png") })
    let menu = defaultMenu(app, shell);

    let firstMenu = os.platform() == "win32" ? 'File' : 'Oni';
    menu.unshift({
        label: firstMenu,
        submenu: [
            {
                label: 'Quit',
                click: (item, focusedWindow) => {
                    app.quit()
                }
            }
        ]
    })

    menu[1].submenu = [
       {
           label: 'Undo',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", "u")
           }
       },
       {
           label: 'Redo',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", "\\<C-r>")
           }
       },
       {
           label: 'Repeat',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", ".")
           }
       },
       {
           type: 'separator'
       },
       {
           label: 'Cut',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", '\\"+x')
           }
       },
       {
           label: 'Copy',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", '\\"+y')
           }
       },
       {
           label: 'Paste',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", '\\"+gP')
           }
       },
       {
           label: 'Put Before',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", "[p")
           }
       },
       {
           label: 'Put After',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", "]p")
           }
       },
       {
           label: 'Select All',
           click: (item, focusedWindow) => {
               mainWindow.webContents.send("menu-item-click", "ggVG")
           }
       },
    ]

    menu[4].submenu = [
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
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.send("init", {
            args: commandLineArguments,
            workingDirectory: workingDirectory
        })
    })

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/index.html`)

    // Open the DevTools.
    if (process.env.NODE_ENV === "development")
        mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        windows = windows.filter(m => m !== mainWindow)
        mainWindow = null

    })

    windows.push(mainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow(process.argv.slice(2), process.cwd())
})

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windows.length === 0) {
        createWindow()
    }
})

function focusNextInstance(direction) {
    const currentFocusedWindows = windows.filter(f => f.isFocused())

    if (currentFocusedWindows.length === 0) {
        log("No window currently focused")
        return
    }

    const currentFocusedWindow = currentFocusedWindows[0]
    const currentWindowIdx = windows.indexOf(currentFocusedWindow)
    let newFocusWindowIdx = (currentWindowIdx + direction) % windows.length

    if (newFocusWindowIdx < 0)
        newFocusWindowIdx = windows.length - 1

    log(`Focusing index: ${newFocusWindowIdx}`)
    windows[newFocusWindowIdx].focus()
}

function log(message) {
    if (isVerbose) {
        console.log(message)
    }
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
