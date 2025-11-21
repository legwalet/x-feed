# Setting up xfeed custom domain

## Step 1: Add DNS entry to /etc/hosts

You need to add `xfeed` to your system's hosts file. Run this command in your terminal:

```bash
sudo nano /etc/hosts
```

Or use this one-liner:
```bash
echo "127.0.0.1 xfeed" | sudo tee -a /etc/hosts
```

Add this line:
```
127.0.0.1 xfeed
```

Save and exit.

## Step 2: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   - `http://xfeed:3300/auth/google/callback`
   - (Keep the existing `http://localhost:3300/auth/google/callback` as well)
4. Save

## Step 3: Update .env file

Update the `GOOGLE_REDIRECT_URI` in your `.env` file:

```env
GOOGLE_REDIRECT_URI=http://xfeed:3300/auth/google/callback
```

Or keep both and switch as needed.

## Step 4: Restart the server

```bash
npm start
```

## Step 5: Access the app

Now you can access the app at:
- `http://xfeed:3300` (new custom domain)
- `http://localhost:3300` (still works)

## Note

The server is configured to accept requests from both `localhost` and `xfeed` domains.

