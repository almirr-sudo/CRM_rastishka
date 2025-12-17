export type UserRole = "admin" | "therapist" | "parent";

export type FoodIntake = "all" | "half" | "none" | "refusal";

export type GoalStatus = "in_progress" | "mastered";

export type PromptLevel = "independent" | "verbal" | "gestural" | "physical";

export type TimelineEventType =
  | "food"
  | "mood"
  | "nap_start"
  | "nap_end"
  | "note"
  | "custom";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  name: string;
  dob: string | null;
  diagnosis: string | null;
  dietary_restrictions: string | null;
  avatar_url: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TherapistChild {
  id: string;
  child_id: string;
  therapist_id: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  child_id: string;
  date: string; // YYYY-MM-DD
  mood_score: number | null; // 1..5
  sleep_duration: number | null; // минуты (MVP)
  food_intake: FoodIntake | null;
  toilet_data: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BehaviorIncident {
  id: string;
  child_id: string;
  timestamp: string;
  antecedent: string | null;
  behavior: string | null;
  consequence: string | null;
  intensity: number | null; // 1..10
  created_by: string | null;
  created_at: string;
}

export interface SkillGoal {
  id: string;
  child_id: string;
  goal_title: string;
  status: GoalStatus;
  target_date: string | null; // YYYY-MM-DD
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillTracking {
  id: string;
  goal_id: string;
  date: string; // YYYY-MM-DD
  prompt_level: PromptLevel;
  success: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  child_id: string;
  timestamp: string;
  type: TimelineEventType;
  payload: Json;
  created_by: string | null;
  created_at: string;
}
