import dotenv from 'dotenv'
import inquirer from 'inquirer'
import { AtpAgent, BlobRef } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'
import path from 'path'
import * as yaml from 'js-yaml'
import { exit } from 'process'
import { buildFeedConfig } from '../src/config'

const run = async () => {
  dotenv.config()

  if (!process.env.FEEDGEN_SERVICE_DID && !process.env.FEEDGEN_HOSTNAME) {
    throw new Error('Please provide a hostname in the .env file')
  }

  if (!process.env.APP_PASSWORD) {
    throw new Error('Please provide an app password in the .env file')
  }

  const questions: any[] = []
  let blueskyHandle: string | undefined = undefined
  if (!process.env.BLUESKY_HANDLE) {
    questions.push({
      type: 'input',
      name: 'handle',
      message: 'Enter your Bluesky handle:',
      required: true,
    })
  } else {
    blueskyHandle = process.env.BLUESKY_HANDLE
  }

  const configFilePath = process.cwd() + path.sep + 'feeds.yml'
  const fileContents = await fs.readFile(configFilePath, { encoding: 'utf-8' })
  const data = yaml.load(fileContents) as Record<string, unknown>
  const feedsConfig = buildFeedConfig(data)

  if (questions.length > 0) {
    const answers = await inquirer.prompt(questions)
    let { handle } = answers
    blueskyHandle = handle
  }

  const feedGenDid =
    process.env.FEEDGEN_SERVICE_DID ?? `did:web:${process.env.FEEDGEN_HOSTNAME}`

  const password = process.env.APP_PASSWORD

  if (!blueskyHandle) {
    console.log('No handle to use')
    exit(1)
  }

  // only update this if in a test environment
  const agent = new AtpAgent({
    service: 'https://bsky.social',
  })
  await agent.login({ identifier: blueskyHandle, password })

  for (const rkey in feedsConfig) {
    console.log(`Updating ${rkey}`)
    const { avatar, title: displayName, description } = feedsConfig[rkey]

    let avatarRef: BlobRef | undefined
    if (avatar) {
      let encoding: string
      if (avatar.endsWith('png')) {
        encoding = 'image/png'
      } else if (avatar.endsWith('jpg') || avatar.endsWith('jpeg')) {
        encoding = 'image/jpeg'
      } else {
        throw new Error('expected png or jpeg')
      }
      const img = await fs.readFile(avatar)
      const blobRes = await agent.api.com.atproto.repo.uploadBlob(img, {
        encoding,
      })
      avatarRef = blobRes.data.blob
    }

    let fullDescription = `
${description}
`

    if (feedsConfig[rkey]['categories'] || [].length > 0) {
      fullDescription = `
${fullDescription}

Posts and threads that contain a link to a Kickstarter project in these categories: ${feedsConfig[rkey].categories.join(', ')}
`
    }

    if (fullDescription.length > 300) {
      fullDescription = fullDescription.slice(0, 277) + '...'
    }
    await agent.api.com.atproto.repo.putRecord({
      repo: agent.session?.did ?? '',
      collection: ids.AppBskyFeedGenerator,
      rkey,
      record: {
        did: feedGenDid,
        displayName: displayName,
        description: fullDescription,
        avatar: avatarRef,
        createdAt: new Date().toISOString(),
      },
    })
  }

  console.log('All done 🎉')
}

run()
