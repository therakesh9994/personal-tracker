import type { Equipment, ExerciseType, MuscleGroup, SetType } from '@/database/schema';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  glutes: 'Glutes',
  abs: 'Abs',
  cardio: 'Cardio',
  full_body: 'Full body',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  smith_machine: 'Smith machine',
  ez_bar: 'EZ bar',
  cardio_machine: 'Cardio machine',
  other: 'Other',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  strength: 'Strength',
  bodyweight: 'Bodyweight',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Warm-up',
  working: 'Working',
  drop: 'Drop set',
  failure: 'Failure',
  other: 'Other',
};

export const SET_TYPE_SHORT: Record<SetType, string> = {
  warmup: 'W',
  working: '',
  drop: 'D',
  failure: 'F',
  other: 'O',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
