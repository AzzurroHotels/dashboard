# 🏨 Azzurro Hotels — Management System

Unified dashboard system with **Maintenance**, **HR**, and **Complaints** management. Single login, admin-controlled dashboard access, powered by **Supabase**.

---

## 📁 File Structure

```
azzurro-dashboard/
├── index.html              ← Main shell (login + sidebar + iframes)
├── admin.html              ← Admin panel (user management)
├── supabase-config.js      ← ⚠️ YOUR SUPABASE CREDENTIALS GO HERE
├── supabase-schema.sql     ← Database schema (run in Supabase SQL Editor)
├── make-first-admin.sql    ← Helper to make your first user admin
├── maintenance/
│   └── index.html          ← Maintenance dashboard (Firebase)
├── hr/
│   ├── index.html          ← HR login page
│   ├── app.html            ← HR dashboard (Trello-style)
│   ├── app.js              ← HR logic
│   ├── auth.js             ← HR auth
│   ├── auth.css            ← HR auth styles
│   ├── styles.css          ← HR styles
│   └── supabase-config.js  ← Re-exports from shared config
└── complaints/
    └── index.html          ← Complaints dashboard + AI assistant
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"**
3. Name it `azzurro-dashboard` (or whatever you like)
4. Set a strong **database password** (save this!)
5. Choose a region close to you
6. Wait for the project to be ready (~2 min)

### Step 2: Run the Database Schema

1. In your Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open `supabase-schema.sql` from this project
4. Copy the **entire** contents and paste into the SQL Editor
5. Click **"Run"** — you should see "Success" for each command

### Step 3: Configure Supabase Credentials

1. In Supabase Dashboard, go to **Settings → API**
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon/public key** (the long string)
4. Open `supabase-config.js` in your code editor
5. Replace the placeholders:

```js
export const SUPABASE_URL = "https://YOUR_ACTUAL_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGci...YOUR_ACTUAL_KEY...";
```

### Step 4: Disable Email Confirmation (for testing)

1. In Supabase Dashboard, go to **Authentication → Providers**
2. Under **Email**, toggle OFF **"Confirm email"**
3. This lets you sign up and immediately log in (turn it back on for production)

### Step 4b: Create Storage Buckets (for file uploads)

1. In Supabase Dashboard, go to **Storage** (left sidebar)
2. Click **"New bucket"** and create: `maintenance-media`
3. Click **"New bucket"** again and create: `complaint-media`
4. For each bucket: click on it → **Policies** → **New Policy** → choose **"Allow authenticated access"** for uploads and reads

### Step 5: Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push all files:

```bash
git init
git add .
git commit -m "Azzurro Hotels Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/azzurro-dashboard.git
git push -u origin main
```

3. Go to your repo → **Settings → Pages**
4. Under "Source", select **Deploy from a branch**
5. Choose **main** branch, root folder **/ (root)**
6. Click **Save**
7. Wait ~1 min, your site will be live at: `https://YOUR_USERNAME.github.io/azzurro-dashboard/`

### Step 6: Create Your Admin Account

1. Open the live site
2. Click **"Create Account"** and sign up with your email
3. Go back to Supabase → **SQL Editor**
4. Open `make-first-admin.sql`
5. Replace `YOUR_EMAIL@example.com` with the email you signed up with
6. Run it
7. **Sign out and sign back in** — you'll now see all dashboards + User Management

### Step 7: Add Staff Members

1. Have staff sign up via the site (Create Account)
2. As admin, go to **⚙️ User Management**
3. Click on a user → change their **Role** and toggle which **Dashboards** they can access
4. They'll see the changes on their next login

---

## 🔧 How It Works

| Feature | How |
|---|---|
| **Single Login** | Main shell (`index.html`) handles all auth via Supabase Auth |
| **Dashboard Access** | Admin toggles access per user in the admin panel. Stored in `dashboard_access` table |
| **Sidebar** | Only shows dashboards the user has been granted |
| **Dashboards** | Each loads in an iframe. They share the same Supabase session (same origin) |
| **Realtime** | Admin panel updates in real-time when users/access changes |
| **New Signups** | Get zero dashboard access by default. Admin must assign. |

---

## 📋 Dashboard Details

### Maintenance (Supabase)
- Property → Room → Issue hierarchy
- Photo/video upload for issue evidence (requires Supabase Storage bucket `maintenance-media`)
- Archive/unarchive issues
- Realtime updates across all users

### HR Dashboard (Supabase)
- 7-column Trello-style task board
- Add/archive/delete/restore tasks
- Department-based organization
- Admin-only delete permissions

### Complaints (Supabase)
- 4-column Kanban: Urgent → Pending → In Progress → Solved
- Drag-and-drop between columns
- Activity timeline with photo/video attachments
- AI Chat Assistant (uses Anthropic API)
- Full complaint lifecycle management
- All data persisted to Supabase

---

## 🔒 Security Notes

- `supabase-config.js` contains your **anon key** — this is safe for client-side use as long as you have proper **Row Level Security (RLS)** policies (already set up in the schema)
- Never put your **service_role key** in client code

---

## ❓ Troubleshooting

**"Supabase not configured" error on login page**
→ You haven't updated `supabase-config.js` with your real credentials

**Can't sign up / "User already registered"**
→ Email already exists. Try signing in instead.

**No dashboards showing after login**
→ Your account has no dashboard access. Run `make-first-admin.sql` for the first user, or ask an admin to grant access.

**HR dashboard shows its own login page**
→ The HR iframe has its own auth. Since you're on the same domain, the Supabase session should carry over. If not, log in with the same credentials.

**Admin panel doesn't show users**
→ Make sure your profile has `role = 'admin'` in the profiles table.
