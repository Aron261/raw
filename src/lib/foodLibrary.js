// Biblioteca local de comidas típicas con macros por porción estándar.
// Aparecen como sugerencias en el sheet de agregar comida, junto a las
// recientes del usuario. Sin API externa: instantáneo y offline.
//
// Valores aproximados por porción (USDA / tablas colombianas redondeadas).

export const FOOD_LIBRARY = [
  // ── Proteínas ──
  { name: 'Pechuga de pollo',        serving: '100 g',        kcal: 165, protein_g: 31,   carbs_g: 0,    fat_g: 3.6 },
  { name: 'Muslo de pollo',          serving: '100 g',        kcal: 209, protein_g: 26,   carbs_g: 0,    fat_g: 11 },
  { name: 'Carne de res magra',      serving: '100 g',        kcal: 190, protein_g: 26,   carbs_g: 0,    fat_g: 9 },
  { name: 'Carne molida de res',     serving: '100 g',        kcal: 250, protein_g: 26,   carbs_g: 0,    fat_g: 15 },
  { name: 'Lomo de cerdo',           serving: '100 g',        kcal: 143, protein_g: 26,   carbs_g: 0,    fat_g: 3.5 },
  { name: 'Chicharrón',              serving: '50 g',         kcal: 260, protein_g: 15,   carbs_g: 0,    fat_g: 22 },
  { name: 'Tilapia',                 serving: '100 g',        kcal: 96,  protein_g: 20,   carbs_g: 0,    fat_g: 1.7 },
  { name: 'Salmón',                  serving: '100 g',        kcal: 208, protein_g: 20,   carbs_g: 0,    fat_g: 13 },
  { name: 'Atún en lata (agua)',     serving: '1 lata',       kcal: 116, protein_g: 25,   carbs_g: 0,    fat_g: 1 },
  { name: 'Camarones',               serving: '100 g',        kcal: 99,  protein_g: 24,   carbs_g: 0.2,  fat_g: 0.3 },
  { name: 'Huevo',                   serving: '1 unidad',     kcal: 72,  protein_g: 6.3,  carbs_g: 0.4,  fat_g: 4.8 },
  { name: 'Clara de huevo',          serving: '1 unidad',     kcal: 17,  protein_g: 3.6,  carbs_g: 0.2,  fat_g: 0 },
  { name: 'Jamón de pavo',           serving: '2 tajadas',    kcal: 60,  protein_g: 8,    carbs_g: 2,    fat_g: 2 },
  { name: 'Proteína whey',           serving: '1 scoop 30 g', kcal: 120, protein_g: 24,   carbs_g: 3,    fat_g: 1.5 },
  { name: 'Queso mozzarella',        serving: '30 g',         kcal: 85,  protein_g: 6.3,  carbs_g: 0.6,  fat_g: 6.3 },
  { name: 'Queso campesino',         serving: '30 g',         kcal: 80,  protein_g: 5,    carbs_g: 1,    fat_g: 6 },

  // ── Carbohidratos ──
  { name: 'Arroz blanco cocido',     serving: '1 taza',       kcal: 205, protein_g: 4.3,  carbs_g: 45,   fat_g: 0.4 },
  { name: 'Arroz integral cocido',   serving: '1 taza',       kcal: 216, protein_g: 5,    carbs_g: 45,   fat_g: 1.8 },
  { name: 'Pasta cocida',            serving: '1 taza',       kcal: 220, protein_g: 8,    carbs_g: 43,   fat_g: 1.3 },
  { name: 'Papa cocida',             serving: '1 mediana',    kcal: 130, protein_g: 2.9,  carbs_g: 30,   fat_g: 0.2 },
  { name: 'Papa criolla',            serving: '100 g',        kcal: 80,  protein_g: 2,    carbs_g: 18,   fat_g: 0.1 },
  { name: 'Yuca cocida',             serving: '100 g',        kcal: 160, protein_g: 1.4,  carbs_g: 38,   fat_g: 0.3 },
  { name: 'Plátano maduro cocido',   serving: '100 g',        kcal: 122, protein_g: 1,    carbs_g: 32,   fat_g: 0.2 },
  { name: 'Arepa blanca',            serving: '1 unidad',     kcal: 170, protein_g: 3.5,  carbs_g: 35,   fat_g: 2 },
  { name: 'Arepa con queso',         serving: '1 unidad',     kcal: 280, protein_g: 9,    carbs_g: 34,   fat_g: 12 },
  { name: 'Pan blanco',              serving: '1 tajada',     kcal: 75,  protein_g: 2.5,  carbs_g: 14,   fat_g: 1 },
  { name: 'Pan integral',            serving: '1 tajada',     kcal: 80,  protein_g: 4,    carbs_g: 14,   fat_g: 1.1 },
  { name: 'Avena en hojuelas',       serving: '½ taza 40 g',  kcal: 150, protein_g: 5,    carbs_g: 27,   fat_g: 3 },
  { name: 'Tortilla de trigo',       serving: '1 unidad',     kcal: 140, protein_g: 4,    carbs_g: 24,   fat_g: 3.5 },
  { name: 'Frijoles cocidos',        serving: '1 taza',       kcal: 245, protein_g: 15,   carbs_g: 45,   fat_g: 1 },
  { name: 'Lentejas cocidas',        serving: '1 taza',       kcal: 230, protein_g: 18,   carbs_g: 40,   fat_g: 0.8 },
  { name: 'Garbanzos cocidos',       serving: '1 taza',       kcal: 269, protein_g: 14.5, carbs_g: 45,   fat_g: 4.2 },
  { name: 'Quinua cocida',           serving: '1 taza',       kcal: 222, protein_g: 8,    carbs_g: 39,   fat_g: 3.6 },
  { name: 'Galletas de soda',        serving: '3 unidades',   kcal: 90,  protein_g: 2,    carbs_g: 15,   fat_g: 2.5 },
  { name: 'Cereal',                  serving: '1 taza 30 g',  kcal: 110, protein_g: 2,    carbs_g: 24,   fat_g: 1 },

  // ── Frutas ──
  { name: 'Banano',                  serving: '1 unidad',     kcal: 105, protein_g: 1.3,  carbs_g: 27,   fat_g: 0.4 },
  { name: 'Manzana',                 serving: '1 unidad',     kcal: 95,  protein_g: 0.5,  carbs_g: 25,   fat_g: 0.3 },
  { name: 'Mango',                   serving: '1 taza',       kcal: 99,  protein_g: 1.4,  carbs_g: 25,   fat_g: 0.6 },
  { name: 'Papaya',                  serving: '1 taza',       kcal: 62,  protein_g: 0.7,  carbs_g: 16,   fat_g: 0.4 },
  { name: 'Fresas',                  serving: '1 taza',       kcal: 49,  protein_g: 1,    carbs_g: 12,   fat_g: 0.5 },
  { name: 'Naranja',                 serving: '1 unidad',     kcal: 62,  protein_g: 1.2,  carbs_g: 15,   fat_g: 0.2 },
  { name: 'Uvas',                    serving: '1 taza',       kcal: 104, protein_g: 1,    carbs_g: 27,   fat_g: 0.2 },
  { name: 'Piña',                    serving: '1 taza',       kcal: 82,  protein_g: 0.9,  carbs_g: 22,   fat_g: 0.2 },
  { name: 'Sandía',                  serving: '1 taza',       kcal: 46,  protein_g: 0.9,  carbs_g: 11.5, fat_g: 0.2 },
  { name: 'Aguacate',                serving: '½ unidad',     kcal: 120, protein_g: 1.5,  carbs_g: 6,    fat_g: 11 },

  // ── Lácteos ──
  { name: 'Leche entera',            serving: '1 vaso 240 ml', kcal: 149, protein_g: 7.7, carbs_g: 11.7, fat_g: 8 },
  { name: 'Leche descremada',        serving: '1 vaso 240 ml', kcal: 83,  protein_g: 8.3, carbs_g: 12.2, fat_g: 0.2 },
  { name: 'Yogur griego natural',    serving: '170 g',        kcal: 100, protein_g: 17,   carbs_g: 6,    fat_g: 0.7 },
  { name: 'Yogur',                   serving: '1 vaso',       kcal: 160, protein_g: 6,    carbs_g: 26,   fat_g: 3.5 },
  { name: 'Queso crema',             serving: '2 cdas',       kcal: 100, protein_g: 1.8,  carbs_g: 1.6,  fat_g: 10 },

  // ── Grasas y frutos secos ──
  { name: 'Maní',                    serving: '30 g',         kcal: 170, protein_g: 7,    carbs_g: 6,    fat_g: 15 },
  { name: 'Almendras',               serving: '30 g',         kcal: 174, protein_g: 6.4,  carbs_g: 6,    fat_g: 15 },
  { name: 'Nueces',                  serving: '30 g',         kcal: 196, protein_g: 4.6,  carbs_g: 4,    fat_g: 19.6 },
  { name: 'Mantequilla de maní',     serving: '1 cda',        kcal: 95,  protein_g: 4,    carbs_g: 3.5,  fat_g: 8 },
  { name: 'Aceite de oliva',         serving: '1 cda',        kcal: 119, protein_g: 0,    carbs_g: 0,    fat_g: 13.5 },
  { name: 'Mantequilla',             serving: '1 cda',        kcal: 102, protein_g: 0.1,  carbs_g: 0,    fat_g: 11.5 },

  // ── Platos y antojos típicos (aproximados) ──
  { name: 'Empanada',                serving: '1 unidad',     kcal: 300, protein_g: 7,    carbs_g: 30,   fat_g: 17 },
  { name: 'Buñuelo',                 serving: '1 unidad',     kcal: 220, protein_g: 4,    carbs_g: 22,   fat_g: 13 },
  { name: 'Pandebono',               serving: '1 unidad',     kcal: 210, protein_g: 6,    carbs_g: 25,   fat_g: 9.5 },
  { name: 'Almojábana',              serving: '1 unidad',     kcal: 180, protein_g: 6,    carbs_g: 22,   fat_g: 7.5 },
  { name: 'Tamal',                   serving: '1 unidad',     kcal: 550, protein_g: 20,   carbs_g: 50,   fat_g: 30 },
  { name: 'Caldo de costilla',       serving: '1 taza',       kcal: 150, protein_g: 12,   carbs_g: 6,    fat_g: 8.5 },
  { name: 'Sancocho',                serving: '1 plato',      kcal: 400, protein_g: 25,   carbs_g: 40,   fat_g: 15 },
  { name: 'Ajiaco',                  serving: '1 plato',      kcal: 350, protein_g: 25,   carbs_g: 35,   fat_g: 11 },
  { name: 'Arroz con pollo',         serving: '1 plato',      kcal: 450, protein_g: 25,   carbs_g: 55,   fat_g: 14 },
  { name: 'Hamburguesa sencilla',    serving: '1 unidad',     kcal: 350, protein_g: 17,   carbs_g: 33,   fat_g: 16.5 },
  { name: 'Pizza',                   serving: '1 porción',    kcal: 285, protein_g: 12,   carbs_g: 36,   fat_g: 10 },
  { name: 'Perro caliente',          serving: '1 unidad',     kcal: 300, protein_g: 10,   carbs_g: 24,   fat_g: 18 },
  { name: 'Salchipapa',              serving: '1 porción',    kcal: 600, protein_g: 15,   carbs_g: 55,   fat_g: 35 },

  // ── Bebidas ──
  { name: 'Gaseosa',                 serving: '1 lata',       kcal: 140, protein_g: 0,    carbs_g: 39,   fat_g: 0 },
  { name: 'Jugo de naranja',         serving: '1 vaso',       kcal: 110, protein_g: 1.7,  carbs_g: 26,   fat_g: 0.5 },
  { name: 'Aguapanela',              serving: '1 vaso',       kcal: 120, protein_g: 0,    carbs_g: 30,   fat_g: 0 },
  { name: 'Cerveza',                 serving: '1 lata',       kcal: 150, protein_g: 1.6,  carbs_g: 13,   fat_g: 0 },
  { name: 'Café con leche',          serving: '1 taza',       kcal: 60,  protein_g: 3,    carbs_g: 6,    fat_g: 2.5 },
  { name: 'Chocolate caliente',      serving: '1 taza',       kcal: 190, protein_g: 7,    carbs_g: 27,   fat_g: 6 },
]

// Búsqueda sin tildes ni mayúsculas ("platano" encuentra "Plátano").
export const normalizeFood = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function searchFoods(query, limit = 5) {
  const q = normalizeFood(query)
  if (q.length < 2) return []
  return FOOD_LIBRARY.filter(f => normalizeFood(f.name).includes(q)).slice(0, limit)
}

// "100 g" → {qty:100, unit:'g'} · "6 unidades" → {qty:6, unit:'unidades'}
// "1 scoop 30 g" → {qty:30, unit:'g'} (si hay gramos/ml, mandan ellos).
export function parseServing(serving) {
  if (!serving) return { qty: 1, unit: 'porción' }
  const s = serving.replace('½', '0.5')
  const gml = s.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/)
  if (gml) return { qty: parseFloat(gml[1]), unit: gml[2] }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(.+)$/)
  if (m) return { qty: parseFloat(m[1]), unit: m[2].trim() }
  return { qty: 1, unit: serving }
}
