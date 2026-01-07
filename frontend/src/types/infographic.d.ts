/**
 * AntV Infographic 类型声明
 */

declare module "@antv/infographic" {
  export interface InfographicConfig {
    container: string | HTMLElement;
    width?: string | number;
    height?: string | number;
    editable?: boolean;
  }

  export class Infographic {
    constructor(config: InfographicConfig);

    render(dsl: string): void;

    toDataURL(options?: { type?: "svg" | "png" }): Promise<string>;
  }

  export function registerResourceLoader(
    loader: (config: { data: string; scene: string }) => Promise<any | null>,
  ): void;

  export function loadSVGResource(svgText: string): any;
}

declare global {
  interface Window {
    AntVInfographic?: typeof import("@antv/infographic");
  }
}
