import type { Artist, Label, Record } from './types'

export const artists: Artist[] = [
  { id: 'ar1', name: { en: 'The Midnight Echoes', th: 'เดอะ มิดไนท์ เอโค' }, country: 'GB', formedYear: 1971, genre: 'rock' },
  { id: 'ar2', name: { en: 'Blue Quartet', th: 'บลู ควอเต็ต' }, country: 'US', formedYear: 1959, genre: 'jazz' },
  { id: 'ar3', name: { en: 'Marvelle', th: 'มาร์เวล' }, country: 'US', formedYear: 1966, genre: 'soul' },
  { id: 'ar4', name: { en: 'Neon Circuit', th: 'นีออน เซอร์กิต' }, country: 'DE', formedYear: 1978, genre: 'electronic' },
  { id: 'ar5', name: { en: 'Crate Diggers', th: 'เคร็ต ดิกเกอร์ส' }, country: 'US', formedYear: 1992, genre: 'hiphop' },
  { id: 'ar6', name: { en: 'Aurelia Strings', th: 'ออเรเลีย สตริงส์' }, country: 'AT', formedYear: 1948, genre: 'classical' },
  { id: 'ar7', name: { en: 'Velvet Static', th: 'เวลเว็ต สแตติก' }, country: 'GB', formedYear: 1985, genre: 'rock' },
  { id: 'ar8', name: { en: 'Sun Ra Tribute', th: 'ซัน รา ทริบิวต์' }, country: 'US', formedYear: 1974, genre: 'jazz' },
  { id: 'ar9', name: { en: 'Tokyo Pulse', th: 'โตเกียว พัลส์' }, country: 'JP', formedYear: 1983, genre: 'electronic' },
]

export const labels: Label[] = [
  { id: 'lb1', name: { en: 'Groove Hill', th: 'กรูฟ ฮิลล์' }, country: 'US', founded: 1958, notes: { en: 'Independent jazz and soul imprint; deep-groove pressings through 1972.', th: 'ค่ายแจ๊สและโซลอิสระ งานปั๊มแบบดีพกรูฟจนถึงปี 1972' } },
  { id: 'lb2', name: { en: 'Northern Wax', th: 'นอร์เทิร์น แว็กซ์' }, country: 'GB', founded: 1969, notes: { en: 'British rock house — famous for gatefold sleeves and heavyweight vinyl.', th: 'ค่ายร็อกอังกฤษ ขึ้นชื่อเรื่องปกแบบเกตโฟลด์และแผ่นไวนิลหนา' } },
  { id: 'lb3', name: { en: 'Kosmos Audio', th: 'คอสมอส ออดิโอ' }, country: 'DE', founded: 1975, notes: { en: 'German audiophile label; classical and electronic catalogues.', th: 'ค่ายออดิโอไฟล์เยอรมัน แคตตาล็อกคลาสสิกและอิเล็กทรอนิกส์' } },
  { id: 'lb4', name: { en: 'Deep Crate', th: 'ดีพ เคร็ต' }, country: 'US', founded: 1990, notes: { en: 'Crate-digger favourite — limited hip-hop and soul runs.', th: 'ขวัญใจนักขุดแผ่น งานฮิปฮอปและโซลจำนวนจำกัด' } },
  { id: 'lb5', name: { en: 'Sakura Sound', th: 'ซากุระ ซาวด์' }, country: 'JP', founded: 1981, notes: { en: 'City pop and ambient catalogue.' } },
]

// 24 records — vary every enum, ref, and numeric field.
export const records: Record[] = [
  { id: 'rc01', title: { en: 'Echoes at Dawn', th: 'เสียงสะท้อนรุ่งอรุณ' }, artistId: 'ar1', labelId: 'lb2', year: 1973, genre: 'rock', format: 'LP', condition: 'NM', durationMin: 42.5, trackCount: 9, rating: 5, priceUsd: 34, purchasedOn: '2024-03-11', favorite: true, notes: 'Gatefold sleeve, first press.' },
  { id: 'rc02', title: { en: 'Quartet in Blue', th: 'ควอเต็ตในสีน้ำเงิน' }, artistId: 'ar2', labelId: 'lb1', year: 1961, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 38.2, trackCount: 6, rating: 5, priceUsd: 58, purchasedOn: '2023-11-02', favorite: true, notes: 'Mono pressing.', shopUrl: 'https://vinyl.example/quartet-in-blue' },
  { id: 'rc03', title: { en: 'Sweet Marvelle', th: 'สวีท มาร์เวล' }, artistId: 'ar3', labelId: 'lb1', year: 1968, genre: 'soul', format: 'LP', condition: 'VG', durationMin: 35.0, trackCount: 10, rating: 4, priceUsd: 22, purchasedOn: '2024-01-19', favorite: false, notes: 'Light surface noise side B.' },
  { id: 'rc04', title: { en: 'Circuit Bloom', th: 'เซอร์กิต บลูม' }, artistId: 'ar4', labelId: 'lb3', year: 1981, genre: 'electronic', format: '12"', condition: 'NM', durationMin: 18.4, trackCount: 3, rating: 4, priceUsd: 27, purchasedOn: '2024-05-06', favorite: false, notes: 'Extended club mix.' },
  { id: 'rc05', title: { en: 'Boom Bap Almanac', th: 'บูม แบป อัลมาแนค' }, artistId: 'ar5', labelId: 'lb4', year: 1995, genre: 'hiphop', format: 'LP', condition: 'M', durationMin: 51.0, trackCount: 14, rating: 5, priceUsd: 45, purchasedOn: '2024-02-28', favorite: true, notes: 'Sealed reissue.', shopUrl: 'https://vinyl.example/boom-bap-almanac' },
  { id: 'rc06', title: { en: 'Adagio for Strings', th: 'อาดาจิโอ สำหรับเครื่องสาย' }, artistId: 'ar6', labelId: 'lb3', year: 1955, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 47.3, trackCount: 4, rating: 4, priceUsd: 30, purchasedOn: '2023-09-14', favorite: false, notes: 'Deutsche pressing.' },
  { id: 'rc07', title: { en: 'Static Velvet', th: 'สแตติก เวลเว็ต' }, artistId: 'ar7', labelId: 'lb2', year: 1987, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 22.0, trackCount: 4, rating: 3, priceUsd: 15, purchasedOn: '2024-04-21', favorite: false, notes: '' },
  { id: 'rc08', title: { en: 'Space Chant', th: 'บทสวดอวกาศ' }, artistId: 'ar8', labelId: 'lb1', year: 1976, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 44.6, trackCount: 7, rating: 4, priceUsd: 40, purchasedOn: '2023-12-09', favorite: false, notes: 'Spiritual jazz classic.' },
  { id: 'rc09', title: { en: 'Tokyo Pulse I', th: 'โตเกียว พัลส์ I' }, artistId: 'ar9', labelId: 'lb5', year: 1984, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 39.9, trackCount: 8, rating: 5, priceUsd: 62, purchasedOn: '2024-06-01', favorite: true, notes: 'City pop crossover.' },
  { id: 'rc10', title: { en: 'Echoes at Dusk', th: 'เสียงสะท้อนยามพลบค่ำ' }, artistId: 'ar1', labelId: 'lb2', year: 1975, genre: 'rock', format: 'LP', condition: 'VG+', durationMin: 40.1, trackCount: 8, rating: 4, priceUsd: 28, purchasedOn: '2024-03-12', favorite: false, notes: '' },
  { id: 'rc11', title: { en: 'Blue Note Sketches', th: 'สเก็ตช์บลูโน้ต' }, artistId: 'ar2', labelId: 'lb1', year: 1963, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 36.8, trackCount: 6, rating: 4, priceUsd: 33, purchasedOn: '2023-10-30', favorite: false, notes: '' },
  { id: 'rc12', title: { en: 'Marvelle Live', th: 'มาร์เวล ไลฟ์' }, artistId: 'ar3', labelId: 'lb1', year: 1970, genre: 'soul', format: 'LP', condition: 'G', durationMin: 48.0, trackCount: 11, rating: 3, priceUsd: 18, purchasedOn: '2024-01-20', favorite: false, notes: 'Well-played copy.' },
  { id: 'rc13', title: { en: 'Neon Drift', th: 'นีออน ดริฟท์' }, artistId: 'ar4', labelId: 'lb3', year: 1983, genre: 'electronic', format: 'Single', condition: 'NM', durationMin: 7.5, trackCount: 2, rating: 3, priceUsd: 12, purchasedOn: '2024-05-07', favorite: false, notes: '' },
  { id: 'rc14', title: { en: 'Crate Diggers Vol. 2', th: 'เคร็ต ดิกเกอร์ส ฉบับ 2' }, artistId: 'ar5', labelId: 'lb4', year: 1997, genre: 'hiphop', format: 'LP', condition: 'NM', durationMin: 49.5, trackCount: 13, rating: 4, priceUsd: 38, purchasedOn: '2024-03-01', favorite: false, notes: '' },
  { id: 'rc15', title: { en: 'Concerto No. 3', th: 'คอนแชร์โต หมายเลข 3' }, artistId: 'ar6', labelId: 'lb3', year: 1958, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 52.2, trackCount: 3, rating: 5, priceUsd: 41, purchasedOn: '2023-09-15', favorite: true, notes: '' },
  { id: 'rc16', title: { en: 'Velvet Static II', th: 'เวลเว็ต สแตติก II' }, artistId: 'ar7', labelId: 'lb2', year: 1989, genre: 'rock', format: 'LP', condition: 'VG', durationMin: 43.0, trackCount: 10, rating: 3, priceUsd: 20, purchasedOn: '2024-04-22', favorite: false, notes: '' },
  { id: 'rc17', title: { en: 'Cosmic Suite', th: 'ชุดอวกาศ' }, artistId: 'ar8', labelId: 'lb1', year: 1978, genre: 'jazz', format: '12"', condition: 'NM', durationMin: 19.8, trackCount: 2, rating: 4, priceUsd: 26, purchasedOn: '2023-12-10', favorite: false, notes: '' },
  { id: 'rc18', title: { en: 'Tokyo Pulse II', th: 'โตเกียว พัลส์ II' }, artistId: 'ar9', labelId: 'lb5', year: 1986, genre: 'electronic', format: 'LP', condition: 'M', durationMin: 41.2, trackCount: 9, rating: 5, priceUsd: 70, purchasedOn: '2024-06-02', favorite: true, notes: 'Obi strip intact.', shopUrl: 'https://vinyl.example/tokyo-pulse-ii' },
  { id: 'rc19', title: { en: 'Midnight Reprise', th: 'มิดไนท์ รีไพรส์' }, artistId: 'ar1', labelId: 'lb2', year: 1979, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 24.5, trackCount: 5, rating: 4, priceUsd: 19, purchasedOn: '2024-03-13', favorite: false, notes: '' },
  { id: 'rc20', title: { en: 'After Hours', th: 'หลังเวลางาน' }, artistId: 'ar2', labelId: 'lb1', year: 1965, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 37.7, trackCount: 7, rating: 4, priceUsd: 35, purchasedOn: '2023-11-03', favorite: false, notes: '' },
  { id: 'rc21', title: { en: 'Soul Revival', th: 'โซล รีไวเวิล' }, artistId: 'ar3', labelId: 'lb4', year: 1972, genre: 'soul', format: 'Single', condition: 'VG', durationMin: 6.8, trackCount: 2, rating: 3, priceUsd: 10, purchasedOn: '2024-01-21', favorite: false, notes: '' },
  { id: 'rc22', title: { en: 'Kosmos Drift', th: 'คอสมอส ดริฟท์' }, artistId: 'ar4', labelId: 'lb3', year: 1985, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 45.0, trackCount: 8, rating: 4, priceUsd: 32, purchasedOn: '2024-05-08', favorite: false, notes: '' },
  { id: 'rc23', title: { en: 'Diggin Deeper', th: 'ขุดลึกลงไปอีก' }, artistId: 'ar5', labelId: 'lb4', year: 1999, genre: 'hiphop', format: '12"', condition: 'M', durationMin: 16.5, trackCount: 3, rating: 4, priceUsd: 24, purchasedOn: '2024-03-02', favorite: false, notes: '' },
  { id: 'rc24', title: { en: 'String Theory', th: 'ทฤษฎีสตริง' }, artistId: 'ar6', labelId: 'lb3', year: 1961, genre: 'classical', format: 'LP', condition: 'VG', durationMin: 50.0, trackCount: 5, rating: 4, priceUsd: 29, purchasedOn: '2023-09-16', favorite: false, notes: '' },
]
