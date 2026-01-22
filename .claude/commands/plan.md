# Plan Command

Cree un plan d'implementation detaille pour la feature ou tache demandee.

## Instructions

1. Analyse la demande de l'utilisateur: $ARGUMENTS
2. Decompose en taches atomiques
3. Identifie les fichiers a modifier/creer
4. Estime la complexite de chaque tache
5. Propose un ordre d'implementation optimal
6. Identifie les risques potentiels

## Format de Sortie

```
## Plan: [Nom de la Feature]

### Analyse
[Resume de la demande et du contexte]

### Taches
1. [ ] Tache 1 - [Fichier(s)] - Complexite: Faible/Moyenne/Haute
2. [ ] Tache 2 - [Fichier(s)] - Complexite: Faible/Moyenne/Haute
...

### Dependances
- Tache X depend de Tache Y

### Risques
- Risque 1: [Description] - Mitigation: [Solution]

### Expert(s) Recommande(s)
- [ios-senior/ui-ux-designer/backend-expert/audio-dj-expert]
```

## Regles
- Toujours verifier l'existant avant de proposer de nouveaux fichiers
- Privilegier la modification de fichiers existants
- Garder les taches petites et testables
- Considerer les impacts sur les autres parties du code
