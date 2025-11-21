const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Twitter/X API configuration
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Helper function to make Twitter API requests
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

// Search tweets
app.get('/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

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

// Get feeds based on interests
app.post('/interests', async (req, res) => {
  try {
    const { interests, maxResults = 10 } = req.body;
    
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: 'Interests array is required' });
    }

    const query = interests.map(interest => `"${interest}"`).join(' OR ');
    
    const data = await fetchTwitterData('/tweets/search/recent', {
      query: query,
      max_results: Math.min(parseInt(maxResults), 100)
    });

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

// Get tweets from specific user
app.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { maxResults = 10 } = req.query;

    // Get user ID from username
    const userResponse = await axios.get(`${TWITTER_API_BASE}/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const userId = userResponse.data.data.id;

    // Get user's tweets
    const data = await fetchTwitterData(`/users/${userId}/tweets`, {
      max_results: Math.min(parseInt(maxResults), 100)
    });

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

module.exports.handler = serverless(app);

