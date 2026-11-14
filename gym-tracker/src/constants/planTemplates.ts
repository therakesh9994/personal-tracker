export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  repsMax?: number;
  rest: number;
}

export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  days: TemplateDay[];
}

const e = (exerciseId: string, sets: number, reps: number, repsMax?: number, rest = 90): TemplateExercise => ({
  exerciseId,
  sets,
  reps,
  repsMax,
  rest,
});

/** Suggested plans seeded as editable templates (users can duplicate, edit, or delete them). */
export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'tpl_ppl',
    name: 'Push / Pull / Legs',
    description: 'Classic 3-day split hitting each movement pattern once. Run it twice a week for 6 sessions.',
    days: [
      {
        name: 'Push',
        exercises: [
          e('ex_bench_press', 4, 6, 8, 150),
          e('ex_ohp', 3, 8, 10, 120),
          e('ex_incline_db_press', 3, 8, 12),
          e('ex_lateral_raise', 3, 12, 15, 60),
          e('ex_tricep_pushdown', 3, 10, 12, 60),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          e('ex_deadlift', 3, 5, undefined, 180),
          e('ex_pull_up', 3, 6, 10, 120),
          e('ex_barbell_row', 3, 8, 10, 120),
          e('ex_face_pull', 3, 12, 15, 60),
          e('ex_barbell_curl', 3, 10, 12, 60),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('ex_back_squat', 4, 6, 8, 180),
          e('ex_romanian_deadlift', 3, 8, 10, 120),
          e('ex_leg_press', 3, 10, 12, 120),
          e('ex_leg_curl', 3, 10, 12, 60),
          e('ex_standing_calf_raise', 4, 12, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'tpl_upper_lower',
    name: 'Upper / Lower',
    description: '4-day split alternating upper and lower body sessions.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          e('ex_bench_press', 4, 6, 8, 150),
          e('ex_barbell_row', 4, 6, 8, 120),
          e('ex_db_shoulder_press', 3, 8, 10),
          e('ex_lat_pulldown', 3, 10, 12),
          e('ex_db_curl', 2, 10, 12, 60),
          e('ex_tricep_pushdown', 2, 10, 12, 60),
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          e('ex_back_squat', 4, 6, 8, 180),
          e('ex_romanian_deadlift', 3, 8, 10, 120),
          e('ex_leg_extension', 3, 12, 15, 60),
          e('ex_leg_curl', 3, 10, 12, 60),
          e('ex_standing_calf_raise', 3, 12, 15, 60),
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          e('ex_ohp', 4, 6, 8, 150),
          e('ex_pull_up', 4, 6, 10, 120),
          e('ex_incline_db_press', 3, 8, 12),
          e('ex_seated_cable_row', 3, 10, 12),
          e('ex_lateral_raise', 3, 12, 15, 60),
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          e('ex_deadlift', 3, 5, undefined, 180),
          e('ex_bulgarian_split_squat', 3, 8, 10, 90),
          e('ex_hip_thrust', 3, 8, 12, 90),
          e('ex_seated_calf_raise', 3, 12, 15, 60),
          e('ex_hanging_leg_raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'tpl_bro_split',
    name: 'Bro Split',
    description: '5-day bodybuilding split training one muscle group per day.',
    days: [
      {
        name: 'Chest',
        exercises: [
          e('ex_bench_press', 4, 8, 10, 120),
          e('ex_incline_db_press', 3, 8, 12),
          e('ex_cable_fly', 3, 12, 15, 60),
          e('ex_dips_chest', 3, 8, 12),
        ],
      },
      {
        name: 'Back',
        exercises: [
          e('ex_deadlift', 3, 5, undefined, 180),
          e('ex_lat_pulldown', 4, 8, 12),
          e('ex_db_row', 3, 10, 12),
          e('ex_straight_arm_pulldown', 3, 12, 15, 60),
        ],
      },
      {
        name: 'Shoulders',
        exercises: [
          e('ex_ohp', 4, 6, 10, 120),
          e('ex_lateral_raise', 4, 12, 15, 60),
          e('ex_rear_delt_fly', 3, 12, 15, 60),
          e('ex_shrug', 3, 10, 12, 60),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('ex_back_squat', 4, 6, 10, 180),
          e('ex_leg_press', 3, 10, 12, 120),
          e('ex_leg_curl', 3, 10, 12, 60),
          e('ex_leg_extension', 3, 12, 15, 60),
          e('ex_standing_calf_raise', 4, 12, 15, 60),
        ],
      },
      {
        name: 'Arms',
        exercises: [
          e('ex_barbell_curl', 3, 8, 12, 60),
          e('ex_close_grip_bench', 3, 8, 10, 90),
          e('ex_hammer_curl', 3, 10, 12, 60),
          e('ex_skull_crusher', 3, 10, 12, 60),
          e('ex_cable_curl', 2, 12, 15, 60),
          e('ex_tricep_pushdown', 2, 12, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'tpl_full_body',
    name: 'Full Body',
    description: '3 full-body sessions per week, ideal for beginners or busy schedules.',
    days: [
      {
        name: 'Full Body A',
        exercises: [
          e('ex_back_squat', 3, 5, 8, 180),
          e('ex_bench_press', 3, 5, 8, 150),
          e('ex_barbell_row', 3, 8, 10, 120),
          e('ex_plank', 3, 30, 60, 60),
        ],
      },
      {
        name: 'Full Body B',
        exercises: [
          e('ex_deadlift', 3, 5, undefined, 180),
          e('ex_ohp', 3, 6, 8, 120),
          e('ex_pull_up', 3, 6, 10, 120),
          e('ex_hanging_leg_raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
];
