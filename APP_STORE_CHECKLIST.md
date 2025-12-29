# 🍎 AUDIT APP STORE - SPYNNERS Live

## ✅ ÉLÉMENTS CONFORMES

### Configuration app.json
- [x] Bundle ID configuré: `com.spynners.live`
- [x] Version: `1.0.0`
- [x] Build Number: `1`
- [x] Orientation: Portrait
- [x] Dark mode supporté
- [x] Icône configurée
- [x] Splash screen configuré

### Permissions iOS (Info.plist)
- [x] NSMicrophoneUsageDescription - Description claire pour SPYN/ACRCloud
- [x] NSCameraUsageDescription - Pour photos événements
- [x] NSPhotoLibraryUsageDescription - Pour sélection images
- [x] NSPhotoLibraryAddUsageDescription - Pour sauvegarder DJ sets
- [x] NSLocationWhenInUseUsageDescription - Pour clubs à proximité
- [x] ITSAppUsesNonExemptEncryption: false - Pas de crypto personnalisée
- [x] UIBackgroundModes: audio - Pour enregistrement DJ sets

### Légal
- [x] Conditions d'utilisation (Terms) - Page complète FR/EN
- [x] Politique de confidentialité - Incluse dans Terms
- [x] RGPD mentionné

### Fonctionnalités
- [x] Authentification fonctionnelle
- [x] Reconnaissance audio ACRCloud configurée
- [x] Google Places API configurée
- [x] Chat fonctionnel
- [x] Upload de tracks fonctionnel

---

## ⚠️ ACTIONS REQUISES AVANT SOUMISSION

### 1. 🔴 COMPTE DE TEST POUR APPLE REVIEW (OBLIGATOIRE)
Apple exige un compte de test pour reviewer l'app.

**Action:** Créez un compte test avec ces identifiants:
- Email: `review@spynners.com`
- Password: `SpynnersReview2024!`

Puis entrez ces identifiants dans App Store Connect lors de la soumission.

### 2. 🔴 POLITIQUE DE CONFIDENTIALITÉ URL (OBLIGATOIRE)
Apple exige une URL publique vers votre politique de confidentialité.

**Options:**
- a) Hébergez sur votre site: `https://spynners.com/privacy`
- b) Utilisez une page GitHub
- c) Utilisez un service gratuit comme Termly

### 3. 🔴 SCREENSHOTS APP STORE (OBLIGATOIRE)
Vous devez fournir des captures d'écran pour:
- iPhone 6.7" (iPhone 14 Pro Max) - 1290 x 2796px
- iPhone 6.5" (iPhone 11 Pro Max) - 1242 x 2688px
- iPhone 5.5" (iPhone 8 Plus) - 1242 x 2208px
- iPad Pro 12.9" (si supporté) - 2048 x 2732px

**Recommandation:** 5-10 screenshots montrant:
1. Écran de connexion avec logo SPYNNERS
2. Page Home avec tracks
3. Écran SPYN (reconnaissance audio)
4. Enregistrement DJ Set
5. Chat entre membres
6. Profil utilisateur
7. Upload de track

### 4. 🟡 SIGN IN WITH APPLE (RECOMMANDÉ)
Depuis iOS 13, si votre app propose une connexion sociale (Google), 
vous DEVEZ aussi proposer "Sign in with Apple".

**Note:** Votre app utilise Base44 pour l'auth. Vérifiez si Base44 
supporte "Sign in with Apple" ou ajoutez-le manuellement.

### 5. 🟡 DESCRIPTION APP STORE
Préparez une description attrayante (max 4000 caractères):

```
🎵 SPYNNERS Live - La communauté des DJs House

Rejoignez la plus grande communauté de DJs et producteurs House Music !

FONCTIONNALITÉS:

🎧 SPYN - Identification de tracks
Comme Shazam, mais pour la House Music ! Identifiez instantanément 
n'importe quelle track jouée en club grâce à ACRCloud.

📀 Enregistrement DJ Set
Enregistrez vos sets avec identification automatique des tracks. 
Connectez votre table de mixage pour une qualité optimale.

💬 Chat Communautaire
Échangez avec plus de 1000 DJs du monde entier.

📤 Upload de Musique
Partagez vos productions avec la communauté SPYNNERS.

🎶 Promo Pool Gratuit
Accédez à des milliers de tracks House, Tech House, Afro House...

Téléchargez SPYNNERS et rejoignez la famille !

www.spynners.com
```

### 6. 🟡 MOTS-CLÉS APP STORE
```
dj, house music, shazam, music recognition, dj set, tracklist, 
afro house, tech house, music promo, dj community, mixer
```

### 7. 🟡 CATÉGORIE
- Catégorie principale: **Music**
- Catégorie secondaire: **Social Networking**

### 8. 🟡 CLASSIFICATION D'ÂGE
- Rating suggéré: **4+** (pas de contenu adulte)
- Pas de violence, pas d'alcool explicite, pas de contenu sexuel

### 9. 🟡 SUPPORT URL
Configurez une URL de support: `https://spynners.com/support` ou email

---

## 🛠️ COMMANDES EAS BUILD

### Pour créer le build iOS:
```bash
cd /app/frontend
npx eas build --platform ios --profile production
```

### Pour soumettre à l'App Store:
```bash
npx eas submit --platform ios
```

### Configuration eas.json actuelle:
```json
{
  "build": {
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "VOTRE_APPLE_ID",
        "ascAppId": "VOTRE_APP_ID_CONNECT",
        "appleTeamId": "6Z6XU3523U"
      }
    }
  }
}
```

---

## 📋 CHECKLIST FINALE

### Avant le build:
- [ ] Compte de test créé (review@spynners.com)
- [ ] URL politique de confidentialité prête
- [ ] Screenshots préparées
- [ ] Description App Store rédigée
- [ ] Mots-clés choisis

### Dans App Store Connect:
- [ ] App créée avec Bundle ID `com.spynners.live`
- [ ] Informations de l'app remplies
- [ ] Screenshots uploadées
- [ ] Compte de test renseigné
- [ ] URL de confidentialité renseignée
- [ ] Catégorie et rating configurés

### Post-soumission:
- [ ] Surveiller le statut dans App Store Connect
- [ ] Répondre rapidement aux questions d'Apple
- [ ] Préparer les mises à jour si rejet

---

## ❓ RAISONS DE REJET COURANTES À ÉVITER

1. **Guideline 2.1 - App Completeness**
   - L'app doit être complète et fonctionnelle
   - ✅ Votre app est fonctionnelle

2. **Guideline 4.2 - Minimum Functionality**
   - L'app doit offrir une valeur réelle
   - ✅ SPYNNERS offre reconnaissance audio, chat, upload

3. **Guideline 5.1.1 - Data Collection**
   - Expliquer clairement l'utilisation des données
   - ✅ Politique de confidentialité incluse

4. **Guideline 4.0 - Design**
   - Interface native et bien conçue
   - ✅ Design professionnel dark mode

5. **Guideline 2.5.4 - Background Modes**
   - Justifier l'utilisation audio en background
   - ✅ Nécessaire pour enregistrement DJ sets

---

## 📞 CONTACT SUPPORT APPLE

Si problème de rejet:
- App Store Connect > Contact Us
- Apple Developer Forums
- https://developer.apple.com/contact/

Bonne chance pour la soumission ! 🚀
