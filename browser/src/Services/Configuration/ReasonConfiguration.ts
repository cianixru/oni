/**
 * ReasonConfiguration.ts
 *
 * Settings for ocaml / reason language server
 */

import * as path from "path"

import * as Platform from "./../../Platform"

export const ocamlLanguageServerPath = path.join(
    __dirname,
    "node_modules",
    "ocaml-language-server",
    "bin",
    "server",
    "index.js",
)

// If Windows, wrap in `bash -ic` to support WSL
const wrapCommand = Platform.isWindows() ? (str: string) => "bash -ic " + str : (str: string) => str

export const ocamlAndReasonConfiguration = {
    reason: {
        codelens: {
            enabled: true,
            unicode: true,
        },
        bsb: {
            enabled: true,
        },
        debounce: {
            linter: 500,
        },
        diagnostics: {
            tools: ["bsb", "merlin"],
        },
        path: {
            bsb: wrapCommand("bsb"),
            ocamlfind: wrapCommand("ocamlfind"),
            ocamlmerlin: wrapCommand("ocamlmerlin"),
            opam: wrapCommand("opam"),
            rebuild: wrapCommand("rebuild"),
            refmt: wrapCommand("refmt"),
            refmterr: wrapCommand("refmterr"),
            rtop: wrapCommand("rtop"),
        },
    },
}
