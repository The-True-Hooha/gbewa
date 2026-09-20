import { onMessage } from '../utils/messaging'
import { armPicker, disarmPicker, isPickerArmed } from './picker'
import { scanPageMedia } from './scanPage'

onMessage((message) => {
  switch (message.type) {
    case 'ARM_PICKER':
      armPicker()
      return undefined
    case 'DISARM_PICKER':
      disarmPicker()
      return undefined
    case 'GET_PICKER_STATE':
      return { armed: isPickerArmed() }
    case 'SCAN_PAGE_MEDIA':
      return scanPageMedia()
    default:
      return undefined
  }
})
