# Pilotage — Documentation commerciale

> **Le système d'exploitation des laveries automatiques.**
> ERP / SaaS multi-sites et multi-marques pour les réseaux de laveries
> libre-service françaises. Un poste de pilotage unique : supervision temps réel
> des machines, recettes & monétique, énergie & conformité, maintenance, tarifs,
> clients, finances et gestion de réseau — hébergé en France, conçu RGPD.

Ce document présente **les arguments commerciaux du produit** (ce qui est livré et
pourquoi ça se vend) puis une **analyse des manques** face à l'ensemble du marché
des laveries automatiques, pour cadrer la feuille de route commerciale.

- Public : direction, commercial, investisseurs, partenaires réseaux/franchises.
- Sources : `ARCHITECTURE.md` (app + data), `PLAN.md`, `packages/shared`
  (modules, RBAC), `docs/providers/*` (écosystème connecteurs), `docs/COSTS.md`,
  `docs/RGPD.md`.

---

## 1. Résumé exécutif

Pilotage réunit dans **une seule plateforme** ce qu'un exploitant de laveries
gère aujourd'hui avec un patchwork d'outils incompatibles : le portail du
fabricant de machines, le back-office de la centrale de paiement (monétique), un
tableur pour les recettes, un autre pour l'énergie, un cahier de maintenance, et
son expert-comptable pour la TVA et le FEC.

**Proposition de valeur en une phrase :** *voir en temps réel l'état de tout mon
parc, encaisser et réconcilier chaque euro, prouver ma conformité (énergie, TVA,
RGPD) et piloter la rentabilité de plusieurs sites — depuis n'importe quel
téléphone, sans installer de logiciel.*

Trois atouts structurels qui font la différence commerciale :

1. **Multi-sites / multi-marques nativement** — pensé pour les réseaux et les
   franchises, pas pour une laverie isolée. Un tableau de bord consolidé,
   benchmark inter-sites, RBAC par périmètre (réseau / site / machine).
2. **Souveraineté & conformité françaises** — données hébergées à Paris
   (`eu-west-3`), RGPD by design, exports **FEC** et **TVA**, dossier **OPERAT /
   décret tertiaire**, IA **Mistral** (française). Des arguments réglementaires
   qui déclenchent l'achat, pas seulement du confort.
3. **Coût d'exploitation quasi nul à vide** — architecture *serverless*
   (scale-to-zero) : la plateforme coûte ~45–70 $/mois au repos et le coût suit
   l'usage. Marge SaaS élevée et prix d'entrée accessible pour l'indépendant.

---

## 2. Le problème marché

Un exploitant de laveries libre-service vit avec des angles morts coûteux :

| Douleur | Conséquence business |
|---|---|
| Aucune vue temps réel : il faut se déplacer ou appeler pour savoir si une machine tourne, est libre ou en panne | Pannes non détectées = CA perdu + clients mécontents |
| Recettes éclatées entre espèces, sans-contact, appli, carte — et un back-office monétique par fournisseur | Fraude et écarts de caisse invisibles ; réconciliation manuelle |
| Facture d'énergie subie, sans mesure par site ni par machine | Pas de levier sur le premier poste de charge après le loyer |
| Conformité chronophage : TVA, FEC, **décret tertiaire (OPERAT)**, RGPD | Risque fiscal / réglementaire, temps comptable |
| Outils du fabricant enfermés par marque ; parc hétérogène (Electrolux, Girbau, Speed Queen, Miele, Danube…) | Impossible de piloter un réseau multi-marques d'un seul endroit |
| Croissance = démultiplication du chaos (chaque nouveau site rajoute des outils) | Le modèle ne scale pas ; la valeur de revente du réseau est floue |

Le marché est **fragmenté par des fournisseurs propriétaires** (monétique et
fabricants) qui n'ont, pour la plupart, **pas d'API self-service** — l'intégration
passe par une relation commerciale. C'est précisément la barrière que Pilotage
absorbe pour l'exploitant.

---

## 3. La solution — vue d'ensemble

Deux dépôts, une plateforme :

- **`monorepo-app`** — la console opérateur (React/PWA) + l'API métier (NestJS),
  le schéma `core` (multi-tenant), l'authentification, la facturation SaaS, et
  toute l'infrastructure AWS (Terraform). C'est le produit que voit le client.
- **`monorepo-data`** — l'ingestion des données machines/paiement/énergie
  (webhooks, SFTP, polling d'API), le *data lake* S3, et les traitements
  **ML/analytics** nocturnes (KPI, réconciliation, énergie/OPERAT, maintenance
  prédictive, anti-fraude, prévision). C'est le moteur qui alimente les tableaux
  de bord.

Le tout **hébergé en France**, une seule base de données PostgreSQL, isolation
stricte des locataires par **Row-Level Security** au niveau base (garantie
d'étanchéité entre clients — argument clé pour vendre à des réseaux et
franchises).

---

## 4. Les atouts commerciaux, module par module

La plateforme est découpée en 12 modules métier. Maturité actuelle : **MVP** =
livré et vérifié · **partiel** = socle livré, complété par étapes · **stub** =
amorcé, activable par feature-flag.

| Module | Ce que ça fait | Argument de vente | Maturité |
|---|---|---|---|
| **M1 — Machines / supervision** | État live (libre/en cours/terminé/hors-service/hors-ligne), historique, occupation & taux de dispo, flux temps réel (SSE), pilotage à distance | « Je vois tout mon parc en un coup d'œil et je détecte une panne avant mon client » | **MVP** (pilotage distant : *Should*) |
| **M2 — Recettes / monétique** | CA par site/machine/moyen de paiement, réconciliation espèces + sans-contact + appli, collectes, remboursements | « Chaque euro est tracé et rapproché ; la fraude et les écarts deviennent visibles » | **MVP** |
| **M3 — Appli client / fidélité** | Appli client, paiement, fidélité, notifications, **marque blanche** | « Mon enseigne, mon appli, mes clients fidélisés » | Partiel |
| **M4 — Maintenance / GMAO** | Tickets, **auto-ticket depuis les alarmes machine**, registre du parc, plans préventifs, MTBF/MTTR, **maintenance prédictive** | « Moins de pannes, interventions planifiées, durée de vie des machines allongée » | Partiel (prédictif : *Should*) |
| **M5 — Énergie / conformité** | Consommation & anomalies, **trajectoire et dossier OPERAT (décret tertiaire)**, effacement heures pleines/creuses | « Je pilote mon 1er poste de charge variable et je suis en règle avec le décret tertiaire » | **MVP** |
| **M6 — Finances / compta** | Consolidation du CA, **TVA**, **export FEC**, charges/marges, connecteurs comptables | « Ma compta et mon expert-comptable sont servis sans ressaisie » | Partiel |
| **M7 — Tarifs / yield** | Grilles tarifaires, **tarification par créneau**, promotions, push distant des prix | « J'ajuste mes prix par heure/site et je pousse une promo en un clic » | Partiel |
| **M8 — CRM / marketing** | Base clients, segmentation, campagnes, avis Google | « Je transforme mes passages en clients récurrents » | Stub |
| **M9 — Réseau** | Tableau de bord multi-sites, **benchmark inter-sites**, standardisation, rapports planifiés, RBAC par périmètre, royalties | « Je pilote un réseau/une franchise comme une seule entreprise » | **MVP** |
| **M10 — Stocks** | Consommables (lessive, adoucissant…) + réappro | « Je ne tombe jamais en rupture de lessive » | Stub |
| **M11 — RH** | Planning, pointage | « Je gère mes équipes terrain » | Stub |
| **M12 — Admin / sécurité** | Multi-tenant, utilisateurs & rôles (RBAC), sites, registre de connecteurs, audit, RGPD, **facturation SaaS (Stripe)** | « Gouvernance, traçabilité et sécurité de niveau entreprise » | **MVP** |

**Rôles métier prêts à l'emploi** (RBAC personnalisable par le client) :
propriétaire, gérant, comptable, technicien, observateur, administrateur réseau —
chacun avec un jeu de permissions par défaut aligné sur les usages réels.

---

## 5. Différenciateurs clés (pourquoi nous plutôt qu'un autre)

1. **Multi-marques, réellement.** Un réseau typique mélange Electrolux, Girbau,
   Speed Queen/Alliance, Miele, Danube et plusieurs centrales de paiement.
   Pilotage normalise tout dans un modèle canonique unique — là où les portails
   fabricants enferment le client dans une seule marque.

2. **Conformité comme produit, pas comme corvée.** Export **FEC** et **TVA**
   (M6), dossier **OPERAT / décret tertiaire** généré (M5), **RGPD by design**
   (résidence des données à Paris, anonymisation / droit à l'oubli propagé entre
   les deux dépôts, aucune donnée de carte / PAN stockée). En France ces
   obligations *déclenchent* la décision d'achat.

3. **Souveraineté & IA française.** Données en `eu-west-3` (Paris), IA **Mistral**
   pour les synthèses en langage naturel (prompts limités à des KPI agrégés,
   jamais de PII client). Argument fort pour des acheteurs sensibles à la
   souveraineté numérique.

4. **Isolation multi-tenant garantie au niveau base (RLS).** L'étanchéité entre
   clients n'est pas « gérée par le code applicatif » mais imposée par PostgreSQL
   (le rôle applicatif n'est pas `BYPASSRLS`). Différenciateur de confiance pour
   vendre à des réseaux, franchiseurs et gestionnaires multi-clients.

5. **Économie serverless = prix agressif + marge.** ~45–70 $/mois d'infrastructure
   au repos, coût qui suit l'usage. Permet un **prix d'entrée accessible pour
   l'indépendant** tout en gardant une marge SaaS confortable à l'échelle.

6. **Zéro installation, multi-appareils.** Application web **PWA** responsive,
   **français par défaut** (i18n), installable sur mobile, utilisable hors-ligne
   partiellement. Pas de logiciel à déployer sur site.

7. **Marque blanche.** Thématisation par tenant (couleurs, logo) pour l'appli
   client et la console — vendable aux franchiseurs qui veulent leur enseigne.

8. **Ingestion « raw-first » et idempotente.** Chaque flux fournisseur est
   horodaté, signé (HMAC) et archivé avant traitement : rejouable, auditable,
   robuste face aux fournisseurs à faible rétention. Fiabilité = argument SLA.

---

## 6. Écosystème de connecteurs

Le principal fossé concurrentiel est l'**intégration des fournisseurs** français
(monétique et fabricants), rarement dotés d'API publiques. Pilotage industrialise
ces intégrations (webhook signé / SFTP / polling d'API) derrière un modèle de
données unique.

| Catégorie | Fournisseurs | État |
|---|---|---|
| Centrales de paiement (monétique) | **EAS** (webhook HMAC) ✅ · LM Control · Myosis · M-INNOV · Comestero | 1 livré, 4 amorcés |
| Terminaux bancaires | Nayax · Ingenico | amorcé / planifié |
| Fabricants de machines | **Electrolux Professional** (SFTP) ✅ · **Girbau / Sapphire** (API) ✅ · Speed Queen / Alliance · Miele Professional · Danube · *(Schulthess, Domus planifiés)* | 2 livrés, reste amorcé |
| Énergie | **Enedis Data Connect** (OAuth) ✅ · compteur générique (MQTT/Modbus) | 1 livré (bac à sable) |
| Comptabilité | Sage · Cegid · Pennylane · QuickBooks | planifiés |
| IA / NLP | **Mistral AI** ✅ (mode stub) | livré |
| Notifications & marketing | Brevo (e-mail/SMS) · Web Push · Google Business Profile | documentés |
| Facturation SaaS | **Stripe** | intégré |

> Chaque fournisseur dispose d'un **tutoriel d'intégration** (qui contacter, délai,
> format, secret) dans `docs/providers/*`. Le connecteur EAS (paiement),
> Electrolux et Girbau (machines) et Enedis (énergie) sont exercés par des tests
> end-to-end.

**Message commercial :** l'exploitant n'a pas à négocier lui-même chaque API —
Pilotage capitalise et mutualise ces intégrations pour tout le réseau.

---

## 7. Cibles clients & argumentaire

| Segment | Douleur principale | Accroche |
|---|---|---|
| **Indépendant 1–3 sites** | Manque de visibilité, temps perdu, énergie subie | « Reprenez le contrôle sans embaucher : votre laverie dans votre poche. » |
| **Multi-sites 4–20** | Impossible de comparer/standardiser ses sites | « Benchmark inter-sites et standardisation : arrêtez de piloter à l'aveugle. » |
| **Réseaux & franchiseurs** | Gouvernance, marque, royalties, revente | « Un OS de réseau en marque blanche, avec RBAC par périmètre et rapports consolidés. » |
| **Gestionnaires / investisseurs** | Preuve de performance & conformité pour valoriser un parc | « Des KPI et une conformité auditables qui rassurent à la revente. » |

Arguments **ROI** transversaux : temps administratif réduit (réconciliation,
compta, conformité automatisées), CA protégé (pannes détectées plus tôt, fraude
visible), facture énergétique optimisée, valeur de réseau rendue lisible.

---

## 8. Sécurité, architecture & exploitation (arguments « entreprise »)

- **Multi-tenant à isolation base (RLS)** ; le rôle applicatif n'a pas le droit de
  contourner l'isolation. Contexte par requête (`tenant`, `user`, `scope`).
- **Journal d'audit** sur chaque mutation ; **RBAC** granulaire par module et par
  périmètre (réseau/site/machine).
- **Secrets en AWS Secrets Manager** (`pilotage/<env>/<provider>`), jamais dans le
  code ; chiffrement KMS ; WAF ; alarmes budget & anomalie de coûts.
- **Résidence des données `eu-west-3` (Paris)** ; aucune réplication hors région
  des données personnelles sans décision documentée.
- **Reprise / rétention** : sauvegardes RDS (7–35 j paramétrable), rétention des
  logs 14–30 j, cycle de vie S3 vers stockage froid.
- **CI/CD** automatisé (lint/typecheck/tests/build + Terraform plan/apply gated,
  OIDC vers AWS) — gage de sérieux et de maintenabilité.
- **Découplage app / matériel** : l'app ne parle jamais directement aux API
  fabricants/monétique ; elle passe par une file de commandes que le dépôt data
  exécute. Sécurité et responsabilité claires.

---

## 9. Modèle économique

- **SaaS par abonnement** via **Stripe** (module M12), naturellement par tenant
  et extensible par site / par module (feature-flags activables à la carte).
- **Coût marginal faible** : l'essentiel du coût est la base RDS mutualisée ;
  l'ajout d'un site/tenant est quasi gratuit jusqu'à un fort volume.
- **Montée en gamme par modules** : démarrer sur le MVP (M1/M2/M5/M9/M12) puis
  vendre l'activation des modules *Should/Could* (fidélité, CRM, stocks, RH,
  prédictif) sans redéploiement — chaque flag est une ligne de revenu.

---

# 10. Analyse des manques — couvrir tout le marché des laveries

Pour être « complet » face à **l'ensemble du marché des laveries automatiques**,
voici les manques classés par priorité commerciale. Certains sont déjà amorcés
(*Should/Could/stub*) ; d'autres ne sont pas encore couverts.

### 10.1 Priorité haute — attendus quasi systématiques du marché

1. **Paiement client de bout en bout.** Seule **EAS** est livrée ; LM Control,
   Myosis, M-INNOV, Comestero, Nayax, Ingenico restent à finaliser. Manquent
   aussi : **Apple Pay / Google Pay**, **démarrage machine par QR code / NFC**,
   **reçus / factures client**, gestion des **jetons / cartes prépayées**.
   *Sans une couverture monétique large, l'adoption reste limitée à quelques
   parcs.*

2. **Application client mobile native + fidélité (M3).** Aujourd'hui *partiel*.
   Le marché attend : appli **iOS/Android native**, **wallet & recharge**,
   **fidélité / points / cartes cadeaux**, **parrainage**, notifications push
   transactionnelles (« votre machine est terminée »), **réservation** de machine.
   Fort levier de rétention et de panier moyen.

3. **Lavage au kilo / pressing / « wash-and-fold » & conciergerie.** Segment en
   forte croissance (services à la personne, hôtellerie, résidences). Manquent la
   **prise de commande de service**, le suivi d'ordre, la **facturation B2B**
   (hôtels, campings, résidences, Airbnb, EHPAD) et les **casiers de retrait /
   consignes connectées**.

4. **Contrôle d'accès & sécurité physique.** **Ouverture/fermeture de porte**,
   **horaires automatiques**, **accès nocturne sécurisé**, **télésurveillance
   vidéo** et **détection d'intrusion/incident**. Attente quasi universelle des
   laveries 24/7 en libre-service, aujourd'hui non couverte.

5. **Finaliser la conformité & la compta.** Connecteurs comptables **Sage /
   Cegid / Pennylane / QuickBooks** encore *planifiés* ; consolider TVA, FEC,
   charges/marges pour en faire un argument « clé en main » avec l'expert-comptable.

### 10.2 Priorité moyenne — différenciation & montée en gamme

6. **Tarification dynamique / yield (M7) complète** : élasticité, promotions
   automatiques par affluence, happy hours, packs — au-delà du créneau simple.

7. **CRM / marketing local (M8, actuellement stub)** : campagnes e-mail/SMS
   (Brevo), **Google Business Profile & avis**, SEO local, segmentation, offres
   d'anniversaire/réactivation.

8. **Stocks & consommables (M10)** et **RH / planning (M11)** — encore *stub* :
   réappro lessive/adoucissant, distributeurs/vending, planning et pointage des
   équipes terrain (importants pour les enseignes avec personnel).

9. **Maintenance prédictive & pilotage distant généralisés (M4/M1, Should)** :
   scoring de risque de panne déjà amorcé côté data ; à connecter à
   l'auto-ouverture de tickets et au **redémarrage / dépannage à distance** des
   machines (file `device_command`).

10. **Écrans en laverie / bornes / affichage** : borne d'accueil, écran d'état des
    machines, borne de paiement/rechargement, signalétique dynamique. Présence
    physique attendue en boutique, non couverte par une app web seule.

### 10.3 Priorité selon ambition — expansion & réseau

11. **Internationalisation** : l'i18n **EN est amorcé mais non finalisé**, et il
    manque le **multi-devise** et le **multi-langue client** (touristes, marchés
    hors France). Prérequis à toute expansion hors de France.

12. **Outillage franchise / réseau avancé** : **moteur de royalties**
    (*Could*), standardisation poussée, **espace franchisé**, **data room /
    reporting investisseurs** pour valoriser un parc à la revente.

13. **Support client & SAV** : centre d'assistance in-app, **chatbot** (Mistral),
    tickets clients, remboursements en self-service, borne d'appel.

14. **Métrologie eau / gaz** (au-delà de l'électricité Enedis) et
    **empreinte CO₂ / reporting ESG** (*Could* du module énergie) — attendu par
    les réseaux soumis à reporting extra-financier.

15. **Distribution & vending** : vente de lessive/dosettes, distributeurs
    automatiques, séchage à la carte, upsell en boutique.

16. **Assurance & gestion des sinistres** (dégât des eaux, vol, panne machine) —
    workflow de déclaration et suivi.

### 10.4 Dépendances structurelles à surveiller

- **Dépendance aux API fournisseurs** (monétique & fabricants), souvent gated par
  une relation commerciale et sans self-service. Piste de complétude : une
  **passerelle IoT / gateway matérielle** propriétaire pour capter la donnée
  machine indépendamment du fabricant (réduit la dépendance et ouvre le parc
  ancien non connecté).
- **App opérateur native** : la PWA couvre l'essentiel, mais une app mobile
  native (notifications système fiables, widgets, biométrie) peut être attendue.
- **Playwright e2e complet** et durcissement des tests navigateur (déjà noté comme
  *nice-to-have*) pour un argument qualité/SLA sans faille.

---

## 11. Synthèse — matrice de complétude marché

| Domaine | État Pilotage | Manque pour « couvrir le marché » |
|---|---|---|
| Supervision machines | ✅ MVP | Bornes/écrans en boutique ; parc non connecté (gateway) |
| Recettes & monétique | ✅ MVP (1 connecteur) | Élargir les connecteurs, Apple/Google Pay, QR/NFC, reçus |
| Appli client & fidélité | 🟨 Partiel | App native, wallet, parrainage, réservation, cartes cadeaux |
| Maintenance / GMAO | 🟨 Partiel | Prédictif connecté + dépannage à distance généralisés |
| Énergie & conformité | ✅ MVP | Eau/gaz, ESG/CO₂ |
| Finances / compta | 🟨 Partiel | Connecteurs Sage/Cegid/Pennylane/QuickBooks |
| Tarifs / yield | 🟨 Partiel | Tarification dynamique avancée |
| CRM / marketing | 🟥 Stub | Campagnes, avis GBP, SEO local |
| Réseau / franchise | ✅ MVP | Royalties, espace franchisé, data room |
| Stocks | 🟥 Stub | Réappro, vending |
| RH | 🟥 Stub | Planning, pointage |
| Admin / sécurité / SaaS | ✅ MVP | — (socle solide) |
| Services (au kilo / pressing / B2B) | ⬜ Non couvert | Prise de commande, casiers, facturation B2B |
| Accès & sécurité physique | ⬜ Non couvert | Porte, vidéo, intrusion, 24/7 |
| International | ⬜ Amorcé | EN, multi-devise, multi-langue client |

**Conclusion.** Le socle *pilotage d'exploitation* (supervision, recettes,
énergie/conformité, réseau, admin/SaaS) est **livré et différenciant**, avec des
atouts réglementaires et de souveraineté rares sur ce marché. Pour couvrir
**l'intégralité du marché** des laveries automatiques, les priorités commerciales
sont, dans l'ordre : (1) **élargir la monétique et le paiement client**, (2)
**app client native + fidélité**, (3) **services au kilo / pressing / B2B**, (4)
**contrôle d'accès & sécurité physique**, puis la finalisation des modules
CRM/stocks/RH et de l'international.
