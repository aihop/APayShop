import { ref, reactive, computed, watch } from 'vue'
import { useToast } from '#imports'

export const useAdminProductForm = (emit: any) => {
  const toast = useToast()
  const { settings } = useSettings()

  // ==========================================
  // 1. 语言与多语言配置 (i18n & Locales)
  // ==========================================
  const supportedLocales = computed(() => {
    const i18nEnabled = settings?.value?.i18n_enabled
    if (i18nEnabled === 'false') return ['en']
    
    const rawLocales = settings?.value?.supported_locales
    if (rawLocales === '') return ['en']
    
    return (rawLocales || 'en,zh').split(',').map((l: string) => l.trim()).filter(Boolean)
  })

  const defaultLocale = computed(() => supportedLocales.value[0] || 'en')
  const currentTabLocale = ref(defaultLocale.value || 'en')

  watch(defaultLocale, (val) => {
    if (!currentTabLocale.value || currentTabLocale.value === 'en') {
      currentTabLocale.value = val || 'en'
    }
  }, { immediate: true })

  const onTabChange = (index: number) => {
    if (!isFeaturesVisualMode.value) {
      if (!syncFeaturesJsonToList()) {
        // Prevent tab switch if JSON is invalid
        return
      }
    }
    
    const targetLocale = supportedLocales.value[index] || 'en'
    
    // 如果是从默认语言切换到其他语言，自动将默认语言的数据同步过去（如果目标语言为空）
    if (currentTabLocale.value === defaultLocale.value && targetLocale !== defaultLocale.value) {
      const trans = translationForms[targetLocale]
      if (trans) {
        if (!trans.name) trans.name = form.name
        if (!trans.description) trans.description = form.description
        if (!trans.content) trans.content = form.content
        if (!trans.plan_badge && form.metaData?.plan_badge) trans.plan_badge = form.metaData.plan_badge
        if (!trans.download_instruction && form.metaData?.download_instruction) trans.download_instruction = form.metaData.download_instruction
      }
      
      // 同步 Features (对于 Subscription 或 Dynamic API 类型的产品)
      if ((form.type === 'subscription' || form.type === 'dynamic_api') && (!translationFeaturesLists[targetLocale] || translationFeaturesLists[targetLocale].length === 0)) {
        translationFeaturesLists[targetLocale] = featuresList.value.map(f => ({ ...f, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) }))
      }
      
      // 同步 Service Schema Labels
      if (form.type === 'service' && (!trans.form_schema_labels || Object.keys(trans.form_schema_labels).length === 0)) {
        if (!trans.form_schema_labels) trans.form_schema_labels = {}
        serviceFormSchemaList.value.forEach(field => {
          if (field.name) trans.form_schema_labels[field.name] = field.label || ''
        })
      }
    }
    
    currentTabLocale.value = targetLocale
    
    // Refresh JSON buffer if staying in JSON mode
    if (!isFeaturesVisualMode.value) {
      const cleanList = currentFeaturesList.value.map(({ id, ...rest }) => rest)
      currentFeaturesJson.value = JSON.stringify(cleanList, null, 2)
    }
  }

  // ==========================================
  // 2. 表单核心数据状态 (Form State)
  // ==========================================
  const form = reactive({
    id: null as number | null,
    name: '',
    slug: '',
    price: 0,
    type: 'basic',
    description: '',
    content: '',
    imageUrl: '',
    imageUrls: [] as string[],
    isActive: true,
    metaData: {} as any,
  })

  const translationForms = reactive<Record<string, any>>({})
  
  // UI 交互状态
  const isSaving = ref(false)
  const isUploading = ref(false)
  const newImageUrl = ref('')

  // ==========================================
  // 3. 特殊产品类型扩展字段 (Extended Fields)
  // ==========================================

  // Dynamic API 类型：Allowed Scopes
  const newScopeInput = ref('')
  
  const addScope = () => {
    const val = newScopeInput.value.trim()
    if (!val) return
    
    if (!form.metaData.allowed_scopes) {
      form.metaData.allowed_scopes = []
    }
    
    if (!form.metaData.allowed_scopes.includes(val)) {
      form.metaData.allowed_scopes.push(val)
    }
    newScopeInput.value = ''
  }
  
  const removeScope = (index: number) => {
    if (form.metaData.allowed_scopes && Array.isArray(form.metaData.allowed_scopes)) {
      form.metaData.allowed_scopes.splice(index, 1)
    }
  }

  // Subscription 类型：Gateway Plan IDs 映射
  const planIdsList = ref<{gateway: string, id: string}[]>([])
  const availableGateways = ref<{label: string, value: string}[]>([])

  const fetchGateways = async () => {
    try {
      const res: any = await $fetch('/api/admin/payments')
      if (res && Array.isArray(res)) {
        availableGateways.value = res
          .filter(m => m.isActive)
          .map(m => ({ label: m.name, value: m.code }))
      }
    } catch (e) {
      console.error('Failed to fetch payment methods', e)
    }
  }

  // 立即获取网关列表
  fetchGateways()

  const addPlanId = () => {
    planIdsList.value.push({ gateway: '', id: '' })
  }

  const removePlanId = (index: number) => {
    planIdsList.value.splice(index, 1)
  }

  // Service 类型：自定义表单 Schema
  const serviceFormSchemaList = ref<any[]>([])
  const isServiceSchemaVisualMode = ref(true)
  const serviceFormSchemaStr = ref('[]') // 兼作 JSON 缓冲

  const syncServiceSchemaJsonToList = (): boolean => {
    if (isServiceSchemaVisualMode.value) return true
    try {
      const parsed = JSON.parse(serviceFormSchemaStr.value)
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
      
      serviceFormSchemaList.value = parsed.map((f: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: f.name || '',
        label: f.label || '',
        type: f.type || 'text',
        required: f.required !== false
      }))
      return true
    } catch (e) {
      toast.add({ title: 'JSON Error', description: 'Invalid JSON format in Service Schema', color: 'error' })
      return false
    }
  }

  const toggleServiceSchemaMode = () => {
    if (isServiceSchemaVisualMode.value) {
      // 切换到 JSON 模式：剥离 id 字段
      const cleanList = serviceFormSchemaList.value.map(({ id, ...rest }) => rest)
      serviceFormSchemaStr.value = JSON.stringify(cleanList, null, 2)
      isServiceSchemaVisualMode.value = false
    } else {
      // 尝试切换回可视化模式
      if (syncServiceSchemaJsonToList()) {
        isServiceSchemaVisualMode.value = true
      }
    }
  }

  const addServiceSchemaField = () => {
    serviceFormSchemaList.value.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: '',
      label: '',
      type: 'text',
      required: true
    })
  }

  const removeServiceSchemaField = (index: number) => {
    serviceFormSchemaList.value.splice(index, 1)
  }
  
  // Subscription 类型：Pricing Plan Features 可视化列表
  const featuresList = ref<any[]>([])
  const translationFeaturesLists = reactive<Record<string, any[]>>({})
  
  const isFeaturesVisualMode = ref(true)
  const currentFeaturesJson = ref('[]')

  const currentFeaturesList = computed({
    get: () => {
      if (currentTabLocale.value === defaultLocale.value) return featuresList.value
      return translationFeaturesLists[currentTabLocale.value] || []
    },
    set: (val) => {
      if (currentTabLocale.value === defaultLocale.value) {
        featuresList.value = val
      } else {
        translationFeaturesLists[currentTabLocale.value] = val
      }
    }
  })

  const syncFeaturesJsonToList = (): boolean => {
    if (isFeaturesVisualMode.value) return true
    try {
      const parsed = JSON.parse(currentFeaturesJson.value)
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
      
      currentFeaturesList.value = parsed.map((f: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: f.name || '',
        icon: f.icon || 'ph:check',
        included: f.included !== false
      }))
      return true
    } catch (e) {
      toast.add({ title: 'JSON Error', description: 'Invalid JSON format in features', color: 'error' })
      return false
    }
  }

  const toggleFeaturesMode = () => {
    if (isFeaturesVisualMode.value) {
      // 切换到 JSON 模式：剥离 id 字段
      const cleanList = currentFeaturesList.value.map(({ id, ...rest }) => rest)
      currentFeaturesJson.value = JSON.stringify(cleanList, null, 2)
      isFeaturesVisualMode.value = false
    } else {
      // 尝试切换回可视化模式
      if (syncFeaturesJsonToList()) {
        isFeaturesVisualMode.value = true
      }
    }
  }

  const addFeature = () => {
    const newList = [...currentFeaturesList.value]
    newList.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: '',
      icon: 'ph:check',
      included: true
    })
    currentFeaturesList.value = newList
  }

  const removeFeature = (index: number) => {
    const newList = [...currentFeaturesList.value]
    newList.splice(index, 1)
    currentFeaturesList.value = newList
  }

  // ==========================================
  // 4. 表单初始化逻辑 (Init Form)
  // ==========================================
  const initForm = (product?: any) => {
    // 清理旧的翻译数据
    for (const key in translationForms) delete translationForms[key]
    
    supportedLocales.value.forEach((l: string) => {
      if (l !== defaultLocale.value) {
        translationForms[l] = {
          name: '',
          description: '',
          content: '',
          plan_badge: '',
          download_instruction: '',
          form_schema_labels: {}
        }
      }
    })

    if (product && Object.keys(product).length > 0) {
      const productClone = JSON.parse(JSON.stringify(product))

      // 重置基础数据
      Object.assign(form, {
        id: null, name: '', slug: '', price: 0, type: 'basic',
        description: '', content: '', imageUrl: '', imageUrls: [],
        isActive: true, metaData: {},
      })
      Object.assign(form, productClone)

      // 解析 imageUrls
      if (!form.imageUrls) form.imageUrls = []
      if (typeof form.imageUrls === 'string') {
        try { form.imageUrls = JSON.parse(form.imageUrls) } catch (e) { form.imageUrls = [] }
      }

      // 解析 metaData
      if (!form.metaData) form.metaData = {}
      if (typeof form.metaData === 'string') {
        try { form.metaData = JSON.parse(form.metaData) } catch (e) { form.metaData = {} }
      }

      // 确保 allowed_scopes 是数组
      if (form.type === 'dynamic_api') {
        if (!form.metaData.allowed_scopes) {
          form.metaData.allowed_scopes = []
        } else if (typeof form.metaData.allowed_scopes === 'string') {
          // 兼容之前的逗号分隔字符串
          form.metaData.allowed_scopes = form.metaData.allowed_scopes.split(',').map((s: string) => s.trim()).filter(Boolean)
        }
      }

      // 兼容旧版的 'interval:count'
      if (form.type === 'subscription' && typeof form.metaData.interval === 'string' && form.metaData.interval.includes(':')) {
        const [unit, count] = form.metaData.interval.split(':')
        form.metaData.interval = unit
        form.metaData.interval_count = parseInt(count) || 1
      }
      
      // 确保 subscription 有默认周期
      if (form.type === 'subscription') {
        if (!form.metaData.interval) form.metaData.interval = 'month'
        if (!form.metaData.interval_count) form.metaData.interval_count = 1
        
        // 解析 plan_ids
        planIdsList.value = []
        if (form.metaData.plan_ids && typeof form.metaData.plan_ids === 'object') {
          Object.keys(form.metaData.plan_ids).forEach(key => {
            planIdsList.value.push({ gateway: key, id: form.metaData.plan_ids[key] })
          })
        }
      }

      // 解析 Pricing Plan Features
      if (form.metaData.plan_features) {
        const parseFeatures = (data: any) => {
          const features = typeof data === 'string' ? JSON.parse(data) : data
          return Array.isArray(features) ? features.map((f: any) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: f.name || '',
            icon: f.icon || 'ph:check',
            included: f.included !== false
          })) : []
        }
        featuresList.value = parseFeatures(form.metaData.plan_features)
      } else {
        featuresList.value = []
      }

      // 解析多语言翻译
      if (form.metaData?.translations) {
        Object.keys(form.metaData.translations).forEach((loc) => {
          if (loc !== defaultLocale.value && translationForms[loc]) {
            const trans = form.metaData.translations[loc]
            translationForms[loc].name = trans.name || ''
            translationForms[loc].description = trans.description || ''
            translationForms[loc].content = trans.content || ''
            translationForms[loc].plan_badge = trans.plan_badge || ''
            translationForms[loc].download_instruction = trans.download_instruction || ''
            translationForms[loc].form_schema_labels = trans.form_schema_labels || {}
            
            if (trans.plan_features) {
               const features = typeof trans.plan_features === 'string' ? JSON.parse(trans.plan_features) : trans.plan_features
               translationFeaturesLists[loc] = Array.isArray(features) ? features.map((f: any) => ({
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  name: f.name || '',
                  icon: f.icon || 'ph:check',
                  included: f.included !== false
               })) : []
            } else {
               translationFeaturesLists[loc] = []
            }
          }
        })
      }

      // 解析 Service Schema
      if (form.type === 'service') {
        if (form.metaData.form_schema) {
          serviceFormSchemaStr.value = JSON.stringify(form.metaData.form_schema, null, 2)
          syncServiceSchemaJsonToList()
        } else {
          serviceFormSchemaStr.value = '[\n  {\n    "name": "server_ip",\n    "label": "Server IP",\n    "type": "text",\n    "required": true\n  }\n]'
          syncServiceSchemaJsonToList()
        }
      }
    } else {
      // 全新表单重置
      Object.assign(form, {
        id: null, name: '', slug: '', price: 0, type: 'basic',
        description: '', content: '', imageUrl: '', imageUrls: [],
        isActive: true, metaData: {},
      })
      serviceFormSchemaStr.value = '[\n  {\n    "name": "server_ip",\n    "label": "Server IP",\n    "type": "text",\n    "required": true\n  }\n]'
      syncServiceSchemaJsonToList()
      featuresList.value = []
      planIdsList.value = []
      for (const key in translationFeaturesLists) {
        translationFeaturesLists[key] = []
      }
    }
    newImageUrl.value = ''
  }

  // ==========================================
  // 5. 保存提交逻辑 (Save Logic)
  // ==========================================
  const saveProduct = async () => {
    // 强制同步最新的 JSON 到列表
    if (!syncFeaturesJsonToList()) return false
    if (!syncServiceSchemaJsonToList()) return false

    // 校验 Service Schema
    if (form.type === 'service') {
      try {
        if (!form.metaData) form.metaData = {}
        const cleanSchema = serviceFormSchemaList.value.map(f => ({
          name: f.name, label: f.label, type: f.type, required: f.required
        }))
        form.metaData.form_schema = cleanSchema
      } catch (e) {
        toast.add({ title: 'Error', description: 'Invalid Service Form Schema', color: 'error' })
        return false
      }
    }

    // 处理 Subscription Features 和 Plan IDs
    if (form.type === 'subscription' || form.type === 'dynamic_api') {
      // 收集 Plan IDs 为键值对对象
      const planIdsObj: Record<string, string> = {}
      planIdsList.value.forEach(item => {
        const key = item.gateway.trim()
        const val = item.id.trim()
        if (key && val) {
          planIdsObj[key] = val
        }
      })
      form.metaData.plan_ids = planIdsObj

      if (form.metaData.is_pricing_plan) {
        try {
          const cleanFeatures = featuresList.value.map(f => ({
            name: f.name, icon: f.icon, included: f.included
          }))
          form.metaData.plan_features = cleanFeatures
        } catch (e) {
          toast.add({ title: 'Error', description: 'Invalid Default Plan Features', color: 'error' })
          return false
        }
      }
    }

    // 组装多语言数据
    if (!form.metaData.translations) form.metaData.translations = {}
    for (const loc of supportedLocales.value) {
      if (loc === defaultLocale.value) continue

      const trans = translationForms[loc]
      if (!trans) continue

      if (!form.metaData.translations[loc]) form.metaData.translations[loc] = {}

      form.metaData.translations[loc].name = trans.name
      form.metaData.translations[loc].description = trans.description
      form.metaData.translations[loc].content = trans.content
      form.metaData.translations[loc].plan_badge = trans.plan_badge

      if (form.type === 'file') {
        form.metaData.translations[loc].download_instruction = trans.download_instruction
      }

      if (form.type === 'service') {
        form.metaData.translations[loc].form_schema_labels = trans.form_schema_labels
      }

      if ((form.type === 'subscription' || form.type === 'dynamic_api') && form.metaData.is_pricing_plan) {
        try {
          const transFeatures = translationFeaturesLists[loc] || []
          form.metaData.translations[loc].plan_features = transFeatures.map(f => ({
            name: f.name, icon: f.icon, included: f.included
          }))
        } catch (e) {
          toast.add({ title: 'Error', description: `Invalid ${loc} Plan Features`, color: 'error' })
          return false
        }
      }
    }

    // 清理临时字段
    delete form.metaData.name_zh
    delete form.metaData.plan_badge_zh

    isSaving.value = true
    try {
      if (form.imageUrls && form.imageUrls.length > 0) {
        form.imageUrl = form.imageUrls[0] as string
      } else {
        form.imageUrl = ''
      }

      if (form.id) {
        await $fetch(`/api/admin/products/${form.id}`, { method: 'PUT', body: form })
        toast.add({ title: 'Success', description: 'Product updated successfully', color: 'success' })
      } else {
        await $fetch('/api/admin/products', { method: 'POST', body: form })
        toast.add({ title: 'Success', description: 'Product created successfully', color: 'success' })
      }
      emit('saved')
      return true
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.message || 'Failed to save product', color: 'error' })
      return false
    } finally {
      isSaving.value = false
    }
  }

  // ==========================================
  // 6. 图片上传与管理逻辑 (Media Management)
  // ==========================================
  const handleFileUpload = async (event: Event, fileInputRef: any) => {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return

    isUploading.value = true
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i)
        if (f) formData.append('files', f)
      }

      const res: any = await $fetch('/api/admin/upload', { method: 'POST', body: formData })

      if (res && res.urls) {
        if (!form.imageUrls) form.imageUrls = []
        form.imageUrls.push(...res.urls)
        if (!form.imageUrl && res.urls.length > 0) {
          form.imageUrl = res.urls[0]
        }
      }
    } catch (error) {
      toast.add({ title: 'Error', description: 'Failed to upload image', color: 'error' })
    } finally {
      isUploading.value = false
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  const addImageUrl = () => {
    if (newImageUrl.value && !form.imageUrls.includes(newImageUrl.value)) {
      form.imageUrls.push(newImageUrl.value)
      newImageUrl.value = ''
    }
  }

  const removeImage = async (index: number) => {
    const url = form.imageUrls[index]
    form.imageUrls.splice(index, 1)

    if (url && url.startsWith('/uploads/')) {
      try {
        await $fetch(`/api/admin/upload/delete?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      } catch (e) {
        console.error('Failed to delete file from server', e)
      }
    }
  }

  return {
    form,
    translationForms,
    isSaving,
    isUploading,
    newImageUrl,
    serviceFormSchemaStr,
    serviceFormSchemaList,
    isServiceSchemaVisualMode,
    toggleServiceSchemaMode,
    addServiceSchemaField,
    removeServiceSchemaField,
    isFeaturesVisualMode,
    currentFeaturesJson,
    toggleFeaturesMode,
    currentFeaturesList,
    supportedLocales,
    defaultLocale,
    currentTabLocale,
    initForm,
    saveProduct,
    onTabChange,
    addFeature,
    removeFeature,
    handleFileUpload,
    addImageUrl,
    removeImage,
    newScopeInput,
    addScope,
    removeScope,
    planIdsList,
    availableGateways,
    addPlanId,
    removePlanId
  }
}