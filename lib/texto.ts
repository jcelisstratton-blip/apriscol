/** Un texto sin tildes ni mayúsculas, para buscar «cabra» y encontrar «Cabra» y «cábra». */
export const sinTildes = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
