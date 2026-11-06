declare module 'howler' {
  export class Howl {
    constructor(options: { src: string[]; preload?: boolean; volume?: number })
    loop(enabled: boolean): this
    play(): number
    stop(): this
    volume(value: number): this
  }
}
