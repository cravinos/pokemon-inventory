# Pokemon Sealed Inventory Site

A free, public-facing inventory page for bulk Pokemon sealed product. You manage stock from the Airtable iPhone app; buyers just browse.

---

## Step 1 — Create your Airtable base

1. Go to [airtable.com](https://airtable.com) and create a free account.
2. Create a new **Base** called `Pokemon Inventory`.
3. Rename the default table to `Inventory`.
4. Set up these fields exactly:

| Field name | Field type | Notes |
|---|---|---|
| `Name` | Single line text | Product name, e.g. "Prismatic Evolutions Booster Box" |
| `Price` | Number | Enable "Format as currency" |
| `Quantity` | Number | Units in stock |
| `Condition` | Single select | Add options: `New`, `Damaged` |
| `Category` | Single select | Add: `Booster Box`, `ETB`, `Tin`, `Blister Pack`, `Bundle`, `Other` |

5. Add a few rows of test data.

---

## Step 2 — Get your Airtable credentials

### Personal Access Token
1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Click **Create new token**
3. Name it `inventory-site`
4. Scopes: add `data.records:read`
5. Access: select your `Pokemon Inventory` base
6. Click **Create token** — copy it (you won't see it again)

### Base ID
1. Open your base in the browser
2. The URL looks like: `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. Copy the part starting with `app...` — that's your Base ID

---

## Step 3 — Push to GitHub

```bash
cd pokemon-inventory
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/pokemon-inventory.git
git push -u origin main
```

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub (free).
2. Click **Add New Project** → import your `pokemon-inventory` repo.
3. Before deploying, click **Environment Variables** and add:

| Name | Value |
|---|---|
| `AIRTABLE_TOKEN` | Your personal access token from Step 2 |
| `AIRTABLE_BASE_ID` | Your base ID (starts with `app`) |
| `AIRTABLE_TABLE_NAME` | `Inventory` |

4. Click **Deploy**. Your site will be live at `https://your-project.vercel.app` in ~1 minute.

> To use a custom domain later, add it in Vercel's **Domains** settings. It's free.

---

## Step 5 — Manage inventory from your iPhone

1. Download the **Airtable** app from the App Store (free).
2. Sign in with your account — your base will appear automatically.
3. Open the `Inventory` table and edit rows directly: update quantities, add new products, change prices.
4. Changes reflect on the website within **60 seconds**.

---

## Local development

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local with your real credentials
npm run dev
# Open http://localhost:3000
```
