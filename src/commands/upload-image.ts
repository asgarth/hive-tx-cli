import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { PrivateKey } from 'hive-tx'
import { getConfig } from '../config.js'
import { getAccountName } from '../utils.js'

const DEFAULT_IMAGE_HOST = 'https://images.hive.blog'

export async function uploadImage(imagePath: string, account: string, postingKey: string): Promise<{ url: string }> {
  const imageData = readFileSync(imagePath)
  const imageHash = crypto.createHash('sha256').update('ImageSigningChallenge').update(imageData).digest()

  const privateKey = (PrivateKey as any).fromString(postingKey)
  const signature = privateKey.sign(imageHash).customToString()

  const formData = new FormData()
  formData.append('file', new Blob([imageData]), 'image')

  const response = await fetch(`${DEFAULT_IMAGE_HOST}/${account}/${signature}`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Image upload failed: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<{ url: string }>
}

const uploadImageCmd = new Command('upload')
  .description('Upload an image to Hive ImageHoster')
  .requiredOption('-f, --file <path>', 'Path to the image file')
  .option('--host <url>', 'ImageHoster URL', DEFAULT_IMAGE_HOST)
  .option('--account <name>', 'Account name (defaults to configured account)')
  .action(async (options) => {
    const config = await getConfig()
    const account = getAccountName(config, options)

    if (!account) {
      console.error(chalk.red('Account not specified. Use --account, HIVE_ACCOUNT, or configure with "hive config"'))
      process.exit(1)
    }

    if (!config?.postingKey) {
      console.error(chalk.red('Posting key not configured. Run "hive config" or set HIVE_POSTING_KEY.'))
      process.exit(1)
    }

    const spinner = ora('Uploading image...').start()
    try {
      const result = await uploadImage(options.file, account, config.postingKey)
      spinner.succeed('Image uploaded successfully')
      console.log(JSON.stringify(result, null, 2))
    } catch (error: any) {
      spinner.fail(error.message)
      process.exit(1)
    }
  })

export const uploadImageCommands = [uploadImageCmd]
