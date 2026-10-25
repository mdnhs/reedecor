declare module "draco3d" {
  export function createDecoderModule(options?: unknown): Promise<unknown>;
  export function createEncoderModule(options?: unknown): Promise<unknown>;
  const draco3d: {
    createDecoderModule: (options?: unknown) => Promise<unknown>;
    createEncoderModule: (options?: unknown) => Promise<unknown>;
  };
  export default draco3d;
}
