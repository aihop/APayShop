import fs from 'fs'
import path from 'path'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const themesDir = path.resolve(process.cwd(), 'app/themes')
  const themes = []

  if (fs.existsSync(themesDir)) {
    const folders = fs.readdirSync(themesDir, { withFileTypes: true })
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const theme = folder.name
        const schemaPath = path.join(themesDir, theme, 'theme.json')
        
        let schema: any = {
          name: theme,
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
            console.error(`Failed to parse theme.json for ${theme}`, e)
          }
        }
        
        // Provide fallback images based on theme name to keep the UI looking good if not provided in theme.json
        let defaultImage = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=450&fit=crop'
        if (theme === 'official') defaultImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=450&fit=crop'
        else if (theme === 'minimal') defaultImage = 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=450&fit=crop'
        else if (theme === 'nft' || theme === 'aihop') defaultImage = 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&h=450&fit=crop'

        themes.push({
          id: theme,
          name: schema.name || theme,
          description: schema.description || '',
          image: schema.image || defaultImage,
          version: schema.version || '1.0.0',
          author: schema.author || (locale === 'zh' ? '未知' : 'Unknown')
        })
      }
    }
  }

  return themes
})
