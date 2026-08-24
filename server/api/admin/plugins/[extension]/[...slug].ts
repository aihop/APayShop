import { dispatchExtensionApi } from '../../../../utils/extensions'

export default defineEventHandler(event => dispatchExtensionApi(event, 'admin'))
