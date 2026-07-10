// Shared theme-selection logic used by both scripts/generate-theme-build.mjs
// (client bundle codegen) and nuxt.config.ts (nitro handlers/public assets/
// global components). Keeping this in one place avoids the two from disagreeing
// on what an empty/missing selection means.
import fs from 'fs'
import path from 'path'

export const resolveAvailableThemes = (themesDir) => {
  if (!fs.existsSync(themesDir)) {
    return []
  }

  return fs
    .readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'core')
    .map((entry) => entry.name)
    .sort()
}

export const normalizeThemeList = (rawValue, availableThemes) => {
  if (!rawValue) {
    return []
  }

  const selected = []
  for (const item of rawValue.split(',')) {
    const theme = item.trim()
    if (!theme || theme === 'default' || theme === 'core') {
      continue
    }
    if (availableThemes.includes(theme) && !selected.includes(theme)) {
      selected.push(theme)
    }
  }

  return selected
}

export const resolveManifestFile = (projectRoot, manifestEnvValue) => {
  const rawValue = manifestEnvValue || ''
  if (!rawValue) {
    return path.join(projectRoot, 'app/generated/theme-manifest.json')
  }

  return path.isAbsolute(rawValue) ? rawValue : path.resolve(projectRoot, rawValue)
}

// Returns the manifest's publishedOptionalThemes array, or null if the
// manifest file doesn't exist / can't be parsed (i.e. "no manifest yet").
export const readManifestThemes = (manifestFile) => {
  if (!fs.existsSync(manifestFile)) {
    return null
  }

  try {
    const raw = fs.readFileSync(manifestFile, 'utf-8')
    const manifest = JSON.parse(raw)
    if (Array.isArray(manifest?.publishedOptionalThemes)) {
      return manifest.publishedOptionalThemes
    }
  } catch (error) {
    console.warn(`[theme-build] failed to read manifest: ${manifestFile}`, error)
  }

  return null
}

// Single source of truth for "which themes are included in this build/run".
// Precedence: explicit selection > manifest (even if empty, e.g. core-only
// build) > env override > all themes (dev-friendly default when no manifest
// has ever been written, e.g. a fresh checkout).
export const resolveSelectedThemes = ({ themesDir, manifestFile, explicitThemes, envThemes }) => {
  const availableThemes = resolveAvailableThemes(themesDir)

  if (explicitThemes) {
    return normalizeThemeList(explicitThemes, availableThemes)
  }

  const manifestThemes = readManifestThemes(manifestFile)
  if (manifestThemes !== null) {
    return normalizeThemeList(manifestThemes.join(','), availableThemes)
  }

  if (envThemes) {
    return normalizeThemeList(envThemes, availableThemes)
  }

  return availableThemes
}
