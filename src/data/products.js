// Fotos, nombres, precios y variantes tomados del catálogo PDF de Vibing Lights.
const base = import.meta.env.BASE_URL;
export const img = (name) => `${base}img/${name}.webp`;

const TRES = [
  { id: 'calida', label: 'Cálida', glow: '#ffa53a' },
  { id: 'neutra', label: 'Neutra', glow: '#fff0d6' },
  { id: 'fria', label: 'Fría', glow: '#9fd0ff' },
];

export const PRODUCTS = [
  {
    id: 'mushroom', name: 'Mushroom Lamp', price: 36, tag: '3 tipos de iluminación',
    glow: '#ff8a1f', pos: '45% 70%',
    variants: { label: 'Iluminación', options: TRES },
  },
  { id: 'sunset', name: 'Sunset Lamp', price: 17, tag: 'Lámpara tipo atardecer', glow: '#ff7a14', pos: '50% 60%' },
  { id: 'aura', name: 'Aura Lamp', price: 17, tag: 'Lámpara tonos galaxia', glow: '#a45cff', pos: '50% 55%' },
  {
    id: 'water', name: 'Water Lamp', price: 21, tag: '+16 colores', glow: '#ff9a3c', pos: '50% 75%',
    examples: ['water-v1', 'water-v2', 'water-v3'],
  },
  {
    id: 'lava', name: 'Lava Lamp', price: 31, tag: 'Color rojo, naranja y azul', glow: '#ff3a2a', pos: '50% 55%',
    variants: {
      label: 'Color',
      options: [
        { id: 'rojo', label: 'Rojo', glow: '#ff2b2b' },
        { id: 'naranja', label: 'Naranja', glow: '#ff9a1a' },
        { id: 'azul', label: 'Azul', glow: '#2f7bff' },
      ],
    },
  },
  {
    id: 'donut', name: 'Donut Lamp', price: 39, tag: '3 tipos de iluminación', glow: '#ffa11a', pos: '50% 50%',
    variants: { label: 'Iluminación', options: TRES },
  },
  {
    id: 'fungi', name: 'Fungi Lamp', price: 31, tag: '3 tipos de iluminación', glow: '#ffd9a0', pos: '50% 35%',
    variants: { label: 'Iluminación', options: TRES },
  },
];

export const byId = (id) => PRODUCTS.find((p) => p.id === id);

export const VIBES = [
  { id: 'chill', label: 'Chill cálido', note: 'Luz naranja y de atardecer para relajarte al final del día.', picks: ['sunset', 'mushroom'] },
  { id: 'fiesta', label: 'Fiesta color', note: 'Colores que se notan en cualquier cuarto.', picks: ['lava', 'water'] },
  { id: 'minimal', label: 'Minimal', note: 'Formas simples que se ven bien en cualquier mesa.', picks: ['fungi', 'donut'] },
  { id: 'galaxia', label: 'Galaxia', note: 'Tonos que parecen de otro planeta.', picks: ['aura', 'water'] },
];
