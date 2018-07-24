import * as Color from "color"
import * as styledComponents from "styled-components"
import { ThemedStyledComponentsModule } from "styled-components" // tslint:disable-line no-duplicate-imports
import { IThemeColors } from "../../Services/Themes/ThemeManager"

export const bufferScrollBarSize = "7px"

const {
    default: styled,
    css,
    injectGlobal,
    keyframes,
    withTheme,
    ThemeProvider,
} = (styledComponents as ThemedStyledComponentsModule<any>) as ThemedStyledComponentsModule<
    IThemeColors
>

export type Css = styledComponents.InterpolationValue[] | styledComponents.Styles[]

type FlexDirection = "flex-start" | "flex-end" | "center" | "space-between"

export interface ContainerProps {
    direction: "horizontal" | "vertical"
    fullHeight?: boolean
    fullWidth?: boolean
    extension?: Css
    justify?: FlexDirection
    alignment?: FlexDirection
}

export const Fixed = styled.div`
    flex: 0 0 auto;
`

export const Full = styled.div`
    flex: 1 1 auto;
`

export const Container = withProps<ContainerProps>(styled.div)`
    display: flex;
    flex-direction: ${p => (p.direction === "vertical" ? "column" : "row")};
    ${p => (p.fullHeight ? "height: 100%" : "")};
    ${p => (p.fullWidth ? "width: 100%" : "")};
    ${p => (p.justify ? p.justify : "")};
    ${p => (p.alignment ? p.alignment : "")}
    ${p => p.extension};
`

export const Bold = styled.span`
    font-weight: bold;
`

export const Center = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`

export const stack = css`
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    bottom: 0px;
`

export const layer = css`
    will-change: transform;
`

export const StackLayer = styled<{ zIndex?: number | string }, "div">("div")`
    ${stack};
    ${layer};
    ${p => p.zIndex && `z-index: ${p.zIndex}`};
`

export const sidebarItemSelected = css`
    border: ${(p: any) =>
        p.isSelected && `1px solid ${p.theme["highlight.mode.normal.background"]}`};
`

export type StyledFunction<T> = styledComponents.ThemedStyledFunction<T, IThemeColors>

export function withProps<T, U extends HTMLElement = HTMLElement>(
    styledFunction: StyledFunction<React.HTMLProps<U>>,
): StyledFunction<T & React.HTMLProps<U>> {
    return styledFunction
}

export const pixel = (v: string | number): string => `${v}px`

const darken = (c: string, deg = 0.15) =>
    Color(c)
        .darken(deg)
        .hex()
        .toString()

const lighten = (c: string, deg = 0.25) =>
    Color(c)
        .lighten(deg)
        .hex()

const boxShadow = css`
    box-shadow: 0 4px 8px 2px rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
`

const boxShadowInset = css`
    box-shadow: inset 0 4px 8px 2px rgba(0, 0, 0, 0.2);
`

const enableMouse = css`
    pointer-events: auto;
`

export const OverlayWrapper = styled.div`
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    bottom: 0px;
`
const tint = (base: string, mix: string, degree: number = 0.1) =>
    Color(base)
        .mix(Color(mix), 0.3)
        .toString()

const fontSizeSmall = `font-size: 0.9em;`

const fallBackFonts = `
    Consolas,
    Menlo,
    Monaco,
    Lucida Console,
    Liberation Mono,
    DejaVu Sans Mono,
    Bitstream Vera Sans Mono,
    Courier New,
    monospace,
    sans-serif
`.trim()

export {
    css,
    injectGlobal,
    keyframes,
    styled,
    ThemeProvider,
    withTheme,
    tint,
    boxShadow,
    boxShadowInset,
    enableMouse,
    fontSizeSmall,
    fallBackFonts,
    darken,
    lighten,
    IThemeColors,
}

export default styled
