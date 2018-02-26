/**
 * Hover.tsx
 */

import * as Oni from "oni-api"
import * as os from "os"
import * as React from "react"
import * as types from "vscode-languageserver-types"

import getTokens from "./../../Services/SyntaxHighlighting/TokenGenerator"
import { ErrorInfo } from "./../../UI/components/ErrorInfo"
import { QuickInfoDocumentation } from "./../../UI/components/QuickInfo"
import QuickInfoWithTheme from "./../../UI/components/QuickInfoContainer"

import * as Helpers from "./../../Plugins/Api/LanguageClient/LanguageClientHelpers"

import { IColors } from "./../../Services/Colors"
import { Configuration } from "./../../Services/Configuration"
import { convertMarkdown } from "./markdown"

import * as Selectors from "./NeovimEditorSelectors"
import { IToolTipsProvider } from "./ToolTipsProvider"

const HoverToolTipId = "hover-tool-tip"

export class HoverRenderer {
    constructor(
        private _colors: IColors,
        private _editor: Oni.Editor,
        private _configuration: Configuration,
        private _toolTipsProvider: IToolTipsProvider,
    ) {}

    public async showQuickInfo(
        x: number,
        y: number,
        hover: types.Hover,
        errors: types.Diagnostic[],
    ): Promise<void> {
        const elem = await this._renderQuickInfoElement(hover, errors)

        if (!elem) {
            return
        }

        this._toolTipsProvider.showToolTip(HoverToolTipId, elem, {
            position: { pixelX: x, pixelY: y },
            openDirection: 1,
            padding: "0px",
        })
    }

    public hideQuickInfo(): void {
        this._toolTipsProvider.hideToolTip(HoverToolTipId)
    }

    private async _renderQuickInfoElement(
        hover: types.Hover,
        errors: types.Diagnostic[],
    ): Promise<JSX.Element> {
        const titleAndContents = await getTitleAndContents(hover)
        const quickInfoElement = !!titleAndContents ? (
            <QuickInfoWithTheme titleAndContents={titleAndContents} key="quick-info-element" />
        ) : null

        const borderColor = this._colors.getColor("toolTip.border")

        let customErrorStyle = {}
        if (quickInfoElement) {
            // TODO:
            customErrorStyle = {
                "border-bottom": "1px solid " + borderColor,
            }
        }

        const errorElements = getErrorElements(errors, customErrorStyle)

        // Remove falsy values as check below [null] is truthy
        const elements = [...errorElements, quickInfoElement].filter(Boolean)

        if (this._configuration.getValue("editor.textMateHighlighting.debugScopes")) {
            elements.push(this._getDebugScopesElement())
        }

        if (!elements.length) {
            return null
        }

        return (
            <div className="quickinfo-container enable-mouse">
                <div className="quickinfo">
                    <div className="container horizontal center">
                        <div className="container full">{elements}</div>
                    </div>
                </div>
            </div>
        )
    }

    private _getDebugScopesElement(): JSX.Element {
        const editor: any = this._editor

        if (!editor || !editor.syntaxHighlighter) {
            return null
        }

        const cursor = editor.activeBuffer.cursor
        const scopeInfo = editor.syntaxHighlighter.getHighlightTokenAt(editor.activeBuffer.id, {
            line: cursor.line,
            character: cursor.column,
        })

        if (!scopeInfo || !scopeInfo.scopes) {
            return null
        }
        const items = scopeInfo.scopes.map((si: string) => <li>{si}</li>)
        return (
            <QuickInfoDocumentation key="quickInfo.debugScopes">
                <div>DEBUG: TextMate Scopes:</div>
                <ul>{items}</ul>
            </QuickInfoDocumentation>
        )
    }
}

const html = (str: string) => ({ __html: str })

const getErrorElements = (errors: types.Diagnostic[], style: any): JSX.Element[] => {
    if (!errors || !errors.length) {
        return Selectors.EmptyArray
    } else {
        return [<ErrorInfo errors={errors} style={style} key="quickInfo.errorInfo" />]
    }
}

const getTitleAndContents = async (result: types.Hover) => {
    if (!result || !result.contents) {
        return null
    }

    const contents = Helpers.getTextFromContents(result.contents)

    if (!contents.length) {
        return null
    }

    const [{ value: titleContent, language }, ...remaining] = contents

    if (!titleContent) {
        return null
    }

    const remainder = remaining.map(r => r.value)
    const [hasRemainder] = remainder

    if (!hasRemainder) {
        const tokensPerLine = await getTokens({ language, line: titleContent })

        return {
            title: html(convertMarkdown({ markdown: titleContent, tokens: tokensPerLine })),
            description: null,
        }
    } else {
        const descriptionContent = remainder.join(os.EOL)

        const tokensPerLine = await getTokens({ language, line: titleContent })

        return {
            title: html(convertMarkdown({ markdown: titleContent, tokens: tokensPerLine })),
            description: html(
                convertMarkdown({
                    markdown: descriptionContent,
                    type: "documentation",
                }),
            ),
        }
    }
}
