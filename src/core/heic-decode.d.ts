declare module 'heic-decode' {
  interface DecodedImage {
    width: number
    height: number
    data: Uint8ClampedArray
  }
  export default function decode(options: { buffer: ArrayBufferLike | Uint8Array }): Promise<DecodedImage>
}
