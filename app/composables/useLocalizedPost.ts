import { useI18n } from 'vue-i18n'
import { toValue } from 'vue'

export const useLocalizedPost = () => {
  const { locale } = useI18n()

  const getLocalizedPost = (post: any) => {
    const rawPost = toValue(post)
    if (!rawPost) return null
    const postCopy = JSON.parse(JSON.stringify(rawPost))
    
    // Parse metaData if it's a string
    if (typeof postCopy.metaData === 'string') {
      try {
        postCopy.metaData = JSON.parse(postCopy.metaData)
      } catch (e) {
        postCopy.metaData = {}
      }
    }

    const currentLocale = toValue(locale)

    if (!postCopy.metaData?.translations?.[currentLocale]) {
      return postCopy
    }

    const trans = postCopy.metaData.translations[currentLocale]

    return {
      ...postCopy,
      title: trans.title || postCopy.title,
      description: trans.description || postCopy.description,
      content: trans.content || postCopy.content,
      metaData: postCopy.metaData
    }
  }

  return {
    getLocalizedPost,
  }
}
