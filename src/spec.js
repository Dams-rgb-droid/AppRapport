// Description du rapport : listes, champs, éléments à vérifier (port de spec.py).
export const A_RENSEIGNER = "à renseigner";

export const LISTES_DEFAUT = {
  technicien: [A_RENSEIGNER,"Technicien 1", "Technicien 2", "Technicien 3", "technicien 4", "Technicien 5", "Technicien 6", "Technicien 7", "Technicien 8"],
  verification: [A_RENSEIGNER, "Oui", "Non", "En défaut", "Impossible", "Test"],
  type_agence: [A_RENSEIGNER, "Type 1", "Type 2", "Type 3", "Type 4", "Type 5", "Type 6", "Type 7", "Type 8"],
  modele_centrale: [A_RENSEIGNER, "Modele 1", "Modele 2", "Modele 3", "Modele 4", "Modele 5", "Modele 6", "Modele 7", "Modele 8"],
  ligne_pau: [A_RENSEIGNER, "Ligne RTC", "Boitier ATA"],
  emplacement_centrale: [A_RENSEIGNER, "Emplacement 1", "Emplacement 2"],
  taille_disque: ["500Mo", "1To", "2To", "4To"],
  emplacement_video: [A_RENSEIGNER, "Emplacement 1", "Emplacement 2", "Emplacement 3", "Emplacement 4"],
  blocage_lsb: [A_RENSEIGNER, "Aucun", "Par Clavier", "Par Bouton"],
  retardateur: [A_RENSEIGNER, "retardateur 1", "Retardateur 2", "Retardateur 3"],
  porte_ets: [A_RENSEIGNER, "Modele 1", "Modele 2", "Modele 3"],
  secours_sas: [A_RENSEIGNER, "BBG Vert", "Mécanique", "Boitier Clé Rouge"],
  disjoncteur: [A_RENSEIGNER, "Nom 1", "Nom 2", "Nom 3"],
  oui_non: [A_RENSEIGNER, "Oui", "Non"],
  ecran_emplacement: [A_RENSEIGNER, "Emplacement 1", "Emplacement 2", "Emplacement 3", "Emplacement 4"],
  ecran_detail: [A_RENSEIGNER, "Modele 1", "Modele 2", "Modele 3", "Modele 4"],
};

export const NOMS_LISTES = {
  technicien: "Techniciens", verification: "Résultat de vérification", type_agence: "Type d'agence",
  modele_centrale: "Modèle de centrale", ligne_pau: "Ligne PAU", emplacement_centrale: "Emplacement centrale",
  taille_disque: "Taille du disque", emplacement_video: "Emplacement vidéo", blocage_lsb: "Blocage porte LSB",
  retardateur: "Retardateur coffres", porte_ets: "Porte ETS / SAS ETS", secours_sas: "Secours portes SAS ETS",
  disjoncteur: "Disjoncteur", oui_non: "Oui / Non (onduleur, switch PoE)",
  ecran_emplacement: "Écrans — emplacement", ecran_detail: "Écrans — détail",
};

export const IP_CENTRE_DEFAUT = { SYNCHRONIC: "10.10.10.1", FOXNET: "10.10.10.2" };
export const PARAMS_DEFAUT = {
  masque: "255.255.255.240", ip_serveur_siege: "10.10.10.3", decalage_passerelle: "12",
  email_destinataire: "", technicien_courant: "", societe: "",
};

// --- fiche « site »
export const CHAMPS_SITE = [
  ["prom", "N° raccordement (Prom)"], ["nom", "Nom agence"], ["adresse", "Adresse"], ["code_postal", "Code postal"],
  ["ville", "Ville"], ["centrale", "Centrale"], ["tel_secours", "Téléphone transmetteur secours"],
  ["type_reseau", "Type réseau"], ["ip_centrale", "Adresse IP centrale"], ["port_centrale", "Port réseau centrale"],
  ["enreg_video", "Transmetteur / enregistreur vidéo"], ["ip_video", "Adresse IP vidéo"],
  ["port_video", "Port réseau vidéo"], ["tel_pau", "N° téléphone PAU"], ["version_centrale", "Version centrale"],
  ["version_noyau", "Version noyau centrale"], ["mac_centrale", "Adresse MAC centrale"],
  ["serie_video", "N° de série vidéo"], ["modele_video", "Modèle vidéo"], ["version_video", "Version vidéo"],
  ["stockage_video", "Stockage vidéo"],
];
export const CLES_SITE = CHAMPS_SITE.map(([k]) => k);
export const LIBELLES_SITE = Object.fromEntries(CHAMPS_SITE);

// --- champs du rapport : [clé, libellé, type, liste, champ de la fiche site]
export const CHAMPS_ENTETE = [
  ["adresse", "Adresse", "text", null, "adresse"],
  ["code_postal", "Code postal", "text", null, "code_postal"],
  ["ville", "Ville", "text", null, "ville"],
];
export const CHAMPS_ALARME = [
  ["centrale", "Type de centrale", "text", null, "centrale"],
  ["modele_centrale", "Modèle de centrale", "combo", "modele_centrale", null],
  ["num_dossier", "Numéro de dossier", "text", null, null],
  ["version_centrale", "Version", "text", null, "version_centrale"],
  ["version_noyau", "Version noyau", "text", null, "version_noyau"],
  ["n_raccordement", "N° raccordement", "text", null, "prom"],
  ["n_ligne", "N° de ligne (secours)", "text", null, "tel_secours"],
  ["tel_pau", "N° téléphone PAU", "text", null, "tel_pau"],
  ["ligne_pau", "Ligne PAU", "combo", "ligne_pau", null],
  ["mac_centrale", "Adresse MAC", "text", null, "mac_centrale"],
  ["ip_centrale", "Adresse IP", "text", null, "ip_centrale"],
  ["masque_centrale", "Masque sous-réseau", "text", null, null],
  ["passerelle_centrale", "Passerelle", "text", null, null],
  ["ip_centre", "Adresse IP centre", "text", null, null],
  ["ip_serveur", "Adresse IP serveur siège", "text", null, null],
  ["emplacement_centrale", "Emplacement", "combo", "emplacement_centrale", null],
  ["disjoncteur_alarme", "Disjoncteur", "combo", "disjoncteur", null],
  ["agence_externalisee", "Agence externalisée", "check", null, null],
];
export const CHAMPS_VIDEO = [
  ["modele_video", "Type d'enregistreur", "text", null, "modele_video"],
  ["version_video", "Version", "text", null, "version_video"],
  ["serie_video", "Numéro de série", "text", null, "serie_video"],
  ["num_machine", "Numéro de machine", "text", null, null],
  ["ip_video", "Adresse IP", "text", null, "ip_video"],
  ["masque_video", "Masque sous-réseau", "text", null, null],
  ["passerelle_video", "Passerelle", "text", null, null],
  ["stockage_video", "Taille du disque dur", "text", null, "stockage_video"],
  ["ntp", "Synchronisé par NTP", "check", null, null],
  ["emplacement_video", "Emplacement", "combo", "emplacement_video", null],
  ["transmetteur_video", "Transmetteur vidéo", "text", null, "enreg_video"],
  ["nb_ecrans", "Nombre d'écrans", "spin", null, null],
  ["ecran_incivilites", "Écran anti-incivilités", "check", null, null],
  ["admin_id", "Identifiant admin", "text", null, null],
  ["admin_pwd", "Mot de passe admin", "text", null, null],
  ["auto_id", "Identifiant auto-login", "text", null, null],
  ["auto_pwd", "Mot de passe auto-login", "text", null, null],
  ["disjoncteur_video", "Disjoncteur", "combo", "disjoncteur", null],
  ["onduleur", "Onduleur", "combo", "oui_non", null],
  ["switch_poe", "Switch PoE", "combo", "oui_non", null],
];

// éléments à vérifier : [clé, libellé, mode, liste]
export const VERIF_ALARME = [
  ["coffrets_energie", "Coffrets d'énergie", "qty", null],
  ["ecoute", "Écoute", "qty", null],
  ["detecteurs_intrusion", "Détecteurs Intrusion", "qty", null],
  ["detecteurs_incendie", "Détecteurs Incendie", "qty", null],
  ["detecteurs_inondation", "Détecteurs Inondation", "qty", null],
  ["voyant_alarme", "Voyant d'alarme PTI/HM", "qty", null],
  ["buzzer_alarme", "Buzzer d'alarme PTI/HM", "qty", null],
  ["bhu_collab", "BHU Espace Collaboratif", "qty", null],
  ["bhu_accueil", "BHU accueil", "qty", null],
  ["bhu_directeur", "BHU Directeur", "qty", null],
  ["bp_incivilite", "BP incivilité", "qty", null],
  ["pti_hm", "PTI et/ou homme mort", "qty", null],
  ["lecteur_cb", "Lecteur de CB", "qty", null],
  ["blocage_lsb", "Blocage porte LSB", "choice", "blocage_lsb"],
  ["pau_lsb", "PAU LSB", "qty", null],
  ["sirene", "Sirène", "qty", null],
  ["lecteurs_clavier", "Lecteurs / Clavier d'accès", "qty", null],
  ["retardateur", "Retardateur coffres", "choice", "retardateur"],
  ["porte_sas_ets", "Porte SAS ETS", "choice", "porte_ets"],
  ["porte_ets", "Porte ETS", "choice", "porte_ets"],
  ["secours_sas", "Secours portes SAS ETS", "choice", "secours_sas"],
  ["boite_cles", "Boîte à clés", "qty", null],
  ["pti_twig", "PTI-TWIG", "qty", null],
];
export const VERIF_VIDEO = [
  ["cam_entree", "Entrée", "qty", null], ["cam_lsb", "LSB", "qty", null], ["cam_accueil", "Accueil", "qty", null],
  ["cam_sas_ets", "SAS ETS", "qty", null], ["cam_ets", "ETS", "qty", null], ["cam_attente", "Attente", "qty", null],
  ["cam_etage", "Étage", "qty", null], ["cam_salle_forte", "Salle Forte", "qty", null],
  ["cam_exterieur", "Extérieur", "qty", null], ["cam_convoyeur", "Convoyeur", "qty", null],
  ["cam_degagement", "Dégagement", "qty", null], ["enregistrement", "Enregistrement (durée)", "text", null],
];

export const COMPTE_RENDU = [
  ["cr_intrusion", "Système intrusion",
    "Essais de déclenchements positif\nVérification des transmissions\nBon fonctionnement du système intrusion"],
  ["cr_acces", "Système contrôle d'accès",
    "Essais des lecteurs d’accès\nVérification des ventouses\nEssais des commandes de secours\nBon fonctionnement du système contrôle d’accès"],
  ["cr_video", "Système vidéosurveillance",
    "Contrôle des caméras positif\nVérification des enregistrements\nBon fonctionnement du système vidéo"],
  ["cr_observations", "Observations / actions à prévoir", ""],
];

export const DEFAUTS_RAPPORT = {
  type_agence: A_RENSEIGNER, modele_centrale: A_RENSEIGNER, ligne_pau: A_RENSEIGNER,
  emplacement_centrale: A_RENSEIGNER, disjoncteur_alarme: "Intrusion", emplacement_video: A_RENSEIGNER,
  disjoncteur_video: "Vidéo", onduleur: A_RENSEIGNER, switch_poe: A_RENSEIGNER, admin_id: "admin",
  admin_pwd: "666777", auto_id: "anonyme", auto_pwd: "anonyme", nb_ecrans: "0", enregistrement: "30 jours",
  agence_externalisee: "0", ntp: "0", imei_pti: "", ecran_incivilites: "0", signatures_actives: "1",
};

// --- horaires MES / MHS
export const JOURS = [["lun", "Lundi"], ["mar", "Mardi"], ["mer", "Mercredi"], ["jeu", "Jeudi"],
  ["ven", "Vendredi"], ["sam", "Samedi"], ["dim", "Dimanche"]];
export const ZONES_HORAIRES = [["agence", "Zone Agence"], ["ets", "Zone ETS"], ["sf", "Zone Salle Forte"]];
export const cleHoraire = (zone, jour, sens) => `h_${zone}_${jour}_${sens}`;
export const aSalleForte = (t) => String(t || "").toLowerCase().includes("avec salle forte");

// --- écrans
export const MAX_ECRANS = 20;
export function nombreEcrans(v) {
  const n = parseInt(String(v ?? "").trim() || "0", 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(n, MAX_ECRANS));
}

/** Valeurs initiales d'un rapport vierge (toutes les clés du formulaire). */
export function rapportVierge() {
  const d = { ...DEFAUTS_RAPPORT };
  for (const [k, , mode] of [...VERIF_ALARME, ...VERIF_VIDEO]) {
    if (!(k in d)) d[k] = mode === "choice" ? A_RENSEIGNER : mode === "qty" ? "0" : "";
    if (k !== "enregistrement" || true) d["v_" + k] = A_RENSEIGNER;
  }
  for (const [k, , def] of COMPTE_RENDU) d[k] = def;
  for (const f of [...CHAMPS_ALARME, ...CHAMPS_VIDEO, ...CHAMPS_ENTETE]) if (!(f[0] in d)) d[f[0]] = f[2] === "spin" ? "0" : "";
  for (const [z] of ZONES_HORAIRES) for (const [j] of JOURS) for (const s of ["mes", "mhs"]) d[cleHoraire(z, j, s)] = "";
  d.date_rapport = ""; d.technicien = A_RENSEIGNER; d.nom_client = "";
  return d;
}
