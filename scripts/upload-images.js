const OSS = require('ali-oss')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.production' })

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
})

// 支持的图片格式
const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']

async function uploadImage(localPath, ossPath) {
  try {
    const ext = path.extname(localPath).toLowerCase()
    
    // 设置图片相关的headers
    const options = {
      headers: {
        'Content-Type': getContentType(ext),
        'Cache-Control': 'public, max-age=31536000', // 1年缓存
        'x-oss-storage-class': 'Standard' // 标准存储
      }
    }

    const result = await client.put(ossPath, localPath, options)
    
    // 生成CDN链接
    const cdnUrl = `https://${process.env.OSS_DOMAIN}/${ossPath}`
    console.log(`✅ 上传成功: ${path.basename(localPath)}`)
    console.log(`🔗 CDN链接: ${cdnUrl}`)
    console.log('---')
    
    return {
      success: true,
      localPath,
      ossPath,
      cdnUrl,
      result
    }
  } catch (error) {
    console.error(`❌ 上传失败 ${path.basename(localPath)}: ${error.message}`)
    return {
      success: false,
      localPath,
      ossPath,
      error: error.message
    }
  }
}

function getContentType(ext) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', 
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp'
  }
  return contentTypes[ext] || 'image/jpeg'
}

async function uploadImagesFromDirectory(localDir, ossPrefix = 'images') {
  if (!fs.existsSync(localDir)) {
    console.error(`❌ 目录不存在: ${localDir}`)
    return []
  }

  const results = []
  const files = fs.readdirSync(localDir)
  
  console.log(`📂 扫描目录: ${localDir}`)
  console.log(`🎯 OSS前缀: ${ossPrefix}`)
  console.log('---')

  for (const file of files) {
    const localPath = path.join(localDir, file)
    const stat = fs.statSync(localPath)
    
    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase()
      
      if (supportedFormats.includes(ext)) {
        // 生成OSS路径，保持原文件名
        const ossPath = path.posix.join(ossPrefix, file)
        const result = await uploadImage(localPath, ossPath)
        results.push(result)
      } else {
        console.log(`⏭️  跳过非图片文件: ${file}`)
      }
    } else if (stat.isDirectory()) {
      // 递归处理子目录
      const subResults = await uploadImagesFromDirectory(
        localPath, 
        path.posix.join(ossPrefix, file)
      )
      results.push(...subResults)
    }
  }
  
  return results
}

async function uploadSingleImage(imagePath, customOssPath = null) {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 文件不存在: ${imagePath}`)
    return null
  }

  const fileName = path.basename(imagePath)
  const ext = path.extname(fileName).toLowerCase()
  
  if (!supportedFormats.includes(ext)) {
    console.error(`❌ 不支持的图片格式: ${ext}`)
    return null
  }

  // 使用自定义路径或默认路径
  const ossPath = customOssPath || path.posix.join('images', fileName)
  
  console.log(`📤 上传单个图片: ${fileName}`)
  console.log('---')
  
  return await uploadImage(imagePath, ossPath)
}

function generateMarkdown(results) {
  console.log('\n📝 生成Markdown引用代码:')
  console.log('='.repeat(50))
  
  results.filter(r => r.success).forEach(result => {
    const fileName = path.basename(result.localPath, path.extname(result.localPath))
    console.log(`![${fileName}](${result.cdnUrl})`)
  })
  
  console.log('='.repeat(50))
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
🖼️  图片上传工具

用法:
  node scripts/upload-images.js <路径> [OSS前缀]
  node scripts/upload-images.js --single <图片文件> [OSS路径]

示例:
  # 上传整个目录
  node scripts/upload-images.js ./public/images
  node scripts/upload-images.js ./public/images blog/assets
  
  # 上传单个文件  
  node scripts/upload-images.js --single ./avatar.jpg
  node scripts/upload-images.js --single ./avatar.jpg profile/avatar.jpg

环境变量:
  OSS_REGION - OSS区域
  OSS_BUCKET - OSS存储桶
  OSS_ACCESS_KEY_ID - 访问密钥ID
  OSS_ACCESS_KEY_SECRET - 访问密钥Secret
  OSS_DOMAIN - CDN域名
    `)
    return
  }

  console.log('🔧 OSS配置检查:')
  console.log('- Region:', process.env.OSS_REGION)
  console.log('- Bucket:', process.env.OSS_BUCKET)
  console.log('- CDN Domain:', process.env.OSS_DOMAIN)
  console.log('- AccessKey ID:', process.env.OSS_ACCESS_KEY_ID?.substring(0, 8) + '...')
  console.log('---')

  try {
    // 测试连接
    await client.list({ 'max-keys': 1 })
    console.log('✅ OSS连接成功\n')
    
    let results = []
    
    if (args[0] === '--single') {
      // 上传单个文件
      const imagePath = args[1]
      const ossPath = args[2]
      
      if (!imagePath) {
        console.error('❌ 请指定图片文件路径')
        return
      }
      
      const result = await uploadSingleImage(imagePath, ossPath)
      if (result) results.push(result)
      
    } else {
      // 上传目录
      const localDir = args[0]
      const ossPrefix = args[1] || 'images'
      
      results = await uploadImagesFromDirectory(localDir, ossPrefix)
    }
    
    // 统计结果
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    console.log('\n📊 上传统计:')
    console.log(`✅ 成功: ${successful}`)
    console.log(`❌ 失败: ${failed}`)
    console.log(`📁 总计: ${results.length}`)
    
    // 生成Markdown代码
    if (successful > 0) {
      generateMarkdown(results)
    }
    
    if (failed > 0) {
      console.log('\n❌ 失败的文件:')
      results.filter(r => !r.success).forEach(result => {
        console.log(`- ${path.basename(result.localPath)}: ${result.error}`)
      })
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  uploadImage,
  uploadImagesFromDirectory,
  uploadSingleImage
}