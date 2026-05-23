# Supabase Setup Guide — CareerPilot

This document outlines the manual cloud configuration steps required in the Supabase Dashboard to sync your remote database with the backend codebase.

---

## Step 1: Run SQL Migrations & Stored Procedures
1. Go to the [Supabase Dashboard](https://supabase.com).
2. Open your project and select **SQL Editor** from the left-hand navigation.
3. Click **New query**.
4. Copy and paste the entire contents of [20260524_init.sql](file:///c:/Users/My/Downloads/CareerPilot/supabase/migrations/20260524_init.sql).
5. Click **Run** (bottom right).
6. Verify that 9 tables are created by running:
   ```sql
   select table_name from information_schema.tables 
   where table_schema = 'public';
   ```

---

## Step 2: Enable Supabase Realtime
To support instant updates on the Kanban board and live AI reminders (nudges) on the dashboard, turn on postgres replication:
1. In the Supabase Dashboard, go to **Database** (left sidebar) → **Replication**.
2. Find the **supabase_realtime** publication list.
3. Enable replication for these tables:
   - `applications`
   - `nudges`
4. Verify both are toggled **ON** (active).

---

## Step 3: Configure Auth Providers
To enable development login:
1. Go to **Authentication** → **Providers** → **Email**.
2. Toggle **Enable Email provider** to **ON**.
3. Toggle **Confirm email** to **OFF** (this bypasses verification emails during local development).
4. Click **Save**.

---

## Step 4: Create CV Storage Bucket
Our parser downloads and stores resume documents in a private bucket:
1. Go to **Storage** (left sidebar).
2. Click **New bucket**.
3. Configure the bucket:
   - **Name:** `cv-files`
   - **Public:** **OFF** (keep private)
4. Click **Create bucket**.
5. Select the `cv-files` bucket, go to the **Policies** tab, and click **New policy**.
6. Select **Allow authenticated users to upload** (insert permission) from templates.
7. Click **Review** → **Save policy**.

---

## Step 5: Update API Keys
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **`service_role`** key (labeled `service_role secret`, **not** the `anon public` key).
3. Paste it into your `backend/.env` file:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
