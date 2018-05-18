import * as assert from "assert"

import { getRecentKeyPresses, InputManager, KeyPressInfo } from "./../../src/Services/InputManager"

describe("InputManager", () => {
    describe("bind", () => {
        it("adds a key handler", () => {
            const im = new InputManager()

            let count = 0
            im.bind("<c-a>", () => {
                count++
                return true
            })

            const handled = im.handleKey("<c-a>")

            assert.strictEqual(count, 1, "Validate handler was called")
            assert.strictEqual(handled, true)
        })

        it("removes key handler when calling dispose", () => {
            const im = new InputManager()

            let count = 0
            const dispose = im.bind("<c-a>", () => {
                count++
                return true
            })
            dispose()

            const handled = im.handleKey("<c-a>")

            assert.strictEqual(count, 0, "Handler should not have been called")
            assert.strictEqual(handled, false)
        })

        it("dispose key handler is robust if unbindAll was called first", () => {
            const im = new InputManager()

            let count = 0
            const dispose = im.bind("{", () => {
                count++
                return true
            })

            im.unbindAll()

            dispose()

            const handled = im.handleKey("{")
            assert.strictEqual(count, 0, "Handler should not have been called.")
            assert.strictEqual(handled, false)
        })

        it("can unbind an array of keys", () => {
            const im = new InputManager()
            im.bind(["a", "b"], "test.command")
            im.unbind(["a", "b"])

            const boundKeys = im.getBoundKeys("test.command")
            assert.deepEqual(boundKeys, [], "Validate no bound keys are returned")
        })

        describe("getBoundKeys", () => {
            it("returns empty array if no key bound to command", () => {
                const im = new InputManager()

                const boundKeys = im.getBoundKeys("test.command")
                assert.deepEqual(boundKeys, [], "Validate no keys bound")
            })

            it("returns key bound to command", () => {
                const im = new InputManager()
                im.bind("<c-a>", "test.command")

                const boundKeys = im.getBoundKeys("test.command")
                assert.deepEqual(boundKeys, ["<c-a>"], "Validate the bound key is returned")
            })

            it("does not return key if bound and then unbind", () => {
                const im = new InputManager()
                const unbind = im.bind("<c-a>", "test.command")

                unbind()

                const boundKeys = im.getBoundKeys("test.command")
                assert.deepEqual(boundKeys, [], "Validate no bound keys are returned")
            })
        })
    })

    describe("handleKey", () => {
        it("handles chorded inputs", () => {
            const im = new InputManager()

            let hitCount: number = 0
            im.bind("gg", () => {
                hitCount++
                return true
            })

            im.handleKey("g", 1)
            im.handleKey("g", 2)

            assert.strictEqual(hitCount, 1, "Validate the binding for gg was executed")
        })

        it("doesn't dispatch action if time expires between key presses", () => {
            const im = new InputManager()

            let hitCount: number = 0
            im.bind("gg", () => {
                hitCount++
                return true
            })

            im.handleKey("g", 1)
            im.handleKey("g", 1000)

            assert.strictEqual(hitCount, 0, "Validate the binding was not executed")
        })

        it("doesn't re-dispatch if key was null", () => {
            const im = new InputManager()
            let hitCount: number = 0
            im.bind("[", () => {
                hitCount++
                return true
            })

            im.handleKey("[", 1)

            // For control keys like 'shift', we get a null value passed
            // to the key-chord logic.
            im.handleKey(null, 2)

            assert.strictEqual(hitCount, 1, "Verify handler was only hit once")
        })
    })

    describe("getRecentKeyPresses", () => {
        const createKeyPressInfo = (keyChord: string, time: number): KeyPressInfo => ({
            keyChord,
            time,
        })
        it("collapses keypress info per the delay", () => {
            const key1 = createKeyPressInfo("a", 1)
            const key2 = createKeyPressInfo("b", 2)
            const key3 = createKeyPressInfo("c", 103)
            const key4 = createKeyPressInfo("d", 104)

            const items = getRecentKeyPresses([key1, key2, key3, key4], 100)

            assert.deepEqual(items, [key3, key4], "Validate the correct items remain")
        })
    })
})
