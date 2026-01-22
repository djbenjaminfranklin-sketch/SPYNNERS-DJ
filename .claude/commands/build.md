# Build Command

Execute un build et analyse les erreurs.

## Instructions

1. Determine le type de build: $ARGUMENTS (ios/android/all)
2. Execute le build
3. Analyse les erreurs si presentes
4. Propose des corrections

## Commandes de Build

```bash
# Type check TypeScript
npx tsc --noEmit

# Build Expo
npx expo export

# Build EAS iOS
eas build --platform ios --profile $1

# Build EAS Android
eas build --platform android --profile $1

# Build local
npx expo run:ios
npx expo run:android
```

## Analyse des Erreurs

### Erreurs TypeScript
- Identifier le type d'erreur
- Localiser le fichier et la ligne
- Proposer la correction de typage

### Erreurs de Build Native
- Verifier les dependances natives
- Verifier les pods/gradle
- Proposer les commandes de fix

## Format de Sortie

```
## Build Report

### Configuration
- Platform: [ios/android]
- Profile: [development/preview/production]

### Resultat
[ ] Succes
[ ] Echec

### Erreurs (si echec)
1. **[Type d'erreur]**
   - Fichier: [path]
   - Message: [erreur]
   - Correction: [solution]

### Actions Recommandees
1. [Action 1]
2. [Action 2]
```
