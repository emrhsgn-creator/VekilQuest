export function gurultuyuAyikla(metin: string): string;
export function oncululeriAyir(metin: string): string;
export function soruyuBicimle<T extends { metin: string; secenekler: { harf: string; metin: string }[] }>(soru: T): T;
export type MetinSatiri = { tur: 'paragraf' | 'oncul' | 'bosluk'; isaret?: string; metin: string };
export function satirlaraAyir(metin: string): MetinSatiri[];
