declare module "heic-convert" {
  type Options = {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };
  export default function convert(options: Options): Promise<Uint8Array>;
}
