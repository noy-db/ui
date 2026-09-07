// Thai catalog for the WHOLE noy-db-ui family: the engine's structural words (LOCALE_TH) merged
// with the bindings' component chrome. One import gives a host every `nui.*` key the library
// emits; domain words (entity nouns, field labels, enum values) stay host-side. Re-exported by
// each binding's `/core` subpath, so `@noy-db/ui-nuxt/core` and `@noy-db/ui-suai/core` still
// serve it under the same name.
//   import { NUI_LOCALE_TH } from '@noy-db/ui'
//   provideNoydbUi({ t: (k, f) => ({ ...NUI_LOCALE_TH, ...appTh })[k] ?? f, ... })
import { LOCALE_TH } from './locale-th'

export const NUI_LOCALE_TH: Record<string, string> = {
  ...LOCALE_TH,
  // search box
  'nui.search.placeholder': 'กรอง — พิมพ์เพื่อค้นหา, กด Tab เพื่อเพิ่มตัวกรอง…',
  'nui.search.askPlaceholder': 'อธิบายสิ่งที่ต้องการ — เช่น แผ่นแจ๊สราคาถูกจากยุค 70…',
  'nui.search.askHint': 'ตีความด้วย AI',
  'nui.search.clearFilters': 'ล้างตัวกรองทั้งหมด',
  'nui.search.editPill': 'คลิกเพื่อแก้ไข · ลากเพื่อจัดลำดับ',
  'nui.search.pillKeys': 'Enter แก้ไข, Delete ลบ, Alt+ลูกศร จัดลำดับ',
  'nui.search.removeFilter': 'ลบ',
  'nui.search.removePill': 'ลบ',
  // mode group
  'nui.mode.label': 'โหมดค้นหา',
  'nui.mode.exact': 'ค้นหา — พิมพ์ตัวกรองแบบตรงตัว',
  'nui.mode.ask': 'ถาม — อธิบายสิ่งที่ต้องการ ให้ AI ตีความ',
  'nui.mode.speak': 'กดค้างเพื่อพูด — เสียงให้ AI ตีความ',
  'nui.mode.holdHint': 'กดค้างเพื่อพูด',
  // group-by control ('nui.group.title' ships with the engine catalog)
  'nui.group.by': 'จัดกลุ่มตาม',
  'nui.group.collapseTo': 'ยุบเป็น',
  'nui.group.expandAll': 'ขยายทั้งหมด',
  'nui.group.expandCollapse': 'ขยาย / ยุบ',
  // list
  'nui.list.expandGroups': 'ขยายทุกกลุ่ม',
  'nui.list.collapseGroups': 'ยุบทุกกลุ่ม',
  'nui.list.noData': 'ไม่มีข้อมูล',
  'nui.list.rowNumber': 'ลำดับแถว',
  // saved searches
  'nui.saved.title': 'การค้นหาที่บันทึก',
  'nui.saved.empty': 'ยังไม่มีการค้นหาที่บันทึก',
  'nui.saved.saveCurrent': 'บันทึกการค้นหาปัจจุบัน',
  'nui.saved.currentSaved': 'การค้นหาปัจจุบันถูกบันทึกแล้ว',
  'nui.saved.opensOn': 'เปิดที่:',
  'nui.saved.allRecords': 'ทั้งหมด',
  'nui.saved.setDefault': 'ตั้งเป็นมุมมองเริ่มต้น',
  'nui.saved.clearDefault': 'ล้างมุมมองเริ่มต้น',
  'nui.saved.defaultTitle': 'เปิดหน้านี้ด้วยการค้นหานี้เป็นค่าเริ่มต้น',
  'nui.saved.pin': 'ปักหมุดในรายการโปรด',
  'nui.saved.unpin': 'เลิกปักหมุดจากรายการโปรด',
  'nui.saved.rename': 'เปลี่ยนชื่อ',
  'nui.saved.renameAria': 'เปลี่ยนชื่อการค้นหาที่บันทึก',
  'nui.saved.confirmRename': 'ยืนยันการเปลี่ยนชื่อ',
  'nui.saved.delete': 'ลบการค้นหาที่บันทึก',
  'nui.saved.nameAria': 'ตั้งชื่อการค้นหานี้',
  'nui.saved.namePlaceholder': 'ตั้งชื่อการค้นหานี้…',
  'nui.saved.recent3m': 'ล่าสุด (3 เดือน)',
  'nui.saved.rolling': 'เลื่อนตามเวลา',
  'nui.saved.rollingTitle': 'เลื่อนตามเวลา — ช่วงวันที่ขยับตามวันนี้',
  // recent searches
  'nui.recent.title': 'การค้นหาล่าสุด',
  'nui.recent.empty': 'ยังไม่มีการค้นหาล่าสุด',
  'nui.recent.none': 'ไม่มีการค้นหาล่าสุด',
  'nui.recent.remove': 'ลบการค้นหาล่าสุด',
  // column chooser
  'nui.columns.title': 'คอลัมน์',
  'nui.columns.titleCustom': 'คอลัมน์ (กำหนดเอง)',
  // header filters
  'nui.filter.title': 'ตัวกรอง',
  'nui.filter.label': 'ตัวกรอง',
  'nui.filter.search': 'ค้นหา…',
  'nui.filter.inView': 'ในมุมมอง',
  'nui.filter.allOthers': 'อื่น ๆ ทั้งหมด',
  'nui.filter.noMatches': 'ไม่พบรายการที่ตรงกัน',
  'nui.filter.noValues': 'ไม่มีค่า',
  'nui.filter.byDate': 'กรองตามวันที่',
  'nui.filter.from': 'จาก',
  'nui.filter.to': 'ถึง',
  'nui.filter.last30': '30 วันล่าสุด',
  'nui.filter.last90': '90 วันล่าสุด',
  'nui.filter.thisYear': 'ปีนี้',
  'nui.filters': 'ตัวกรอง',
  // sorting / resizing
  'nui.sort.hint': 'คลิกเพื่อเรียง · ดับเบิลคลิกเพื่อล็อกการเรียงหลายชั้น · Shift-คลิกเพื่อเพิ่ม',
  'nui.resize.adjust': 'ปรับความกว้าง',
  'nui.resize.done': 'เสร็จ',
  'nui.resize.handle': 'ปรับขนาด',
  'nui.resize.hint': 'ลากขอบเพื่อปรับขนาด (← → เมื่อโฟกัส) · ดับเบิลคลิกเพื่อพอดีอัตโนมัติ · คลิกป้ายเพื่อล็อกพิกเซล',
  'nui.resize.lockHint': 'คลิกเพื่อล็อก/ปลดล็อกความกว้างพิกเซล',
  // AI / voice
  'nui.ai.title': 'ค้นหาด้วย AI',
  'nui.ai.search': 'ค้นหา',
  'nui.ai.searching': 'กำลังค้นหา…',
  'nui.ai.placeholder': 'เช่น ใบแจ้งหนี้ที่จ่ายแล้ว เกิน 5000 ปีนี้',
  'nui.ai.refine': 'ปรับจากปัจจุบัน',
  'nui.ai.refinePlaceholder': 'ปรับคำค้นหาปัจจุบัน…',
  'nui.ai.saveKey': 'บันทึกคีย์',
  'nui.ai.changeKey': 'เปลี่ยนคีย์',
  'nui.ai.keyHint': 'วางคีย์ API ของคุณ — โฮสต์จะเก็บไว้ (เข้ารหัส) และเรียก AI จากเบราว์เซอร์ของคุณโดยตรง',
  'nui.voice.dictate': 'พูดคำขอ',
  'nui.voice.stop': 'หยุดรับเสียง',
  // detail view
  'nui.detail.details': 'รายละเอียด',
  'nui.detail.edit': 'แก้ไข',
  'nui.detail.readonly': 'อ่านอย่างเดียว',
  // traverse bar (found-set browse)
  'nui.traverse.prev': 'ก่อนหน้า',
  'nui.traverse.next': 'ถัดไป',
  'nui.traverse.first': 'รายการแรก',
  'nui.traverse.last': 'รายการสุดท้าย',
  'nui.traverse.of': 'จาก',
  'nui.traverse.goto': 'ไปที่ #',
  'nui.traverse.back': 'กลับไปที่รายการ',
  // shared verbs
  'nui.save': 'บันทึก',
  'nui.cancel': 'ยกเลิก',
  'nui.clear': 'ล้าง',
  'nui.clearAll': 'ล้างทั้งหมด',
  'nui.reset': 'รีเซ็ต',
  'nui.selectAll': 'เลือกทั้งหมด',
}
