import { createClient } from 'redis'

async function clearCache() {
  const client = createClient({
    url: 'redis://default:8aOsi5ZlcevxIxkXOFn4b4qshhMTHKC5@redis-13718.fcrce172.us-east-1-1.ec2.cloud.redislabs.com:13718'
  })

  client.on('error', err => console.log('Redis Client Error', err))

  await client.connect()
  console.log('Connected to Redis')

  const keys = await client.keys('inbox:*')
  const msgKeys = await client.keys('msg:*')
  const convKeys = await client.keys('conv:*')
  
  const allKeys = [...keys, ...msgKeys, ...convKeys]

  if (allKeys.length > 0) {
    await client.del(allKeys)
    console.log(`Cleared ${allKeys.length} keys from cache!`)
  } else {
    console.log('No keys to clear.')
  }

  await client.disconnect()
}

clearCache()
