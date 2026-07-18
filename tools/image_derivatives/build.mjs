import { createHash } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const SUPPORTED_OUTPUTS = new Set(['.png', '.webp'])
const SUPPORTED_ARGUMENTS = new Set(['source', 'output', 'width', 'quality'])
const MAX_DIMENSION = 8192

function fail(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  if (argv.length % 2 !== 0) {
    fail('Use --source, --output, --width e opcionalmente --quality.')
  }

  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) {
      fail('Use --source, --output, --width e opcionalmente --quality.')
    }
    const name = key.slice(2)
    if (!SUPPORTED_ARGUMENTS.has(name)) {
      fail(`Argumento desconhecido: --${name}`)
    }
    if (values.has(name)) {
      fail(`Argumento repetido: --${name}`)
    }
    values.set(name, value)
  }

  const widthText = values.get('width') ?? '3136'
  const qualityText = values.get('quality') ?? '94'
  if (!/^\d+$/.test(widthText)) {
    fail('A largura precisa ser um inteiro entre 512 e 8192.')
  }
  if (!/^\d+$/.test(qualityText)) {
    fail('A qualidade precisa ser um inteiro entre 1 e 100.')
  }
  const width = Number(widthText)
  const quality = Number(qualityText)
  if (!Number.isSafeInteger(width) || width < 512 || width > MAX_DIMENSION) {
    fail('A largura precisa ser um inteiro entre 512 e 8192.')
  }
  if (!Number.isSafeInteger(quality) || quality < 1 || quality > 100) {
    fail('A qualidade precisa ser um inteiro entre 1 e 100.')
  }

  return {
    source: values.get('source'),
    output: values.get('output'),
    width,
    quality,
  }
}

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function sha256(filePath) {
  const digest = createHash('sha256')
  digest.update(await readFile(filePath))
  return digest.digest('hex')
}

function fileSignature(fileStat) {
  return [
    fileStat.dev,
    fileStat.ino,
    fileStat.size,
    fileStat.mtimeMs,
  ].join(':')
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!options.source || !options.output) {
    fail('--source e --output sao obrigatorios.')
  }

  const source = path.resolve(options.source)
  const output = path.resolve(options.output)
  const extension = path.extname(output).toLowerCase()
  if (!SUPPORTED_OUTPUTS.has(extension)) {
    fail('O destino precisa terminar em .webp ou .png.')
  }
  if (process.platform === 'win32'
    ? source.toLowerCase() === output.toLowerCase()
    : source === output) {
    fail('O derivado nao pode substituir o asset original.')
  }
  if (!(await exists(source))) {
    fail(`Asset de origem inexistente: ${source}`)
  }
  const sourceSignature = fileSignature(await stat(source))
  if (await exists(output)) {
    fail(`O destino ja existe e nao sera sobrescrito: ${output}`)
  }

  const input = sharp(source, { failOn: 'error', limitInputPixels: 100_000_000 })
  const metadata = await input.metadata()
  if (!metadata.width || !metadata.height) {
    fail('Nao foi possivel determinar as dimensoes da origem.')
  }

  const height = Math.round(metadata.height * (options.width / metadata.width))
  if (!Number.isSafeInteger(height) || height < 1 || height > MAX_DIMENSION) {
    fail(`A altura calculada precisa ficar entre 1 e ${MAX_DIMENSION} pixels.`)
  }
  const temporary = path.join(
    path.dirname(output),
    `.${path.basename(output)}.${process.pid}.${Date.now()}.tmp${extension}`,
  )
  await mkdir(path.dirname(output), { recursive: true })

  let pipeline = sharp(source, { failOn: 'error', limitInputPixels: 100_000_000 })
    .resize(options.width, height, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .toColourspace('srgb')

  pipeline = extension === '.webp'
    ? pipeline.webp({
        quality: options.quality,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
      })
    : pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false,
      })

  try {
    await pipeline.toFile(temporary)
    if (fileSignature(await stat(source)) !== sourceSignature) {
      fail('O asset de origem mudou durante o processamento; tente novamente.')
    }
    const handle = await open(temporary, 'r+')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, output)
  } finally {
    await rm(temporary, { force: true })
  }

  const result = await sharp(output).metadata()
  const outputStat = await stat(output)
  process.stdout.write(`${JSON.stringify({
    path: output,
    width: result.width,
    height: result.height,
    format: result.format,
    hasAlpha: result.hasAlpha,
    bytes: outputStat.size,
    sha256: await sha256(output),
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`Falha ao gerar derivado: ${error.message}\n`)
  process.exitCode = 1
})
