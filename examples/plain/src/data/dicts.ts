export const GENRE_LABELS: Record<string, { en: string; th: string }> = {
  rock: { en: 'Rock', th: 'ร็อก' },
  jazz: { en: 'Jazz', th: 'แจ๊ส' },
  soul: { en: 'Soul', th: 'โซล' },
  electronic: { en: 'Electronic', th: 'อิเล็กทรอนิก' },
  hiphop: { en: 'Hip-Hop', th: 'ฮิปฮอป' },
  classical: { en: 'Classical', th: 'คลาสสิก' },
}
export const FORMAT_LABELS: Record<string, { en: string; th: string }> = {
  LP: { en: 'LP', th: 'แผ่นใหญ่ (LP)' },
  EP: { en: 'EP', th: 'อีพี (EP)' },
  Single: { en: 'Single', th: 'ซิงเกิล' },
  '12"': { en: '12-inch', th: '12 นิ้ว' },
}
export const CONDITION_LABELS: Record<string, { en: string; th: string }> = {
  M: { en: 'Mint', th: 'สภาพดีเยี่ยม' },
  NM: { en: 'Near Mint', th: 'เกือบสมบูรณ์' },
  'VG+': { en: 'Very Good Plus', th: 'ดีมากบวก' },
  VG: { en: 'Very Good', th: 'ดีมาก' },
  G: { en: 'Good', th: 'พอใช้' },
}
export const COUNTRY_LABELS: Record<string, { en: string; th: string }> = {
  US: { en: 'United States', th: 'สหรัฐอเมริกา' },
  GB: { en: 'United Kingdom', th: 'สหราชอาณาจักร' },
  JP: { en: 'Japan', th: 'ญี่ปุ่น' },
  DE: { en: 'Germany', th: 'เยอรมนี' },
  AT: { en: 'Austria', th: 'ออสเตรีย' },
}
// Per-collection field labels (used as i18n metadata when seeding).
export const FIELD_LABELS: Record<string, Record<string, { en: string; th: string }>> = {
  records: {
    title: { en: 'Title', th: 'ชื่ออัลบั้ม' },
    artistId: { en: 'Artist', th: 'ศิลปิน' },
    labelId: { en: 'Label', th: 'ค่ายเพลง' },
    year: { en: 'Year', th: 'ปี' },
    genre: { en: 'Genre', th: 'แนวเพลง' },
    format: { en: 'Format', th: 'รูปแบบ' },
    condition: { en: 'Condition', th: 'สภาพ' },
    durationMin: { en: 'Duration', th: 'ความยาว' },
    trackCount: { en: 'Tracks', th: 'จำนวนเพลง' },
    rating: { en: 'Rating', th: 'คะแนน' },
    priceUsd: { en: 'Price', th: 'ราคา' },
    purchasedOn: { en: 'Purchased', th: 'วันที่ซื้อ' },
    favorite: { en: 'Favorite', th: 'รายการโปรด' },
    notes: { en: 'Notes', th: 'บันทึก' },
    shopUrl: { en: 'Shop link', th: 'ลิงก์ร้านค้า' },
  },
  artists: {
    name: { en: 'Name', th: 'ชื่อ' },
    country: { en: 'Country', th: 'ประเทศ' },
    formedYear: { en: 'Formed', th: 'ก่อตั้ง' },
    genre: { en: 'Genre', th: 'แนวเพลง' },
  },
  labels: {
    name: { en: 'Name', th: 'ชื่อ' },
    country: { en: 'Country', th: 'ประเทศ' },
    founded: { en: 'Founded', th: 'ก่อตั้ง' },
    notes: { en: 'Notes', th: 'บันทึก' },
  },
}
