import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const script = path.resolve('tools/image_derivatives/build.mjs')

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'caos-image-derivative-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const source = path.join(directory, 'source.png')
  await sharp({
    create: { width: 16, height: 8, channels: 4, background: '#2255aaff' },
  }).png().toFile(source)
  return { directory, source }
}

test('gera um derivado WebP com proporcao preservada', async (t) => {
  const { directory, source } = await fixture(t)
  const output = path.join(directory, 'output.webp')
  const { stdout } = await execFileAsync(process.execPath, [
    script, '--source', source, '--output', output, '--width', '512', '--quality', '91',
  ])
  const result = JSON.parse(stdout)
  assert.equal(result.width, 512)
  assert.equal(result.height, 256)
  assert.equal(result.format, 'webp')
  assert.ok((await readFile(output)).byteLength > 0)
})

test('recusa argumento desconhecido e inteiro parcial', async (t) => {
  const { directory, source } = await fixture(t)
  const output = path.join(directory, 'output.webp')
  await assert.rejects(
    execFileAsync(process.execPath, [script, '--source', source, '--output', output, '--widht', '512']),
    /Argumento desconhecido: --widht/,
  )
  await assert.rejects(
    execFileAsync(process.execPath, [script, '--source', source, '--output', output, '--width', '512px']),
    /largura precisa ser um inteiro/,
  )
})

test('nao sobrescreve um derivado existente', async (t) => {
  const { directory, source } = await fixture(t)
  const output = path.join(directory, 'output.png')
  await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } })
    .png()
    .toFile(output)
  await assert.rejects(
    execFileAsync(process.execPath, [script, '--source', source, '--output', output, '--width', '512']),
    /destino ja existe/,
  )
})
