# Test Command

Execute les tests et analyse les resultats.

## Instructions

1. Identifie le scope des tests: $ARGUMENTS
2. Execute les tests appropries
3. Analyse les resultats
4. Propose des corrections si necessaire

## Commandes de Test

```bash
# Tous les tests
npm test

# Tests specifiques
npm test -- --testPathPattern="$ARGUMENTS"

# Tests avec coverage
npm test -- --coverage

# Tests en mode watch
npm test -- --watch
```

## Analyse des Echecs

Pour chaque test echoue:
1. Identifie la cause root
2. Localise le code problematique
3. Propose une correction
4. Verifie les regressions potentielles

## Format de Sortie

```
## Resultats des Tests

### Statistiques
- Total: X tests
- Passes: X
- Echoues: X
- Coverage: X%

### Tests Echoues
1. **[Nom du test]**
   - Fichier: [path]
   - Erreur: [message]
   - Cause probable: [analyse]
   - Correction suggeree: [code]

### Recommandations
- [Recommandations pour ameliorer la couverture]
```
