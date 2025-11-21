const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3300;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware
const allowedOrigins = [
  `http://localhost:${PORT}`,
  `http://xfeed:${PORT}`,
  `http://xfeed`
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://xfeed')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;

// Twitter/X API configuration (using Bearer Token for public feeds)
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Initialize Google OAuth client
let oauth2Client = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// Helper function to make Twitter API requests with Bearer token
async function fetchTwitterData(endpoint, params = {}) {
  try {
    if (!BEARER_TOKEN) {
      throw new Error('Twitter Bearer Token not configured');
    }
    
    const response = await axios.get(`${TWITTER_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        ...params,
        'tweet.fields': 'created_at,author_id,public_metrics,text,entities',
        'user.fields': 'name,username,profile_image_url',
        'expansions': 'author_id'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Twitter API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.googleUser,
    user: req.session.googleUser || null
  });
});

// Initiate Google OAuth login
app.get('/auth/google', (req, res) => {
  if (!oauth2Client) {
    return res.status(500).json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' });
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    state: state,
    prompt: 'consent'
  });

  res.redirect(authUrl);
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  // Verify state
  if (!state || state !== req.session.oauthState) {
    return res.redirect('/?error=invalid_state');
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    // Store user info in session
    req.session.googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name
    };
    req.session.googleTokens = tokens;

    // Clear OAuth state
    delete req.session.oauthState;

    res.redirect('/');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Search tweets by query/keywords
app.get('/api/feeds/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

    // Format the response
    const tweets = data.data || [];
    const users = data.includes?.users || [];
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    const formattedTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      author: userMap[tweet.author_id] || {},
      metrics: tweet.public_metrics,
      entities: tweet.entities
    }));

    res.json({ tweets: formattedTweets });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch tweets',
      message: error.response?.data?.detail || error.message 
    });
  }
});

// Get feeds based on multiple interests
app.post('/api/feeds/interests', async (req, res) => {
  try {
    const { interests, maxResults = 10 } = req.body;
    
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: 'Interests array is required' });
    }

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    // Combine interests into a search query
    const query = interests.map(interest => `"${interest}"`).join(' OR ');
    
    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

    // Format the response
    const tweets = data.data || [];
    const users = data.includes?.users || [];
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    const formattedTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      author: userMap[tweet.author_id] || {},
      metrics: tweet.public_metrics,
      entities: tweet.entities
    }));

    res.json({ tweets: formattedTweets });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch tweets',
      message: error.response?.data?.detail || error.message 
    });
  }
});

// Get tweets from specific user (e.g., @Quanty007)
app.get('/api/feeds/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { maxResults = 10 } = req.query;

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    // First, get user ID from username
    const userResponse = await axios.get(`${TWITTER_API_BASE}/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const userId = userResponse.data.data.id;

    // Get user's tweets
    const data = await fetchTwitterData(`/users/${userId}/tweets`, {
      max_results: Math.min(parseInt(maxResults), 100),
      'tweet.fields': 'created_at,author_id,public_metrics,text,entities',
      'user.fields': 'name,username,profile_image_url',
      'expansions': 'author_id'
    });

    // Format the response
    const tweets = data.data || [];
    const users = data.includes?.users || [];
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    const formattedTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      author: userMap[tweet.author_id] || {},
      metrics: tweet.public_metrics,
      entities: tweet.entities
    }));

    res.json({ tweets: formattedTweets, user: userResponse.data.data });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch user tweets',
      message: error.response?.data?.detail || error.message 
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://xfeed:${PORT} (if xfeed is in /etc/hosts)`);
  if (!GOOGLE_CLIENT_ID) {
    console.warn('⚠️  Warning: GOOGLE_CLIENT_ID not set. Google OAuth login will not work.');
  }
  if (!BEARER_TOKEN) {
    console.warn('⚠️  Warning: TWITTER_BEARER_TOKEN not set. Twitter feeds will not work.');
  }
});
