/**
 * IndexedDB üzerinde basit anahtar-değer deposu.
 *
 * Soru bankası birkaç bin soruya çıkabildiği için localStorage'ın 5 MB sınırına
 * takılmamak adına IndexedDB kullanılıyor. Ayarlar gibi küçük ve senkron
 * okunması gereken veriler localStorage'da tutuluyor.
 */

const DB_ADI = 'vekilquest';
const STORE = 'kv';

let dbSozu: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbSozu) {
    dbSozu = new Promise((resolve, reject) => {
      const istek = indexedDB.open(DB_ADI, 1);
      istek.onupgradeneeded = () => {
        if (!istek.result.objectStoreNames.contains(STORE)) {
          istek.result.createObjectStore(STORE);
        }
      };
      istek.onsuccess = () => resolve(istek.result);
      istek.onerror = () => reject(istek.error);
    });
  }
  return dbSozu;
}

async function islem<T>(
  mod: IDBTransactionMode,
  gorev: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const baglanti = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = baglanti.transaction(STORE, mod);
    const istek = gorev(tx.objectStore(STORE));
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

export async function oku<T>(anahtar: string, varsayilan: T): Promise<T> {
  try {
    const deger = await islem<T | undefined>('readonly', (s) => s.get(anahtar));
    return deger === undefined ? varsayilan : deger;
  } catch {
    return varsayilan;
  }
}

export async function yaz<T>(anahtar: string, deger: T): Promise<void> {
  await islem('readwrite', (s) => s.put(deger, anahtar));
}

export async function sil(anahtar: string): Promise<void> {
  await islem('readwrite', (s) => s.delete(anahtar));
}

/** Ayarlar gibi küçük veriler için senkron localStorage yardımcıları. */
export function yerelOku<T>(anahtar: string, varsayilan: T): T {
  try {
    const ham = localStorage.getItem(anahtar);
    if (!ham) return varsayilan;
    const deger = JSON.parse(ham);
    // Nesnelerde varsayılanla birleştir (yeni ayar alanları eklendiğinde eski
    // kayıtlar bozulmasın); string/sayı/dizi gibi değerlerde olduğu gibi dön.
    const nesneMi = (x: unknown) => typeof x === 'object' && x !== null && !Array.isArray(x);
    return nesneMi(varsayilan) && nesneMi(deger) ? ({ ...varsayilan, ...deger } as T) : (deger as T);
  } catch {
    return varsayilan;
  }
}

export function yerelYaz(anahtar: string, deger: unknown): void {
  try {
    localStorage.setItem(anahtar, JSON.stringify(deger));
  } catch {
    /* kota dolu — sessizce geç */
  }
}
