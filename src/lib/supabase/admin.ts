import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./public-env";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isServiceRoleConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = isServiceRoleConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

