// server/utils/normalizeProductFields.ts

export function normalizeMaterial(material: string | null | undefined): string | null {
  if (!material) return null;
  const lower = material.toLowerCase();
  if (lower.includes('alumin') || lower.includes('alümin')) return 'Alüminyum';
  if (lower.includes('cast iron') || lower.includes('demir döküm')) return 'Demir Döküm';
  if (lower.includes('carbon steel') || lower.includes('karbon çelik')) return 'Karbon Çelik';
  if (lower.includes('ppr')) return 'PPR';
  return material;
}

export function normalizeModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const lower = model.toLowerCase();
  
  if (lower === 't' || lower === 'tee' || lower.includes('t bağlantı')) return 'Tee';
  if (lower === 'uzun t' || lower.includes('long tee')) return 'Long Tee';
  if (lower === '5 yollu' || lower.includes('5 way')) return '5 Way';
  if (lower === '6 yollu' || lower.includes('6 way')) return '6 Way';
  if (lower === 'büyük 4 yollu' || lower.includes('big 4 way')) return 'Big 4 Way';
  if (lower === '4 yollu' || lower === '4 way' || lower.includes('4-way')) return '4 Way';
  if (lower === '3 yollu' || lower === '3 way' || lower.includes('3-way')) return '3 Way';
  if (lower === 'dirsek' || lower.includes('elbow')) return 'Elbow';
  if (lower === 'çapraz' || lower.includes('cross')) return 'Cross';
  if (lower === 'düz ek vidalı' || lower.includes('coupling with screw')) return 'Coupling (Screw)';
  if (lower === 'düz ek' || lower.includes('coupling')) return 'Coupling';
  if (lower === 'base' || lower.includes('base flange') || lower.includes('taban')) return 'Base';
  if (lower.includes('45°') || lower.includes('45 derece')) return '45° Tee';
  
  return model;
}

export function normalizeSize(size: string | null | undefined): string | null {
  if (!size) return null;
  // Replace quotes with inch markers properly or similar, but generally keeping it as string
  return size.trim();
}

export function generateNormalizedFields(product: any) {
  return {
    normalized_material: normalizeMaterial(product.material) || 'Bilinmiyor',
    normalized_model: normalizeModel(product.model) || 'Bilinmiyor',
    normalized_size: normalizeSize(product.size) || 'Bilinmiyor',
    normalized_tube_type: product.category?.toLowerCase().includes('kare') || product.name?.toLowerCase().includes('kare') ? 'Kare' : 
                          (product.category?.toLowerCase().includes('yuvarlak') || product.name?.toLowerCase().includes('yuvarlak') ? 'Yuvarlak' : 'Bilinmiyor')
  };
}
