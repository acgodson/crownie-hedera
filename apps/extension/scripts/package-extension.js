import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'

async function packageExtension() {
  const distPath = path.resolve('dist')
  const packagePath = path.resolve('releases')
  
  try {
    // Ensure releases directory exists
    await fs.mkdir(packagePath, { recursive: true })
    
    // Copy manifest to dist
    const manifestSource = path.resolve('src/manifest.json')
    const manifestDest = path.resolve('dist/manifest.json')
    await fs.copyFile(manifestSource, manifestDest)
    
    // Copy icons if they exist
    const iconsSource = path.resolve('src/icons')
    const iconsDest = path.resolve('dist/icons')
    
    try {
      await fs.access(iconsSource)
      await fs.cp(iconsSource, iconsDest, { recursive: true })
      console.log('✅ Icons copied to dist/')
    } catch {
      console.log('⚠️  No icons directory found, skipping...')
    }
    
    // Create package info
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    const version = packageJson.version
    const zipName = `crownie-extension-v${version}.zip`
    const zipPath = path.join(packagePath, zipName)
    
    // Create zip archive
    const output = await fs.open(zipPath, 'w')
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    archive.pipe(output.createWriteStream())
    
    // Add all files from dist directory
    archive.directory(distPath, false)
    
    await archive.finalize()
    await output.close()
    
    const stats = await fs.stat(zipPath)
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
    
    console.log('')
    console.log('🏛️ Crownie extension packaged successfully!')
    console.log(`📦 Package: ${zipName}`)
    console.log(`📁 Location: ${zipPath}`)
    console.log(`📊 Size: ${sizeInMB} MB`)
    console.log('')
    console.log('Ready for Chrome Web Store upload! 🏛️')
    
  } catch (error) {
    console.error('❌ Failed to package extension:', error)
    process.exit(1)
  }
}

packageExtension()