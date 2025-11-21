const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
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

// Twitter OAuth 1.0a configuration
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_KEY_SECRET = process.env.TWITTER_API_KEY_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || `http://localhost:${PORT}/auth/twitter/callback`;

// Twitter/X API configuration
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_OAUTH_BASE = 'https://api.twitter.com/oauth';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Initialize OAuth 1.0a
const oauth = OAuth({
  consumer: {
    key: TWITTER_API_KEY,
    secret: TWITTER_API_KEY_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
});

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

// Helper function to make authenticated Twitter API requests with OAuth 1.0a
async function fetchTwitterDataWithOAuth(endpoint, params = {}, accessToken, accessTokenSecret) {
  try {
    const requestData = {
      url: `${TWITTER_API_BASE}${endpoint}`,
      method: 'GET'
    };

    const token = {
      key: accessToken,
      secret: accessTokenSecret
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await axios.get(requestData.url, {
      headers: {
        ...authHeader,
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
    console.error('Twitter OAuth API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!(req.session.twitterAccessToken && req.session.twitterAccessTokenSecret),
    user: req.session.twitterUser || null
  });
});

// Initiate Twitter OAuth 1.0a login
app.get('/auth/twitter', async (req, res) => {
  if (!TWITTER_API_KEY || !TWITTER_API_KEY_SECRET) {
    return res.status(500).json({ error: 'Twitter OAuth not configured. Please set TWITTER_API_KEY and TWITTER_API_KEY_SECRET in .env' });
  }

  try {
    // Step 1: Get request token
    const requestData = {
      url: `${TWITTER_OAUTH_BASE}/request_token`,
      method: 'POST'
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const response = await axios.post(requestData.url, {}, {
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Parse the response (format: oauth_token=xxx&oauth_token_secret=xxx&oauth_callback_confirmed=true)
    const params = new URLSearchParams(response.data);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Failed to get request token');
    }

    // Store in session
    req.session.oauthToken = oauthToken;
    req.session.oauthTokenSecret = oauthTokenSecret;

    // Step 2: Redirect to Twitter authorization
    const authUrl = `${TWITTER_OAUTH_BASE}/authorize?oauth_token=${oauthToken}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error('Twitter OAuth error:', error.response?.data || error.message);
    res.redirect(`/?error=${encodeURIComponent('Failed to initiate Twitter login')}`);
  }
});

// Twitter OAuth callback
app.get('/auth/twitter/callback', async (req, res) => {
  const { oauth_token, oauth_verifier, denied } = req.query;

  if (denied) {
    return res.redirect('/?error=twitter_authorization_denied');
  }

  if (!oauth_token || !oauth_verifier) {
    return res.redirect('/?error=missing_oauth_parameters');
  }

  // Verify oauth_token matches session
  if (oauth_token !== req.session.oauthToken) {
    return res.redirect('/?error=invalid_oauth_token');
  }

  try {
    // Step 3: Exchange request token for access token
    const requestData = {
      url: `${TWITTER_OAUTH_BASE}/access_token`,
      method: 'POST'
    };

    const token = {
      key: req.session.oauthToken,
      secret: req.session.oauthTokenSecret
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await axios.post(requestData.url, null, {
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      params: {
        oauth_verifier: oauth_verifier
      }
    });

    // Parse response
    const params = new URLSearchParams(response.data);
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('user_id');
    const screenName = params.get('screen_name');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Failed to get access token');
    }

    // Store tokens in session
    req.session.twitterAccessToken = accessToken;
    req.session.twitterAccessTokenSecret = accessTokenSecret;

    // Get user info
    const userData = await fetchTwitterDataWithOAuth(
      '/users/me',
      { 'user.fields': 'name,username,profile_image_url' },
      accessToken,
      accessTokenSecret
    );

    req.session.twitterUser = {
      id: userId || userData.data?.id,
      username: screenName || userData.data?.username,
      name: userData.data?.name,
      profile_image_url: userData.data?.profile_image_url
    };

    // Clear OAuth tokens from session
    delete req.session.oauthToken;
    delete req.session.oauthTokenSecret;

    res.redirect('/');
  } catch (error) {
    console.error('Twitter OAuth callback error:', error.response?.data || error.message);
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

    // Use OAuth if available, otherwise fall back to Bearer Token
    if (req.session.twitterAccessToken && req.session.twitterAccessTokenSecret) {
      const data = await fetchTwitterDataWithOAuth(
        '/tweets/search/recent',
        {
          query: query,
          max_results: Math.min(parseInt(maxResults), 100)
        },
        req.session.twitterAccessToken,
        req.session.twitterAccessTokenSecret
      );
      return formatAndSendTweets(res, data);
    }

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

    formatAndSendTweets(res, data);
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

    const query = interests.map(interest => `"${interest}"`).join(' OR ');
    
    // Use OAuth if available, otherwise fall back to Bearer Token
    if (req.session.twitterAccessToken && req.session.twitterAccessTokenSecret) {
      const data = await fetchTwitterDataWithOAuth(
        '/tweets/search/recent',
        {
          query: query,
          max_results: Math.min(parseInt(maxResults), 100)
        },
        req.session.twitterAccessToken,
        req.session.twitterAccessTokenSecret
      );
      return formatAndSendTweets(res, data);
    }

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

    formatAndSendTweets(res, data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch tweets',
      message: error.response?.data?.detail || error.message 
    });
  }
});

// Get tweets from specific user
app.get('/api/feeds/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { maxResults = 10 } = req.query;

    if (!BEARER_TOKEN) {
      return res.status(500).json({ error: 'Twitter Bearer Token not configured' });
    }

    // First, get user ID from username
    let userResponse;
    try {
      userResponse = await axios.get(`${TWITTER_API_BASE}/users/by/username/${username}`, {
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error fetching user:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({ 
        error: 'Failed to fetch user',
        message: error.response?.data?.detail || error.message 
      });
    }

    if (!userResponse.data?.data?.id) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResponse.data.data.id;

    // Get user's tweets (use OAuth if available, otherwise Bearer Token)
    let data;
    try {
      if (req.session.twitterAccessToken && req.session.twitterAccessTokenSecret) {
        data = await fetchTwitterDataWithOAuth(
          `/users/${userId}/tweets`,
          { max_results: Math.min(parseInt(maxResults), 100) },
          req.session.twitterAccessToken,
          req.session.twitterAccessTokenSecret
        );
      } else {
        // Use Bearer Token for public tweets
        data = await fetchTwitterData(`/users/${userId}/tweets`, {
          max_results: Math.min(parseInt(maxResults), 100)
        });
      }
    } catch (error) {
      console.error('Error fetching tweets:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({ 
        error: 'Failed to fetch user tweets',
        message: error.response?.data?.detail || error.message 
      });
    }

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

// Helper function to format and send tweets
function formatAndSendTweets(res, data) {
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
}

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://xfeed:${PORT} (if xfeed is in /etc/hosts)`);
  if (!TWITTER_API_KEY) {
    console.warn('⚠️  Warning: TWITTER_API_KEY not set. Twitter OAuth login will not work.');
  }
  if (!BEARER_TOKEN) {
    console.warn('⚠️  Warning: TWITTER_BEARER_TOKEN not set. Twitter feeds will not work.');
  }
});
