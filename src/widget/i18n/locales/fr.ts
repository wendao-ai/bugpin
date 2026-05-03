import type { WidgetCatalog } from '../catalog.js';

const fr: WidgetCatalog = {
  'tooltip.launcher': 'Tu as trouvé un bug ?',

  'aria.launcher': 'Signaler un bug',
  'aria.close': 'Fermer',

  'dialog.title': 'Signaler un bug',
  'dialog.tabs.details': 'Détails',
  'dialog.tabs.media': "Captures d'écran",
  'dialog.tabs.mediaWithCount': "Captures d'écran ({count})",

  'dialog.fields.title.label': 'Titre',
  'dialog.fields.title.placeholder': 'Brève description du problème',
  'dialog.fields.description.label': 'Description',
  'dialog.fields.description.placeholder': 'Étapes de reproduction, comportement attendu, etc.',
  'dialog.fields.priority.label': 'Priorité',
  'dialog.fields.name.label': 'Nom (facultatif)',
  'dialog.fields.name.placeholder': 'Ton nom',
  'dialog.fields.email.label': 'E-mail (facultatif)',
  'dialog.fields.email.placeholder': 'ton@email.com',

  'dialog.priority.highest': 'Très haute',
  'dialog.priority.high': 'Haute',
  'dialog.priority.medium': 'Moyenne',
  'dialog.priority.low': 'Basse',
  'dialog.priority.lowest': 'Très basse',

  'dialog.buttons.cancel': 'Annuler',
  'dialog.buttons.submit': 'Envoyer le rapport',

  'dialog.branding.poweredBy': 'Propulsé par',

  'validation.title.required': 'Le titre est obligatoire',
  'validation.title.minLength': 'Le titre doit comporter au moins 4 caractères',
  'validation.email.invalid': 'Adresse e-mail invalide',

  'closeConfirm.title': 'Enregistrer le brouillon ?',
  'closeConfirm.body':
    'Tu as des modifications non enregistrées. Veux-tu les sauvegarder comme brouillon pour plus tard ?',
  'closeConfirm.discardButton': 'Abandonner',
  'closeConfirm.saveDraftButton': 'Enregistrer le brouillon',

  'screenCapture.title': 'Permission du navigateur requise',
  'screenCapture.body':
    "Ton navigateur va te demander l'autorisation de partager ton écran. Suis les étapes indiquées.",
  'screenCapture.browser.firefox': 'Firefox',
  'screenCapture.browser.chromeEdge': 'Chrome · Edge',
  'screenCapture.dontShowAgain': 'Ne plus afficher',
  'screenCapture.back': 'Retour',
  'screenCapture.confirm': 'Prendre la capture',

  'screenshot.privacyTip':
    "Conseil : utilise l'outil d'annotation pour masquer les données sensibles avant d'envoyer.",
  'screenshot.capturing': 'Capture en cours...',
  'screenshot.capture': "Capturer l'écran",
  'screenshot.dropzone.title': 'Fais glisser tes fichiers ici',
  'screenshot.dropzone.subtitle': 'ou clique pour parcourir',
  'screenshot.addMore': "Ajouter d'autres",
  'screenshot.alt': "Capture d'écran",
  'screenshot.badge.annotated': 'Annoté',
  'screenshot.badge.video': 'Vidéo',
  'screenshot.action.annotate': 'Annoter',
  'screenshot.action.remove': 'Supprimer',
  'screenshot.helperText':
    'Formats acceptés : PNG, JPG, GIF, WebP (max. {imageSize} Mo) - MP4, WebM, MOV, AVI (max. {videoSize} Mo)',

  'screenshot.error.unsupportedImage': "Format d'image non pris en charge : {type}",
  'screenshot.error.imageTooLarge': 'Image trop volumineuse. Taille maximale : {size} Mo.',
  'screenshot.error.unsupportedVideo': 'Format de vidéo non pris en charge : {type}',
  'screenshot.error.videoTooLarge': 'Vidéo trop volumineuse. Taille maximale : {size} Mo.',
  'screenshot.error.unsupportedFile': 'Type de fichier non pris en charge : {type}',

  'toast.success.submit': 'Rapport de bug envoyé avec succès !',
  'toast.error.submit': "Échec de l'envoi du rapport",
  'toast.error.capture': "Échec de la capture d'écran",

  'annotation.toolbar.select': 'Sélectionner',
  'annotation.toolbar.pan': 'Déplacer (ou maintenir Space)',
  'annotation.toolbar.pen': 'Stylo',
  'annotation.toolbar.line': 'Ligne',
  'annotation.toolbar.arrow': 'Flèche',
  'annotation.toolbar.rectangle': 'Rectangle',
  'annotation.toolbar.circle': 'Cercle',
  'annotation.toolbar.text': 'Texte',
  'annotation.toolbar.pixelate': 'Pixeliser',
  'annotation.toolbar.undo': 'Annuler (Ctrl+Z)',
  'annotation.toolbar.redo': 'Rétablir (Ctrl+Shift+Z)',
  'annotation.toolbar.delete': 'Supprimer la sélection (Del)',
  'annotation.toolbar.zoomIn': 'Zoom avant - Maintenir Space pour déplacer',
  'annotation.toolbar.zoomOut': 'Zoom arrière - Maintenir Space pour déplacer',
  'annotation.toolbar.zoomReset':
    'Réinitialiser le zoom ({percent}%) - Maintenir Space pour déplacer',
  'annotation.toolbar.strokeWidth': '{width}px',
  'annotation.defaultText': 'Texte',
  'annotation.buttons.cancel': 'Annuler',
  'annotation.buttons.done': 'Terminer',
};

export default fr;
