import fs from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  const themesDir = path.resolve(process.cwd(), 'app/themes')
  const themes = []

  if (fs.existsSync(themesDir)) {
    const folders = fs.readdirSync(themesDir, { withFileTypes: true })
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const themeId = folder.name
        const schemaPath = path.join(themesDir, themeId, 'theme.json')
        
        let schema: any = {
          name: themeId,
          description: '',
          image: '',
        }
        
        if (fs.existsSync(schemaPath)) {
          try {
            const fileContent = fs.readFileSync(schemaPath, 'utf-8')
            const parsed = JSON.parse(fileContent)
            schema = {
              ...schema,
              ...parsed
            }
          } catch (e) {
            console.error(`Failed to parse theme.json for ${themeId}`, e)
          }
        }
        
        // Provide fallback images based on theme name to keep the UI looking good if not provided in theme.json
        let defaultImage = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=450&fit=crop'
        if (themeId === 'official') defaultImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=450&fit=crop'
        else if (themeId === 'minimal') defaultImage = 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=450&fit=crop'
        else if (themeId === 'nft' || themeId === 'aihop') defaultImage = 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&h=450&fit=crop'

        themes.push({
          id: themeId,
          name: schema.name || themeId,
          description: schema.description || '',
          image: schema.image || defaultImage,
          version: schema.version || '1.0.0',
          author: schema.author || 'Unknown'
        })
      }
    }
  }

  return themes
})
