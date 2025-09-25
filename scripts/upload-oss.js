const OSS = require('ali-oss')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.production' })

console.log('🔧 OSS配置检查:')
console.log('- Region:', process.env.OSS_REGION)
console.log('- Bucket:', process.env.OSS_BUCKET)
console.log('- AccessKey ID:', process.env.OSS_ACCESS_KEY_ID?.substring(0, 8) + '...')

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
})

async function uploadFile(localPath, ossPath) {
  try {
    const ext = path.extname(localPath).toLowerCase()
    const isHtml = ext === '.html'

    const options = {
      headers: {
        'Content-Type': isHtml ? 'text/html; charset=utf-8' : undefined,
        'Cache-Control': isHtml ? 'public, max-age=3600' : 'public, max-age=2592000'
      }
    }

    const result = await client.put(ossPath, localPath, options)
    console.log(`✅ ${ossPath}${isHtml ? ' (HTML)' : ''}`)
    return result
  } catch (error) {
    console.error(`❌ ${ossPath}: ${error.message}`)
    throw error
  }
}

async function uploadDirectory(localDir, ossPrefix = '') {
  const items = fs.readdirSync(localDir)
  
  for (const item of items) {
    const localPath = path.join(localDir, item)
    const ossPath = path.posix.join(ossPrefix, item)
    
    if (fs.statSync(localPath).isDirectory()) {
      await uploadDirectory(localPath, ossPath)
    } else {
      await uploadFile(localPath, ossPath)
    }
  }
}

async function deploy() {
  console.log('🚀 开始部署到阿里云OSS...')
  
  const outDir = path.join(__dirname, '../out')
  
  if (!fs.existsSync(outDir)) {
    console.error('❌ 构建目录不存在，请先运行 npm run export')
    process.exit(1)
  }
  
  try {
    // 测试连接
    console.log('🔗 测试OSS连接...')
    await client.list({ 'max-keys': 1 })
    console.log('✅ OSS连接成功')
    
    // 上传文件
    console.log('📤 开始上传文件...')
    await uploadDirectory(outDir)
    
    console.log('🎉 部署完成！')
    console.log(`🌐 访问地址：http://${process.env.OSS_DOMAIN}`)
    
  } catch (error) {
    console.error('❌ 部署失败:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  deploy()
}