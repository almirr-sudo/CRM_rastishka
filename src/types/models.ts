export type UserRole = "admin" | "manager" | "therapist" | "parent";

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

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "canceled"
  | "completed"
  | "no_show";

export type TransactionType = "charge" | "payment";

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

export interface HomeNote {
  id: string;
  child_id: string;
  author_id: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface SpecialistWorkingHours {
  id: string;
  specialist_id: string;
  weekday: number; // 0..6 (вс..сб)
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  child_id: string;
  specialist_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  is_recurring: boolean;
  recurrence_group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  child_id: string;
  appointment_id: string | null;
  amount: number;
  type: TransactionType;
  date: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}
