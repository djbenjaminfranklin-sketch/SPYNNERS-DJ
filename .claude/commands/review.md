# Code Review Command

Effectue une revue de code approfondie des fichiers specifies ou des changements recents.

## Instructions

1. Identifie les fichiers a reviewer: $ARGUMENTS
2. Analyse le code selon les criteres ci-dessous
3. Produis un rapport structure

## Criteres de Review

### TypeScript
- [ ] Typage complet (pas de `any`)
- [ ] Interfaces bien definies
- [ ] Generics utilises correctement
- [ ] Enums pour les constantes

### React Native
- [ ] Composants fonctionnels
- [ ] Hooks utilises correctement
- [ ] Pas de re-renders inutiles
- [ ] memo/useCallback/useMemo bien places
- [ ] StyleSheet (pas de styles inline)

### Performance
- [ ] FlatList optimisees
- [ ] Images dimensionnees
- [ ] Pas de calculs lourds dans render
- [ ] Cleanup des effets

### Securite
- [ ] Pas de secrets en dur
- [ ] Validation des inputs
- [ ] Sanitization des donnees

### Accessibilite
- [ ] accessibilityLabel presents
- [ ] accessibilityRole definis
- [ ] Contrastes suffisants

## Format de Sortie

```
## Code Review: [Fichier(s)]

### Resume
[Vue d'ensemble des changements]

### Points Positifs
- Point 1
- Point 2

### Problemes
1. **[Severite: Critique/Majeur/Mineur]** [Description]
   - Fichier: [path]
   - Ligne: [numero]
   - Suggestion: [correction]

### Suggestions d'Amelioration
- Suggestion 1
- Suggestion 2

### Verdict
[ ] Approuve
[ ] Approuve avec modifications mineures
[ ] Changements requis
```
