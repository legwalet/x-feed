# Deploying to Netlify

## Prerequisites

1. GitHub account with the repo: https://github.com/legwalet/x-feed
2. Netlify account (free tier works)
3. All environment variables ready

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit - X Feed app"
git branch -M main
git remote add origin https://github.com/legwalet/x-feed.git
git push -u origin main
```

## Step 2: Deploy to Netlify

### Option A: Via Netlify Dashboard

1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub
4. Select repository: `legwalet/x-feed`
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
6. Click "Deploy site"

### Option B: Via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
# Follow prompts:
# - Create & configure a new site
# - Team: (select your team)
# - Site name: xfeed
# - Build command: npm run build
# - Publish directory: public
# - Functions directory: netlify/functions
netlify deploy --prod
```

## Step 3: Configure Environment Variables

In Netlify Dashboard:
1. Go to Site settings → Environment variables
2. Add these variables:

```
TWITTER_BEARER_TOKEN=your_bearer_token_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://xfeed.netlify.app/auth/google/callback
```

**Important**: Update `GOOGLE_REDIRECT_URI` to your actual Netlify URL (e.g., `https://xfeed.netlify.app/auth/google/callback`)

## Step 4: Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   - `https://xfeed.netlify.app/auth/google/callback`
   - (Replace with your actual Netlify URL)

## Step 5: Custom Domain (Optional)

1. In Netlify Dashboard → Domain settings
2. Add custom domain: `xfeed.com` (or your preferred domain)
3. Follow DNS configuration instructions

## Notes

- The app uses Netlify Functions for API endpoints
- Static files are served from the `public` directory
- OAuth callbacks need to be updated to use the Netlify URL
- Make sure to rebuild after adding environment variables

## Troubleshooting

- If functions don't work, check Netlify Functions logs
- Verify environment variables are set correctly
- Check that the build completes successfully
- Ensure redirect URIs match your Netlify URL

