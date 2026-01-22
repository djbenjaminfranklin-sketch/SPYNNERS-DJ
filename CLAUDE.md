# SPYNNERS Live - Guide Claude Code

## Vue d'Ensemble du Projet

**SPYNNERS Live** est une application mobile cross-platform (iOS/Android) pour la communaute DJ. Elle permet de decouvrir, partager et analyser la musique en temps reel.

### Stack Technique
- **React Native** 0.81.5 + **Expo** 54.0.31
- **TypeScript** 5.9.2
- **React** 19.1.0
- **Expo Router** 6.0.21 (file-based routing)
- **Backend**: Base44 API

### Build Info
- iOS Bundle ID: `com.spynners.live`
- Build Number: 60
- Theme: Dark mode uniquement

---

## Structure du Projet

```
frontend/
├── app/                          # Ecrans Expo Router
│   ├── (auth)/                   # Login, Register
│   ├── (tabs)/                   # Home, Library, Chat, Profile
│   │   ├── home.tsx              # Decouverte musique
│   │   ├── library.tsx           # Mes uploads
│   │   ├── chat.tsx              # Messagerie
│   │   ├── profile.tsx           # Profil utilisateur
│   │   ├── spyn-record.tsx       # Enregistrement DJ
│   │   └── received.tsx          # Pistes recues
│   └── profile/                  # Ecrans profil (admin, analytics, etc.)
├── src/
│   ├── contexts/                 # State global
│   │   ├── AuthContext.tsx       # Authentification
│   │   ├── PlayerContext.tsx     # Lecteur audio
│   │   └── LanguageContext.tsx   # I18n (6 langues)
│   ├── services/                 # API
│   │   └── base44Api.ts          # 16 services Base44
│   ├── components/               # Composants reutilisables
│   │   └── audio/                # Waveform, VUMeter
│   ├── hooks/                    # Hooks personnalises
│   └── theme/                    # Design tokens
```

---

## Commandes de Developpement

```bash
# Installation
npm install

# Developpement
npx expo start           # Serveur de dev
npx expo start --ios     # iOS specifique
npx expo start --clear   # Nettoyer cache

# Build
eas build --platform ios --profile development
eas build --platform ios --profile production

# Native
npx expo prebuild --clean
npx expo run:ios

# Type check
npx tsc --noEmit
```

---

## Conventions de Code

### TypeScript
- **Typage strict**: Pas de `any`, interfaces explicites
- **Nommage**: PascalCase composants, camelCase fonctions/variables
- **Exports**: Named exports preferes

### React Native
- **Composants fonctionnels** avec hooks
- **memo()** pour composants purs avec props complexes
- **useCallback/useMemo** pour optimisation
- **StyleSheet.create()** obligatoire (pas de styles inline)

### Fichiers
- Un composant majeur par fichier
- Noms en PascalCase pour composants: `TrackCard.tsx`
- Noms en camelCase pour utilitaires: `formatDuration.ts`

---

## Design System

### Couleurs
```typescript
primary: '#5CB3CC'        // Cyan accent
background: '#0a0a0a'     // Fond principal
backgroundCard: '#1a1a1a' // Cartes
text: '#FFFFFF'           // Texte principal
textSecondary: '#999999'  // Texte secondaire
success: '#4CAF50'
error: '#F44336'
gold: '#FFD700'           // Black Diamonds
```

### Espacements
```typescript
xs: 4, sm: 8, md: 16, lg: 24, xl: 32
```

### Bordures
```typescript
sm: 4, md: 8, lg: 12, xl: 16, full: 9999
```

---

## API Base44

### Endpoint Principal
`https://spynners.base44.app/api/apps/`

### Services Disponibles
1. `base44Auth` - Login, signup, token management
2. `base44Tracks` - CRUD pistes, recherche, filtres
3. `base44Users` - Gestion utilisateurs
4. `base44Playlists` - Playlists
5. `base44Messages` - Messagerie
6. `base44Spyn` - Sessions SPYN Record
7. `base44VIP` - Pistes VIP

### Pattern de Cache
```typescript
CACHE_DURATIONS = {
  tracks: 5 * 60 * 1000,     // 5 min
  users: 10 * 60 * 1000,     // 10 min
  userProfile: 15 * 60 * 1000 // 15 min
}
```

---

## Experts Disponibles

### Utilisation
Deleguer aux experts specialises avec le Task tool:
```
"Lance l'expert ios-senior pour implementer ce composant"
```

### Liste des Experts

| Expert | Specialite | Quand l'utiliser |
|--------|-----------|------------------|
| `orchestrator` | Coordination, planification | Features complexes, decisions archi |
| `ios-senior` | React Native, Expo, iOS | Code mobile, navigation, performance |
| `ui-ux-designer` | Interface, design system | Nouveaux ecrans, animations, accessibilite |
| `backend-expert` | API, Base44, cache | Services, auth, mode offline |
| `audio-dj-expert` | Lecteur, SPYN Record | Audio, enregistrement, ACRCloud |

---

## Commandes Slash Disponibles

- `/plan [feature]` - Planifier une implementation
- `/review [fichiers]` - Revue de code
- `/test [scope]` - Executer et analyser tests
- `/build [platform]` - Build et analyse erreurs

---

## Regles Importantes

### A FAIRE
- Verifier les types avant chaque commit
- Tester sur iOS ET Android
- Utiliser les composants existants avant d'en creer
- Documenter les fonctions complexes
- Gerer les erreurs gracieusement

### A NE PAS FAIRE
- ❌ Utiliser `any` en TypeScript
- ❌ Styles inline dans le render
- ❌ console.log en production
- ❌ Secrets en dur dans le code
- ❌ Ignorer les warnings TypeScript
- ❌ Creer des fichiers sans les integrer

---

## Fichiers Critiques

Ne pas modifier sans review approfondie:
- `app.json` - Config Expo
- `eas.json` - Config EAS Build
- `tsconfig.json` - Config TypeScript
- `src/contexts/AuthContext.tsx` - Auth
- `src/contexts/PlayerContext.tsx` - Lecteur audio
- `src/services/base44Api.ts` - Services API

---

## Workflow Recommande

1. **Comprendre** - Lire le code existant avant de modifier
2. **Planifier** - Utiliser `/plan` pour features complexes
3. **Implementer** - Petits commits, code type
4. **Tester** - Verifier sur device reel
5. **Review** - Utiliser `/review` avant merge

---

## Liens Utiles

- [Expo Documentation](https://docs.expo.dev)
- [React Native](https://reactnative.dev)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Track Player](https://react-native-track-player.js.org/)
