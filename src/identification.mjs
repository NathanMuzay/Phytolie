// Keep the provider mapping independent of HTTP for regression tests.
export function mapSuggestions(result) {
  if (result?.result?.is_plant?.binary === false) return [];
  const suggestions = result?.result?.classification?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter(s => typeof s?.name === 'string' && s.name.trim())
    .map(s => {
      const details = s.details || {};
      return {
        commonName: details.common_names?.find?.(n => typeof n === 'string' && n.trim()) || s.name,
        scientificName: s.name,
        family: typeof details.taxonomy?.family === 'string' ? details.taxonomy.family : '',
        confidence: Number.isFinite(s.probability) ? Math.max(0, Math.min(1, s.probability)) : 0,
        // Numeric watering levels are not doses or frequencies: do not present them as advice.
        wateringAdvice: typeof details.watering === 'string' ? details.watering : '',
        description: typeof details.description === 'string' ? details.description : typeof details.description?.value === 'string' ? details.description.value : '',
      };
    }).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
