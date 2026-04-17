import { useI18n } from 'vue-i18n'
import { toValue } from 'vue'

export const useLocalizedProduct = () => {
  const { locale } = useI18n()

  const getLocalizedProduct = (product: any) => {
    // Ensure we unwrap refs if passed directly
    const rawProduct = toValue(product)
    if (!rawProduct) return null

    // Deep clone product to avoid reference mutation when parsing JSON
    const productCopy = JSON.parse(JSON.stringify(rawProduct))

    // Parse features if it's a string
    if (typeof productCopy.features === 'string') {
      try {
        productCopy.features = JSON.parse(productCopy.features)
      } catch (e) {
        productCopy.features = []
      }
    }
    
    // Parse metaData if it's a string (can happen when coming directly from DB fetch without transform)
    if (typeof productCopy.metaData === 'string') {
      try {
        productCopy.metaData = JSON.parse(productCopy.metaData)
      } catch (e) {
        productCopy.metaData = {}
      }
    }

    const currentLocale = toValue(locale)

    if (!productCopy.metaData?.translations?.[currentLocale]) {
      // Still parse plan_features from default metaData if needed
      if (typeof productCopy.metaData?.plan_features === 'string') {
        try {
          productCopy.metaData.plan_features = JSON.parse(productCopy.metaData.plan_features)
        } catch (e) {}
      }
      return productCopy
    }

    const trans = productCopy.metaData.translations[currentLocale]
    
    // Parse translated plan_features if it's a string
    let parsedPlanFeatures = trans.plan_features
    if (!parsedPlanFeatures || (Array.isArray(parsedPlanFeatures) && parsedPlanFeatures.length === 0)) {
        parsedPlanFeatures = productCopy.metaData?.plan_features
    }

    if (typeof parsedPlanFeatures === 'string') {
        try {
            parsedPlanFeatures = JSON.parse(parsedPlanFeatures)
        } catch (e) {}
    }

    return {
      ...productCopy,
      name: trans.name || productCopy.name,
      title: trans.title || productCopy.title,
      description: trans.description || productCopy.description,
      content: trans.content || productCopy.content,
      metaData: {
        ...productCopy.metaData,
        plan_badge: trans.plan_badge || productCopy.metaData?.plan_badge,
        plan_features: parsedPlanFeatures,
      },
    }
  }

  return {
    getLocalizedProduct,
  }
}
