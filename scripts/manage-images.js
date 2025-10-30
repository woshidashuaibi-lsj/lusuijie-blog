const { uploadImagesFromDirectory } = require('./upload-images')

// 批量上传博客图片
async function uploadBlogAssets() {
  console.log('📤 上传博客资源...')
  
  const tasks = [
    { dir: './public/images/avatars', prefix: 'avatars' },
    { dir: './public/images/blog', prefix: 'blog' },
    { dir: './public/images/icons', prefix: 'icons' }
  ]
  
  for (const task of tasks) {
    console.log(`\n🎯 处理: ${task.dir} -> ${task.prefix}`)
    await uploadImagesFromDirectory(task.dir, task.prefix)
  }
}

if (require.main === module) {
  uploadBlogAssets()
}