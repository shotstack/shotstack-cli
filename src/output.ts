export type OutputFormat = "text" | "json";

export function parseOutputFormat(value: unknown): OutputFormat {
  if (value === "json") return "json";
  return "text";
}

export function emit(format: OutputFormat, data: unknown, humanLine: string): void {
  if (format === "json") {
    console.log(JSON.stringify(data));
  } else {
    console.log(humanLine);
  }
}
