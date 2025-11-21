// State management
let interests = [];
let tweets = [];
let currentTab = 'timeline';
let isAuthenticated = false;
let currentUser = null;

// DOM elements
const interestInput = document.getElementById('interestInput');
const addInterestBtn = document.getElementById('addInterestBtn');
const fetchFeedsBtn = document.getElementById('fetchFeedsBtn');
const interestsContainer = document.getElementById('interestsContainer');
const feedsContainer = document.getElementById('feedsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const emptyStateSubtext = document.getElementById('emptyStateSubtext');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userHandle = document.getElementById('userHandle');
const navTabs = document.getElementById('navTabs');
const searchSection = document.getElementById('searchSection');
const interestSection = document.getElementById('interestSection');
const timelineSection = document.getElementById('timelineSection');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const fetchTimelineBtn = document.getElementById('fetchTimelineBtn');
const tabTimeline = document.getElementById('tabTimeline');
const tabInterests = document.getElementById('tabInterests');
const tabSearch = document.getElementById('tabSearch');

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        isAuthenticated = data.authenticated;
        currentUser = data.user;
        updateUI();
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Update UI based on auth status
function updateUI() {
    if (isAuthenticated && currentUser) {
        loginBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userAvatar.src = currentUser.picture || 'https://via.placeholder.com/40';
        userName.textContent = currentUser.name || 'User';
        userHandle.textContent = currentUser.email || '';
        navTabs.classList.remove('hidden');
        showTab(currentTab);
    } else {
        loginBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
        navTabs.classList.add('hidden');
        searchSection.classList.add('hidden');
        interestSection.classList.add('hidden');
        timelineSection.classList.add('hidden');
        emptyStateText.textContent = 'Welcome to X Feed';
        emptyStateSubtext.textContent = 'Login with Google to get started, or add interests to explore feeds';
    }
}

// Show specific tab
function showTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active', 'bg-gradient-to-r', 'from-purple-600', 'to-pink-600', 'text-white');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('active', 'bg-gradient-to-r', 'from-purple-600', 'to-pink-600', 'text-white');
            btn.classList.add('text-gray-400');
        }
    });

    // Show/hide sections
    searchSection.classList.toggle('hidden', tab !== 'search');
    interestSection.classList.toggle('hidden', tab !== 'interests');
    timelineSection.classList.toggle('hidden', tab !== 'timeline');
}

// Tab event listeners
tabTimeline.addEventListener('click', () => showTab('timeline'));
tabInterests.addEventListener('click', () => showTab('interests'));
tabSearch.addEventListener('click', () => showTab('search'));

// Login
loginBtn.addEventListener('click', () => {
    window.location.href = '/auth/google';
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        isAuthenticated = false;
        currentUser = null;
        tweets = [];
        updateUI();
        renderTweets();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Load saved interests from localStorage
function loadInterests() {
    const saved = localStorage.getItem('xFeedInterests');
    if (saved) {
        interests = JSON.parse(saved);
        renderInterests();
    }
}

// Save interests to localStorage
function saveInterests() {
    localStorage.setItem('xFeedInterests', JSON.stringify(interests));
}

// Add interest
function addInterest() {
    const value = interestInput.value.trim();
    if (value && !interests.includes(value)) {
        interests.push(value);
        interestInput.value = '';
        renderInterests();
        saveInterests();
    }
}

// Remove interest
function removeInterest(interest) {
    interests = interests.filter(i => i !== interest);
    renderInterests();
    saveInterests();
}

// Render interest tags
function renderInterests() {
    interestsContainer.innerHTML = '';
    interests.forEach(interest => {
        const tag = document.createElement('div');
        tag.className = 'inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-full text-white border border-white/20';
        tag.innerHTML = `
            <span>${interest}</span>
            <button onclick="removeInterest('${interest}')" class="hover:text-red-300 transition-colors">
                <i class="fas fa-times"></i>
            </button>
        `;
        interestsContainer.appendChild(tag);
    });
}

// Make removeInterest available globally
window.removeInterest = removeInterest;

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Format tweet text with links and mentions
function formatTweetText(text, entities) {
    if (!entities) return escapeHtml(text);
    
    let formatted = escapeHtml(text);
    
    // Handle URLs
    if (entities.urls) {
        entities.urls.forEach(url => {
            formatted = formatted.replace(
                escapeHtml(url.url),
                `<a href="${url.url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">${url.display_url || url.url}</a>`
            );
        });
    }
    
    // Handle mentions
    if (entities.mentions) {
        entities.mentions.forEach(mention => {
            const regex = new RegExp(`@${escapeHtml(mention.username)}`, 'g');
            formatted = formatted.replace(
                regex,
                `<span class="text-blue-400">@${mention.username}</span>`
            );
        });
    }
    
    // Handle hashtags
    if (entities.hashtags) {
        entities.hashtags.forEach(hashtag => {
            const regex = new RegExp(`#${escapeHtml(hashtag.tag)}`, 'g');
            formatted = formatted.replace(
                regex,
                `<span class="text-purple-400">#${hashtag.tag}</span>`
            );
        });
    }
    
    return formatted;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render tweets
function renderTweets() {
    if (tweets.length === 0) {
        feedsContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    feedsContainer.innerHTML = '';
    
    tweets.forEach(tweet => {
        const card = document.createElement('div');
        card.className = 'bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-200';
        card.innerHTML = `
            <div class="flex items-start space-x-4">
                <img 
                    src="${tweet.author.profile_image_url || 'https://via.placeholder.com/48'}" 
                    alt="${tweet.author.name}"
                    class="w-12 h-12 rounded-full border-2 border-white/20"
                    onerror="this.src='https://via.placeholder.com/48'"
                >
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="font-semibold text-white">${tweet.author.name || 'Unknown'}</span>
                        <span class="text-gray-400">@${tweet.author.username || 'unknown'}</span>
                        <span class="text-gray-500">·</span>
                        <span class="text-gray-400 text-sm">${formatDate(tweet.createdAt)}</span>
                    </div>
                    <p class="text-white mb-4 leading-relaxed">${formatTweetText(tweet.text, tweet.entities)}</p>
                    <div class="flex items-center space-x-6 text-gray-400">
                        <div class="flex items-center space-x-2 hover:text-red-400 transition-colors cursor-pointer">
                            <i class="far fa-heart"></i>
                            <span>${tweet.metrics?.like_count || 0}</span>
                        </div>
                        <div class="flex items-center space-x-2 hover:text-blue-400 transition-colors cursor-pointer">
                            <i class="far fa-comment"></i>
                            <span>${tweet.metrics?.reply_count || 0}</span>
                        </div>
                        <div class="flex items-center space-x-2 hover:text-green-400 transition-colors cursor-pointer">
                            <i class="far fa-retweet"></i>
                            <span>${tweet.metrics?.retweet_count || 0}</span>
                        </div>
                        <a 
                            href="https://twitter.com/${tweet.author.username}/status/${tweet.id}" 
                            target="_blank"
                            class="ml-auto text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        feedsContainer.appendChild(card);
    });
}

// Show error
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

// Fetch @Quanty007's tweets
async function fetchTimeline() {
    loadingIndicator.classList.remove('hidden');
    feedsContainer.innerHTML = '';
    errorMessage.classList.add('hidden');
    
    try {
        const response = await fetch('/api/user/Quanty007?maxResults=20', {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch tweets');
        }
        
        tweets = data.tweets || [];
        renderTweets();
    } catch (error) {
        console.error('Error fetching @Quanty007 tweets:', error);
        showError(error.message || 'Failed to fetch @Quanty007 tweets');
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Search tweets
async function searchTweets() {
    const query = searchInput.value.trim();
    if (!query) {
        showError('Please enter a search query');
        return;
    }
    
    loadingIndicator.classList.remove('hidden');
    feedsContainer.innerHTML = '';
    errorMessage.classList.add('hidden');
    
    try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&maxResults=20`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to search tweets');
        }
        
        tweets = data.tweets || [];
        renderTweets();
    } catch (error) {
        console.error('Error searching tweets:', error);
        showError(error.message || 'Failed to search tweets');
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Fetch feeds by interests
async function fetchFeeds() {
    if (interests.length === 0) {
        showError('Please add at least one interest');
        return;
    }
    
    loadingIndicator.classList.remove('hidden');
    feedsContainer.innerHTML = '';
    errorMessage.classList.add('hidden');
    
    try {
        const response = await fetch('/api/interests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                interests: interests,
                maxResults: 20
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch feeds');
        }
        
        tweets = data.tweets || [];
        renderTweets();
    } catch (error) {
        console.error('Error fetching feeds:', error);
        showError(error.message || 'Failed to fetch feeds');
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Event listeners
addInterestBtn.addEventListener('click', addInterest);
fetchFeedsBtn.addEventListener('click', fetchFeeds);
fetchTimelineBtn.addEventListener('click', fetchTimeline);
searchBtn.addEventListener('click', searchTweets);

interestInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addInterest();
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchTweets();
    }
});

// Check for OAuth callback errors
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('error')) {
    showError('Authentication failed: ' + urlParams.get('error'));
    window.history.replaceState({}, document.title, '/');
}

// Initialize
checkAuth();
loadInterests();
renderTweets();
