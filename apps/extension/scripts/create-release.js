import fs from 'fs/promises'
import path from 'path'

async function createRelease() {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
  const version = packageJson.version
  const releasePath = path.resolve('releases')
  
  try {
    await fs.access(releasePath)
    const files = await fs.readdir(releasePath)
    const zipFile = files.find(f => f.includes(`v${version}.zip`))
    
    if (!zipFile) {
      throw new Error('No packaged extension found. Run npm run package first.')
    }
    
    // Create release notes
    const releaseNotes = `# Crownie Extension v${version}

## Features
- Transaction preparation for Etherlink atomic swaps
- Escrow monitoring and secret revelation
- Connection to Etherlink testnet via Viem
- Real-time HTLC contract monitoring
- MetaMask wallet integration

## Installation
1. Download the \`${zipFile}\` file
2. Extract the contents
3. Open Chrome and go to \`chrome://extensions/\`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted folder
6. Pin the extension to your toolbar

## Usage
1. Connect your MetaMask wallet
2. Click the Crownie extension icon
3. Prepare transactions for atomic swaps
4. Monitor escrow contracts on Etherlink
5. Participate in live-meeting consensus for secret revelation

## Requirements
- Chrome browser (version 88+)
- MetaMask or compatible Ethereum wallet
- Internet connection

---
Built with ❤️ for the Etherlink ecosystem
`
    
    const notesPath = path.join(releasePath, `RELEASE_NOTES_v${version}.md`)
    await fs.writeFile(notesPath, releaseNotes)
    
    console.log('')
    console.log('🎉 Release created successfully!')
    console.log(`📝 Version: ${version}`)
    console.log(`📦 Package: ${zipFile}`)
    console.log(`📋 Release notes: RELEASE_NOTES_v${version}.md`)
    console.log('')
    console.log('Next steps:')
    console.log('1. Test the extension locally')
    console.log('2. Create a GitHub release')
    console.log('3. Upload to Chrome Web Store')
    console.log('4. Update documentation')
    
  } catch (error) {
    console.error('❌ Failed to create release:', error)
    process.exit(1)
  }
}

createRelease()