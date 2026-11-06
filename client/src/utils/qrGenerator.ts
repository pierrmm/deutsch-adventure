// Byte-mode QR encoder, error correction level M, versions 1-10. No network or packages.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256)
let value = 1
for (let i = 0; i < 255; i++) { EXP[i] = value; LOG[value] = i; value <<= 1; if (value & 256) value ^= 0x11d }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
const mul = (a: number, b: number) => a && b ? EXP[LOG[a] + LOG[b]] : 0
const generator = (degree: number) => {
  let poly = [1], root = 1
  for (let i = 0; i < degree; i++) { const next = Array(poly.length + 1).fill(0); poly.forEach((n, j) => { next[j] ^= n; next[j + 1] ^= mul(n, root) }); poly = next; root = mul(root, 2) }
  return poly
}
const ecc = (data: number[], degree: number) => {
  const result = [...data, ...Array(degree).fill(0)], gen = generator(degree)
  data.forEach((_, i) => { const factor = result[i]; if (factor) gen.forEach((n, j) => result[i + j] ^= mul(n, factor)) })
  return result.slice(data.length)
}
const BLOCKS: [number, number, number, number][] = [[1, 16, 10, 1], [1, 28, 16, 1], [1, 44, 26, 1], [2, 32, 18, 1], [2, 43, 24, 1], [4, 27, 16, 2], [4, 31, 18, 2], [4, 38, 22, 2], [5, 36, 22, 2], [5, 43, 26, 2]]
const append = (bits: number[], n: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((n >>> i) & 1) }

export function encodeQr(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  const version = BLOCKS.findIndex(([, data, , blocks], i) => bytes.length <= Math.floor((data * blocks * 8 - 12 - (i < 9 ? 0 : 4)) / 8)) + 1
  if (!version) throw new Error('QR text too long (maximum 213 bytes)')
  const [blockCount, dataEach, eccEach, shortBlocks] = BLOCKS[version - 1]
  const capacity = dataEach * blockCount
  const bits: number[] = []
  append(bits, 4, 4); append(bits, bytes.length, version < 10 ? 8 : 16); bytes.forEach((byte) => append(bits, byte, 8))
  append(bits, 0, Math.min(4, capacity * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => n * 2 + bit, 0))
  for (let pad = 0; data.length < capacity; pad++) data.push(pad % 2 ? 0x11 : 0xec)
  const shortLen = Math.floor(capacity / blockCount), blocks: number[][] = [], checks: number[][] = []
  let offset = 0
  for (let i = 0; i < blockCount; i++) { const length = shortLen + (i < shortBlocks ? 0 : 1), part = data.slice(offset, offset + length); offset += length; blocks.push(part); checks.push(ecc(part, eccEach)) }
  const codewords: number[] = []
  for (let i = 0; i < shortLen; i++) blocks.forEach((block) => codewords.push(block[i]))
  for (let i = 0; i < blockCount - shortBlocks; i++) codewords.push(blocks[shortBlocks + i][shortLen])
  for (let i = 0; i < eccEach; i++) checks.forEach((block) => codewords.push(block[i]))
  const size = 17 + 4 * version, matrix = Array.from({ length: size }, () => Array(size).fill(false)), fixed = Array.from({ length: size }, () => Array(size).fill(false))
  if (version >= 2) { const align = size - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixed[align + dy][align + dx] = true }
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = dark; fixed[y][x] = true } }
  const finder = (x: number, y: number) => { for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) { const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); set(x + dx, y + dy, d !== 2 && d <= 3) } }
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7)
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  if (version >= 2) { const align = size - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(align + dx, align + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1) }
  set(8, size - 8, true)
  if (version >= 7) for (let i = 0; i < 18; i++) { const bit = ((version >>> (i / 3)) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit); set(b, a, bit) }
  const allBits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1))
  let bitIndex = 0, upward = true
  for (let right = size - 1; right > 0; right -= 2) { if (right === 6) right--; for (let vert = 0; vert < size; vert++) { const y = upward ? size - 1 - vert : vert; for (let j = 0; j < 2; j++) { const x = right - j; if (!fixed[y][x]) { const raw = bitIndex < allBits.length ? allBits[bitIndex++] : 0; matrix[y][x] = Boolean(raw ^ Number((x + y) % 2 === 0)) } } } upward = !upward }
  const format = (mask: number) => { const dataBits = (0 << 3) | mask; let rem = dataBits << 10; for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10); return ((dataBits << 10) | rem) ^ 0x5412 }
  const fmt = format(0)
  for (let i = 0; i <= 5; i++) set(8, i, ((fmt >>> i) & 1) !== 0)
  set(8, 7, ((fmt >>> 6) & 1) !== 0); set(8, 8, ((fmt >>> 7) & 1) !== 0); set(7, 8, ((fmt >>> 8) & 1) !== 0)
  for (let i = 9; i < 15; i++) set(14 - i, 8, ((fmt >>> i) & 1) !== 0)
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, ((fmt >>> i) & 1) !== 0)
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, ((fmt >>> i) & 1) !== 0)
  set(8, size - 8, true)
  return matrix
}
