// Thai catalog for the ENGINE's own UI strings — the structural words narrate/pills/suggest emit
// (`nui.q.*`, pill heads, suggestion labels/hints). Domain words (entity nouns `nui.q.noun.<entity>`,
// per-entity "all" titles `nui.q.all.<entity>`, field labels, enum values) are the HOST's data and
// never live here. Hosts spread this into their own translator:
//   t: (k, f) => ({ ...LOCALE_TH, ...appTh })[k] ?? f
// The Nuxt binding re-exports it merged with the component-chrome catalog (NUI_LOCALE_TH).
export const LOCALE_TH: Record<string, string> = {
  // narrate structural words
  'nui.q.all': 'ทั้งหมด',
  'nui.q.and': 'และ',
  'nui.q.or': 'หรือ',
  'nui.q.not': 'ไม่ใช่',
  'nui.q.notColon': 'ไม่ใช่',
  'nui.q.either': 'ไม่ว่าจะเป็น',
  'nui.q.by': 'ตาม',
  'nui.q.groupedBy': 'จัดกลุ่มตาม',
  'nui.q.sortedBy': 'เรียงตาม',
  'nui.q.ascending': 'น้อยไปมาก',
  'nui.q.descending': 'มากไปน้อย',
  'nui.q.with': 'ที่มี',
  'nui.q.matching': 'ที่ตรงกับ',
  'nui.q.in': 'ใน',
  'nui.q.from': 'จาก',
  'nui.q.since': 'ตั้งแต่',
  'nui.q.before': 'ก่อน',
  'nui.q.between': 'ระหว่าง',
  'nui.q.over': 'มากกว่า',
  'nui.q.under': 'ต่ำกว่า',
  'nui.q.atLeast': 'อย่างน้อย',
  'nui.q.atMost': 'ไม่เกิน',
  'nui.q.upTo': 'ไม่เกิน',
  // pill heads (astToPills)
  'nui.pill.sort': 'เรียง:',
  'nui.pill.group': 'กลุ่ม:',
  'nui.pill.show': 'แสดง:',
  'nui.pill.hide': 'ซ่อน:',
  // suggestion labels (buildSuggestions) + the hint chips its results carry
  'nui.sug.search': 'ค้นหา',
  'nui.sug.show': 'แสดง',
  'nui.sug.hide': 'ซ่อน',
  'nui.group.title': 'จัดกลุ่มตาม', // shared: `group:` suggestions here, the GroupByControl in the binding
  'nui.hint.field': 'ฟิลด์',
  'nui.hint.filter': 'ตัวกรอง',
  'nui.hint.date': 'วันที่',
  'nui.hint.text': 'ข้อความ',
  'nui.hint.group': 'กลุ่ม',
  'nui.hint.show': 'แสดง',
  'nui.hint.hide': 'ซ่อน',
}
