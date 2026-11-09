export const TASK_TYPE_LABELS = {
  COLLECTION: "Cobro",
  MESSAGE: "Mensaje",
  CALL: "Llamada",
  MEETING: "Reunión",
  RENEWAL: "Renovación",
  FOLLOW_UP: "Seguimiento",
  OTHER: "Otro",
} as const;

export const TASK_RECURRENCE_LABELS = {
  NONE: "No se repite",
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
} as const;

export const PROJECT_STATUS_LABELS = {
  PLANNING: "Planificación",
  IN_PROGRESS: "En desarrollo",
  LIVE: "En producción",
  MAINTENANCE: "Mantenimiento",
  PAUSED: "Pausado",
  CLOSED: "Cerrado",
} as const;

export const COMPONENT_KIND_LABELS = {
  WEB: "Web",
  MOBILE: "App móvil",
  BACKEND: "Backend / API",
  ADMIN: "Panel admin",
  INTEGRATION: "Integración",
  OTHER: "Otro",
} as const;

export const INTERACTION_TYPE_LABELS = {
  CALL: "Llamada",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  MEETING: "Reunión",
  NOTE: "Nota",
} as const;

export type TaskTypeCode = keyof typeof TASK_TYPE_LABELS;
export type TaskRecurrenceCode = keyof typeof TASK_RECURRENCE_LABELS;
export type ProjectStatusCode = keyof typeof PROJECT_STATUS_LABELS;
export type ComponentKindCode = keyof typeof COMPONENT_KIND_LABELS;
export type InteractionTypeCode = keyof typeof INTERACTION_TYPE_LABELS;
