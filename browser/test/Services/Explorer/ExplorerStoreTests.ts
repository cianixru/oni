/**
 * ExplorerStoreTests.ts
 */

import * as assert from "assert"
import * as path from "path"

import { Store } from "redux"
import { MockStoreCreator } from "redux-mock-store"
import { ActionsObservable, combineEpics, createEpicMiddleware } from "redux-observable"

import * as ExplorerFileSystem from "./../../../src/Services/Explorer/ExplorerFileSystem"
import { ExplorerNode } from "./../../../src/Services/Explorer/ExplorerSelectors"
import * as ExplorerState from "./../../../src/Services/Explorer/ExplorerStore"
import { Notifications } from "./../../../src/Services/Notifications/Notifications"

import * as clone from "lodash/clone"
import * as head from "lodash/head"
import * as TestHelpers from "./../../TestHelpers"

const configureMockStore = require("redux-mock-store") // tslint:disable-line

export class MockedFileSystem implements ExplorerFileSystem.IFileSystem {
    public promises: Array<Promise<any>>

    constructor(private _inner: ExplorerFileSystem.IFileSystem) {
        this.promises = []
    }

    public readdir(directoryPath: string): Promise<ExplorerState.FolderOrFile[]> {
        const promise = this._inner.readdir(directoryPath)
        this.promises.push(promise)
        return promise
    }

    public exists(fullPath: string): Promise<boolean> {
        const promise = this._inner.exists(fullPath)
        this.promises.push(promise)
        return promise
    }

    public async canPersistNode() {
        return true
    }

    // tslint:disable
    public async restoreNode() {}
    public async persistNode() {}
    public async moveNodesBack(): Promise<void> {}
    public async deleteNode(): Promise<void> {}
    public async move(source: string, destination: string): Promise<void> {}
    public async writeFile(name: string): Promise<void> {}
    public async mkdir(name: string): Promise<void> {}
    // tslint:enable
}

const rootEpic = combineEpics(ExplorerState.clearYankRegisterEpic, ExplorerState.pasteEpic)

const epicMiddleware = createEpicMiddleware(rootEpic, {
    dependencies: {
        fileSystem: MockedFileSystem as any,
        notifications: {} as Notifications,
    },
})

const MemoryFileSystem = require("memory-fs") // tslint:disable-line
const mockStore: MockStoreCreator<ExplorerState.IExplorerState> = configureMockStore([
    epicMiddleware,
])

describe("ExplorerStore", () => {
    let fileSystem: any
    let store: Store<ExplorerState.IExplorerState>
    let explorerFileSystem: MockedFileSystem

    const rootPath = path.normalize(path.join(TestHelpers.getRootDirectory(), "a", "test", "dir"))
    const filePath = path.join(rootPath, "file.txt")
    const target = { filePath, id: "1" }
    const epicStore = mockStore({ ...ExplorerState.DefaultExplorerState })

    const pasted1 = {
        type: "file",
        filePath: "/test/dir/afile.txt",
        id: "1",
    }

    const target1 = {
        type: "folder",
        folderPath: "/test/dir/subdir/",
        id: "1",
    }

    const deleteAction = {
        type: "DELETE_SUCCESS",
        persist: true,
        path: "/test/dir",
        target: {
            type: "folder",
            folderPath: "/test/dir/subdir",
            id: "2",
            expanded: false,
            name: "subdir",
            indentationLevel: 2,
        },
    } as ExplorerState.IDeleteSuccessAction

    const pasteAction = {
        type: "PASTE",
        target: target1,
        pasted: [pasted1],
        sources: [pasted1],
    } as ExplorerState.IPasteAction

    beforeEach(() => {
        fileSystem = new MemoryFileSystem()
        fileSystem.mkdirpSync(rootPath)
        fileSystem.writeFileSync(filePath, "Hello World")

        explorerFileSystem = new MockedFileSystem(
            new ExplorerFileSystem.FileSystem(fileSystem as any),
        )
        store = ExplorerState.createStore({
            fileSystem: explorerFileSystem,
            notifications: {} as any,
        })
    })

    afterEach(() => {
        epicMiddleware.replaceEpic(rootEpic)
    })

    describe("SET_ROOT_DIRECTORY", () => {
        it("expands directory automatically", async () => {
            store.dispatch({
                type: "SET_ROOT_DIRECTORY",
                rootPath,
            })

            await TestHelpers.waitForAllAsyncOperations()
            TestHelpers.tick(0) // execute setImmediate of memory-fs callbacks
            await Promise.all(explorerFileSystem.promises)

            const state = store.getState()

            assert.deepEqual(
                state.expandedFolders[rootPath],
                [{ type: "file", fullPath: filePath }],
                "Validate expanded folders is set",
            )
        })
    })

    describe("YANK_AND_PASTE_EPICS", async () => {
        const fs = {
            move: async (source, dest) => null,
            readdir: () => null as any,
            exists: async file => true,
            persistNode: async file => null,
            restoreNode: async file => null,
            deleteNode: file => null,
            canPersistNode: async (file, size) => true,
            moveNodesBack: async collection => null,
            writeFile: async name => null,
            mkdir: async name => null,
        } as ExplorerFileSystem.IFileSystem

        const notifications = {
            _id: 0,
            _overlay: null,
            _overlayManager: null,
            _store: null,
            enable: true,
            disable: false,
            createItem: () => ({
                setContents: (title: string, details: string) => ({ title, details }),
                setLevel: (level: string) => ({ level }),
                setExpiration: (expirationTime: number) => ({ expirationTime: 8_000 }),
                show: () => ({}),
            }),
        } as any

        it("dispatches a clear register action after a minute", async () => {
            epicStore.dispatch({ type: "YANK", target })
            const actions = epicStore.getActions()
            await TestHelpers.waitForAllAsyncOperations()
            // three because an init action is sent first
            await assert.ok(actions.length === 3)
            const clearedRegister = !!actions.find(action => action.type === "CLEAR_REGISTER")
            assert.ok(clearedRegister)
        })

        it("should dispatch a paste success upon pasting successfully", done => {
            const action$ = ActionsObservable.of({
                type: "PASTE",
                target: target1,
                pasted: [pasted1],
                sources: [pasted1],
            } as ExplorerState.ExplorerAction)

            const expected = [
                { type: "CLEAR_REGISTER", ids: ["1"] },
                { type: "EXPAND_DIRECTORY", directoryPath: target1.folderPath },
                { type: "REFRESH" },
                {
                    type: "PASTE_SUCCESS",
                    moved: [
                        { destination: path.join(target1.folderPath, "afile.txt"), node: pasted1 },
                    ],
                },
            ]

            ExplorerState.pasteEpic(action$, null, {
                fileSystem: fs,
                notifications,
            })
                .toArray()
                .subscribe(actualActions => {
                    assert.ok(actualActions.find(action => action.type === "PASTE_SUCCESS"))
                    assert.deepEqual(actualActions, expected)
                    done()
                })
        })

        it("should correctly trigger a node deletion", () => {
            const action$ = ActionsObservable.of({
                type: "DELETE",
                target: target1,
                persist: true,
            } as ExplorerState.IDeleteAction)

            const expected = [
                { type: "DELETE_SUCCESS", target: target1, persist: true },
                { type: "REFRESH" },
            ]

            ExplorerState.deleteEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("should correctly dispatch a fail action if there is an error", () => {
            const action$ = ActionsObservable.of({
                type: "DELETE",
                target: target1,
                persist: true,
            } as ExplorerState.IDeleteAction)

            const expected = [{ type: "DELETE_FAIL", reason: "Doesnt work" }]

            ExplorerState.deleteEpic(action$, null, {
                fileSystem: {
                    ...fs,
                    persistNode: async node => {
                        throw new Error("Doesnt work")
                    },
                },
                notifications,
            })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should correctly trigger a move action on undo of paste", () => {
            const action$ = ActionsObservable.of({
                type: "UNDO",
            } as ExplorerState.ExplorerAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    undo: [pasteAction],
                },
            }

            const undoState = mockStore(state)
            const expected = [{ type: "UNDO_SUCCESS" }, { type: "REFRESH" }]

            ExplorerState.undoEpic(action$, undoState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should trigger an expand directory on undo if the original source is a directory", () => {
            const action$ = ActionsObservable.of({
                type: "UNDO",
            } as ExplorerState.ExplorerAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    undo: [{ ...pasteAction, sources: [target1] as ExplorerNode[] }],
                },
            }

            const undoState = mockStore(state)
            const expected = [
                { type: "UNDO_SUCCESS" },
                { type: "EXPAND_DIRECTORY", directoryPath: "/test/dir/subdir/" },
                { type: "REFRESH" },
            ]

            ExplorerState.undoEpic(action$, undoState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should trigger a restore action if the deleted note can be restored", () => {
            const action$ = ActionsObservable.of({
                type: "UNDO",
            } as ExplorerState.ExplorerAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    undo: [deleteAction],
                },
            }

            const undoState = mockStore(state)
            const expected = [
                { type: "UNDO_SUCCESS" },
                { type: "EXPAND_DIRECTORY", directoryPath: "/test/dir/subdir" },
                { type: "REFRESH" },
            ]

            ExplorerState.undoEpic(action$, undoState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should return a fail action if the node was truly deleted", () => {
            const action$ = ActionsObservable.of({
                type: "UNDO",
            } as ExplorerState.ExplorerAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    undo: [{ ...deleteAction, persist: false }],
                },
            }

            const undoState = mockStore(state)
            const expected = [
                {
                    type: "UNDO_FAIL",
                    reason: "The last deletion cannot be undone, sorry",
                } as ExplorerState.IUndoFailAction,
            ]

            ExplorerState.undoEpic(action$, undoState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should clear updates after a short interval", () => {
            const action$ = ActionsObservable.of(deleteAction)

            const expected = [
                {
                    type: "CLEAR_UPDATE",
                } as ExplorerState.IClearUpdateAction,
            ]

            ExplorerState.clearUpdateEpic(action$, null, {
                fileSystem: fs,
                notifications,
            })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should move an item when a rename is triggered", () => {
            const action$ = ActionsObservable.of({
                type: "RENAME_COMMIT",
                target: target1,
                newName: "testing",
            } as ExplorerState.IRenameCommitAction)

            const expected = [
                {
                    type: "RENAME_SUCCESS",
                    targetType: "folder",
                    source: target1.folderPath,
                    destination: path.join(path.dirname(target1.folderPath), "testing"),
                },
                { type: "REFRESH" },
            ]

            ExplorerState.renameEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => assert.deepEqual(actualActions, expected))
        })

        it("Should send a notification on paste success", () => {
            const action$ = ActionsObservable.of({
                type: "PASTE_SUCCESS",
                moved: [{ node: target1, destination: "/another/test/dir" }],
            } as ExplorerState.IPasteSuccessAction)

            const expected = [{ type: "NOTIFICATION_SENT", typeOfNotification: "PASTE_SUCCESS" }]

            ExplorerState.notificationEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualAction => assert.deepEqual(actualAction, expected))
        })

        it("Should send a notification on paste fail", () => {
            const action$ = ActionsObservable.of({
                type: "PASTE_FAIL",
            } as ExplorerState.IPasteFailAction)

            const expected = [{ type: "NOTIFICATION_SENT", typeOfNotification: "PASTE_FAIL" }]

            ExplorerState.notificationEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualAction => assert.deepEqual(actualAction, expected))
        })

        it("Should send a notification on rename success", () => {
            const action$ = ActionsObservable.of({
                type: "RENAME_SUCCESS",
                source: "/initial/test/dir",
                destination: "/destination/test/dir",
                targetType: "folder",
            } as ExplorerState.IRenameSuccessAction)

            const expected = [{ type: "NOTIFICATION_SENT", typeOfNotification: "RENAME_SUCCESS" }]

            ExplorerState.notificationEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualAction => assert.deepEqual(actualAction, expected))
        })

        it("Should send a notification on rename success", () => {
            const action$ = ActionsObservable.of({
                type: "RENAME_FAIL",
            } as ExplorerState.IRenameFailAction)

            const expected = [{ type: "NOTIFICATION_SENT", typeOfNotification: "RENAME_FAIL" }]

            ExplorerState.notificationEpic(action$, null, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualAction => assert.deepEqual(actualAction, expected))
        })

        it("Should return a create node success action if a creation is committed", () => {
            const action$ = ActionsObservable.of({
                type: "CREATE_NODE_COMMIT",
                name: "/test/dir/file.txt",
            } as ExplorerState.ICreateNodeCommitAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    create: {
                        active: true,
                        nodeType: "file" as "file" | "folder",
                        name: "/test/dir/file.txt",
                    },
                },
            }

            const createState = mockStore(state)

            const expected = [
                { type: "CREATE_NODE_SUCCESS", nodeType: "file", name: "/test/dir/file.txt" },
                { type: "EXPAND_DIRECTORY", directoryPath: "/test/dir" },
                { type: "REFRESH" },
            ]

            ExplorerState.createNodeEpic(action$, createState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => assert.deepEqual(actualActions, expected))
        })

        it("Should return an error action if a creation fails", () => {
            const action$ = ActionsObservable.of({
                type: "CREATE_NODE_COMMIT",
                name: "/test/dir/file.txt",
            } as ExplorerState.ICreateNodeCommitAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    create: {
                        active: true,
                        nodeType: "file" as "file" | "folder",
                        name: "/test/dir/file.txt",
                    },
                },
            }

            const createState = mockStore(state)

            const expected = [{ type: "CREATE_NODE_FAIL", reason: "Duplicate" }]

            ExplorerState.createNodeEpic(action$, createState, {
                fileSystem: {
                    ...fs,
                    writeFile: async folderpath => {
                        throw new Error("Duplicate")
                    },
                },
                notifications,
            })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })

        it("Should trigger a persist/delete action if the created node is undone", () => {
            const action$ = ActionsObservable.of({
                type: "UNDO",
            } as ExplorerState.ExplorerAction)

            const stateCopy = clone(ExplorerState.DefaultExplorerState)
            const state = {
                ...stateCopy,
                register: {
                    ...stateCopy.register,
                    undo: [
                        {
                            type: "CREATE_NODE_SUCCESS",
                            name: "/test/dir/file.txt",
                            nodeType: "file",
                        } as ExplorerState.ICreateNodeSuccessAction,
                    ],
                },
            }

            const undoState = mockStore(state)
            const expected = [{ type: "UNDO_SUCCESS" }, { type: "REFRESH" }]

            ExplorerState.undoEpic(action$, undoState, { fileSystem: fs, notifications })
                .toArray()
                .subscribe(actualActions => {
                    assert.deepEqual(actualActions, expected)
                })
        })
    })

    describe("Store utility helper tests", () => {
        it("Should not add an action if it isn't set to persist", () => {
            const testAction = {
                type: "DELETE_SUCCESS",
                persist: false,
                target: { id: "2", type: "file", filePath },
            } as ExplorerState.IDeleteSuccessAction
            const newState = ExplorerState.shouldAddDeletion(testAction)
            assert.ok(newState.length === 0 && Array.isArray(newState))
        })

        it("Should return an action if it is set to persist", () => {
            const testAction = {
                type: "DELETE_SUCCESS",
                persist: true,
                target: { id: "2", type: "file", filePath },
            } as ExplorerState.IDeleteSuccessAction
            const newState = ExplorerState.shouldAddDeletion(testAction)
            assert.deepEqual(head(newState), testAction)
        })
        describe("Register Reducer test", () => {
            const {
                yankRegisterReducer,
                DefaultExplorerState: { register },
            } = ExplorerState

            it("It should add paste items to both the paste and undo registers", () => {
                const newState = yankRegisterReducer(clone(register), pasteAction)
                assert.deepEqual(
                    newState.paste,
                    pasteAction.target,
                    "Paste is set to the node which was the target of the paste action",
                )
                assert.deepEqual(
                    head(newState.undo),
                    pasteAction,
                    "The paste action is saved in the undo queue",
                )
            })

            it("Should remove item from the end of the undo list following undo success", () => {
                const state = { ...register, undo: [pasteAction] }
                const action = { type: "UNDO_SUCCESS" }
                const newState = yankRegisterReducer(state, action)
                assert.ok(!newState.undo.length)
            })

            it("Adds a delete action to the undo register IF it can be persisted)", () => {
                const newState = yankRegisterReducer(clone(register), deleteAction)
                assert.deepEqual(head(newState.undo), deleteAction)
            })

            it("Does NOT Add a delete action to the undo register IF it can't be persisted)", () => {
                const newState = yankRegisterReducer(clone(register), {
                    ...deleteAction,
                    persist: false,
                })
                assert.ok(!newState.undo.length)
            })

            it("Should add a successful rename to undo register", () => {
                const newState = yankRegisterReducer(clone(register), {
                    type: "RENAME_SUCCESS",
                    destination: path.basename(target1.folderPath) + "/rename",
                    source: target1.folderPath,
                    targetType: "folder",
                })

                assert.ok(newState.undo.length === 1)
            })

            it("Should clear the renaming if a rename cancel action is triggered", () => {
                const state = {
                    ...clone(register),
                    rename: {
                        target: target1 as ExplorerNode,
                        active: true,
                    },
                }
                const newState = yankRegisterReducer(state, { type: "RENAME_CANCEL" })
                assert.ok(!newState.rename.active)
                assert.ok(!newState.rename.target)
            })
        })
    })
})
