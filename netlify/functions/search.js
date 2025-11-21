const axios = require('axios');

// Twitter/X API configuration
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { query, maxResults = 10 } = event.queryStringParameters || {};
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query parameter is required' })
      };
    }

    if (!BEARER_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Twitter Bearer Token not configured' })
      };
    }

    const response = await axios.get(`${TWITTER_API_BASE}/tweets/search/recent`, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        query: query,
        max_results: Math.min(parseInt(maxResults), 100),
        'tweet.fields': 'created_at,author_id,public_metrics,text,entities',
        'user.fields': 'name,username,profile_image_url',
        'expansions': 'author_id'
      }
    });

    const tweets = response.data.data || [];
    const users = response.data.includes?.users || [];
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tweets: formattedTweets })
    };
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch tweets',
        message: error.response?.data?.detail || error.message 
      })
    };
  }
};

