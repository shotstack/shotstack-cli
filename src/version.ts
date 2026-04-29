import pkg from "../package.json" with { type: "json" };

export const version: string = pkg.version;
export const userAgent = `shotstack-cli/${version} (${process.platform}-${process.arch})`;
