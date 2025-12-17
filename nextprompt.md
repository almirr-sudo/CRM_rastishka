# Context Update
We have successfully built the MVP for the "Special Needs Child Development CRM" (Child profiles, Daily Logs, ABC tracking).
Now, I need to integrate **Business & Scheduling functionality**, inspired by the app **"Bumpix"**, but adapted for a Therapy Center context.

# New Objective
Add a module for **Appointment Scheduling, Service Management, and Financial Tracking**. This allows the admin to manage therapist schedules, book specific therapy sessions for children, and track payments (tuition/session fees).

# Feature Requirements (The "Bumpix" Logic)

## 1. Service & Specialist Management (Settings)
* **Services Catalog:** Ability to define services (e.g., "Speech Therapy (30 min)", "ABA Therapy (1 hour)", "Group Circle").
    * *Fields:* Name, Default Duration, Price, Color Code.
* **Specialist Schedule:** Define working hours for each therapist (e.g., "Ms. Anna: Mon-Fri, 09:00 - 15:00").

## 2. Smart Calendar (Scheduling Core)
* **Views:** Day, Week, Month, and "Timeline View" (Specialists as rows, Time as columns).
* **Booking Actions:**
    * Drag-and-drop to move appointments.
    * Click empty slot -> "New Appointment".
    * Recurring appointments (e.g., "Every Tuesday/Thursday at 10:00 for 3 months").
* **Conflict Detection:** Prevent double-booking a specialist or a child at the same time.
* **Status:** Pending, Confirmed, Canceled, Completed, No-Show.

## 3. Financial Module (Billing)
* **Invoicing:** Automatically generate a debt when an appointment is "Completed".
* **Payments:** Log payments from parents (Cash, Card, Transfer).
* **Balance:** Show the child's current balance (Positive = Credit, Negative = Debt).
* **Income Reports:** Simple chart showing revenue by Specialist or by Service type.

## 4. Notifications (Reminders)
* **SMS/WhatsApp format generator:** A button to copy a pre-filled text message to send to parents: *"Reminder: [Child Name] has [Service] tomorrow at [Time]."*

# Technical Implementation Updates

## Database Schema Extensions (Supabase)
Please extend the existing schema with these tables:
1.  `services`: id, name, price, duration_min, color.
2.  `appointments`: id, child_id, specialist_id (user_id), service_id, start_time, end_time, status, notes, is_recurring.
3.  `transactions`: id, child_id, amount, type ('charge', 'payment'), date, description.

## UI Components Needed
1.  **Calendar Component:** Use a library like `react-big-calendar` or `@fullcalendar/react` (or build a custom grid using Tailwind grid if you prefer simplicity and control).
2.  **Finance Widget:** A component on the Child's Profile showing "Total Due: $X" with a "Add Payment" button.

# Task
1.  Update the **Database Schema** (provide SQL).
2.  Create the **Services Management** page.
3.  Implement the **Calendar Page** with drag-and-drop logic.
4.  Connect the **Financial Logic** (Deduct money when appointment completes).

Start by providing the SQL for the new tables.