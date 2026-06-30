// Canonical muscle groups — mirror the section headers in exercises_library.sql.
// Used by the "create exercise" prompt, the classify-existing flow, and the
// muscle-balance / cycle-distribution views.
export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Core', 'Pierna']

// Bucket for exercises with no group assigned (own table) and none in the
// library. Shown muted and last; not a real muscle group.
export const CATCH_ALL = 'Otros'
