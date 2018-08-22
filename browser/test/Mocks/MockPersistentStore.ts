/**
 * MockPersistentStore.ts
 */

import { IPersistentStore } from "./../../src/PersistentStore"

export class MockPersistentStore<T> implements IPersistentStore<T> {
    private _state: T

    constructor(initialState: T) {
        this._state = initialState
    }

    public async set(state: T): Promise<void> {
        this._state = state
    }

    public async get(): Promise<T> {
        return this._state
    }

    public async delete(key: string): Promise<T> {
        this._state[key] = undefined
        return this._state
    }

    public has(key: string) {
        return !!this._state[key]
    }
}
