# X Feed - Personalized Twitter Feed App

A modern, stylish web application that connects to Twitter/X API to fetch personalized feeds based on your interests, view specific user feeds (like @Quanty007), and search tweets. Login with your Google account for a personalized experience.

## Features

- 🔐 **Google OAuth Login**: Authenticate with your Google account
- 👤 **User Feeds**: View tweets from specific users (e.g., @Quanty007)
- 🔍 **Search Tweets**: Search through Twitter for any topic
- 🎯 **Interest-based feeds**: Add multiple interests and get curated tweets
- 🎨 **Modern UI**: Beautiful gradient design with Tailwind CSS
- 💾 **Persistent interests**: Your interests are saved in localStorage
- 🔄 **Real-time updates**: Fetch latest tweets with one click
- 📱 **Responsive design**: Works on all devices

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud Console account (for OAuth)
- Twitter/X Developer Account (for API access)

## Getting Started

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:3300/auth/google/callback`
7. Copy your **Client ID** and **Client Secret**

### 2. Get Twitter/X API Bearer Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use an existing one
3. Navigate to "Keys and tokens"
4. Generate a **Bearer Token**
5. Copy the token

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Google OAuth (Required for login)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3300/auth/google/callback

# Twitter API (Required for feeds)
TWITTER_BEARER_TOKEN=your_bearer_token_here

# Session Secret (auto-generated if not set)
SESSION_SECRET=your_random_session_secret_here

# Server Port
PORT=3300
```

### 5. Build Tailwind CSS

```bash
npm run build-css
```

This will generate the CSS file. Keep this running in a separate terminal, or run it once before starting the server.

### 6. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 7. Open in Browser

Navigate to `http://localhost:3300`

## Usage

### Login

1. Click **"Login with Google"** button in the header
2. Select your Google account and authorize the app
3. You'll be redirected back to the app

### View @Quanty007's Feed

1. After logging in, click the **"@Quanty007"** tab
2. Click **"Load @Quanty007's Feed"** to view their latest tweets
3. Browse through their tweets with engagement metrics

### Search Tweets

1. Click the **"Search"** tab
2. Enter a search query (e.g., "AI", "JavaScript", "#hashtag")
3. Click **"Search"** to find matching tweets

### Interest-Based Feeds

1. Click the **"Interests"** tab
2. Add interests by typing keywords (e.g., "AI", "JavaScript", "Design") and clicking "Add"
3. Click **"Fetch Feeds"** to get tweets matching your interests
4. Your interests are saved automatically

## Project Structure

```
x-feed/
├── server.js              # Express server, Google OAuth, and API routes
├── package.json           # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── .env                  # Environment variables (create this)
├── public/
│   ├── index.html        # Main HTML page
│   ├── css/
│   │   ├── input.css     # Tailwind input file
│   │   └── output.css    # Generated CSS (after build)
│   └── js/
│       └── app.js        # Frontend JavaScript
└── README.md
```

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/google/callback` - Google OAuth callback handler
- `POST /auth/logout` - Logout user
- `GET /api/auth/status` - Check authentication status

### Feeds
- `GET /api/feeds/user/:username?maxResults=20` - Get tweets from a specific user (e.g., /api/feeds/user/Quanty007)
- `GET /api/feeds/search?query=...&maxResults=10` - Search tweets
- `POST /api/feeds/interests` - Fetch tweets based on interests
  - Body: `{ "interests": ["AI", "JavaScript"], "maxResults": 20 }`

## Technologies Used

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Express Session** - Session management
- **Google OAuth 2.0** - Google authentication
- **Tailwind CSS** - Styling
- **Twitter API v2** - Twitter/X integration
- **Axios** - HTTP client

## Security Notes

- Sessions are stored server-side with secure cookies
- Google OAuth 2.0 for secure authentication
- Twitter API uses Bearer Token (read-only public feeds)
- Never commit your `.env` file to version control

## Notes

- The app uses Twitter API v2 with Bearer Token for public feeds
- Free tier has rate limits (varies by endpoint)
- Interests are saved in browser localStorage
- The app searches for tweets containing your interest keywords
- User feeds work with Bearer Token (no user OAuth required)
- Google login is for app authentication only

## Troubleshooting

### Google OAuth Not Working
- Ensure your redirect URI in Google Cloud Console matches exactly: `http://localhost:3300/auth/google/callback`
- Check that Google+ API is enabled in your Google Cloud project
- Verify your Client ID and Client Secret are correct

### Twitter Feeds Not Loading
- Make sure your Twitter Bearer Token is valid
- Check that your Twitter app has the necessary permissions
- Verify the Bearer Token hasn't expired

### User Feed Not Loading
- Ensure the username is correct (e.g., "Quanty007" not "@Quanty007")
- Check that the user's account is public
- Verify your Bearer Token has read permissions

## License

MIT
