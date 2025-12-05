// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCbGP_iFbc9Tjrp1tToHkrk62Eza0YowYg",
    authDomain: "vannishield.firebaseapp.com",
    databaseURL: "https://vannishield-default-rtdb.firebaseio.com",
    projectId: "vannishield",
    storageBucket: "vannishield.firebasestorage.app",
    messagingSenderId: "953536986892",
    appId: "1:953536986892:web:b703c631d71c1016e15329",
    measurementId: "G-WNP69ZKQ9J"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// State
let currentUser = null;
let currentChatUser = null;
let users = {};
let messagesUnsubscribe = null;
let currentChatId = null;

// DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const appContainer = document.getElementById('appContainer');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');
const contactsList = document.getElementById('contactsList');
const emptyState = document.getElementById('emptyState');
const activeChat = document.getElementById('activeChat');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const themeToggle = document.getElementById('themeToggle');
const backBtn = document.getElementById('backBtn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkSession();
    setupEventListeners();
});

function initTheme() {
    const savedTheme = localStorage.getItem('vaanishield-theme') || 'dark';
    document.body.className = `${savedTheme}-mode`;
    updateLogo(savedTheme === 'dark');
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    document.body.className = isDark ? 'light-mode' : 'dark-mode';
    localStorage.setItem('vaanishield-theme', isDark ? 'light' : 'dark');
    updateLogo(!isDark);
}

function updateLogo(isDark) {
    const logos = document.querySelectorAll('img[src*="logo-"]');
    logos.forEach(img => {
        img.src = isDark ? 'assets/logo-light.jpeg' : 'assets/logo-dark.jpeg';
    });
}

function checkSession() {
    const savedUser = localStorage.getItem('vaanishield-user');
    if (savedUser) {
        login(JSON.parse(savedUser));
    }
}

function login(userData) {
    currentUser = userData;
    localStorage.setItem('vaanishield-user', JSON.stringify(currentUser));
    
    // Update UI
    loginOverlay.style.opacity = '0';
    setTimeout(() => {
        loginOverlay.style.display = 'none';
        appContainer.classList.remove('blurred-bg');
    }, 300);
    
    currentUserDisplay.textContent = currentUser.name;
    
    // Register user in Firebase
    const userRef = db.ref(`users/${currentUser.id}`);
    userRef.set({
        id: currentUser.id,
        name: currentUser.name,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        online: true
    });

    userRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    listenForUsers();
}

function handleLogin() {
    const name = usernameInput.value.trim();
    if (!name) return;

    const userData = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        avatar: getInitials(name)
    };
    login(userData);
}

function listenForUsers() {
    db.ref('users').on('value', (snapshot) => {
        users = snapshot.val() || {};
        renderUsers();
    });
}

function renderUsers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    contactsList.innerHTML = Object.values(users)
        .filter(u => u.id !== currentUser.id && u.name.toLowerCase().includes(search))
        .map(u => `
            <div class="contact-item ${currentChatUser?.id === u.id ? 'active' : ''}" onclick="openChat('${u.id}')">
                <div class="avatar-wrapper">
                    <span class="contact-avatar">${getInitials(u.name)}</span>
                    <span class="online-indicator ${u.online ? '' : 'offline'}"></span>
                </div>
                <div class="contact-info">
                    <div class="contact-header">
                        <span class="contact-name">${u.name}</span>
                        <span class="contact-time">${u.online ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
            </div>
        `).join('');
}

function getInitials(name) {
    return name.substring(0, 2).toUpperCase();
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

window.openChat = function(userId) {
    const user = users[userId];
    if (!user) return;

    currentChatUser = user;
    currentChatId = getChatId(currentUser.id, user.id);

    // UI Updates
    emptyState.classList.add('hidden');
    activeChat.classList.remove('hidden');
    
    document.getElementById('chatAvatar').textContent = getInitials(user.name);
    document.getElementById('chatUserName').textContent = user.name;
    document.getElementById('userStatus').textContent = user.online ? 'Online' : 'Offline';
    
    document.getElementById('onlineIndicator').className = 
        `online-indicator ${user.online ? '' : 'offline'}`;

    renderUsers();

    if (window.innerWidth <= 900) {
        document.querySelector('.sidebar').classList.add('chat-open');
        document.querySelector('.chat-window').classList.add('chat-open');
    }

    if (messagesUnsubscribe) messagesUnsubscribe();
    
    const messagesRef = db.ref(`chats/${currentChatId}/messages`);
    messagesRef.limitToLast(50).on('value', (snapshot) => {
        const data = snapshot.val();
        renderMessages(data);
    });
    messagesUnsubscribe = () => messagesRef.off();
};

function renderMessages(messagesData) {
    if (!messagesData) {
        messagesArea.innerHTML = '<div class="no-messages">No messages yet. Say hi! 👋</div>';
        return;
    }

    messagesArea.innerHTML = Object.values(messagesData)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(msg => {
            const isSent = msg.sender === currentUser.id;
            
            // --- AI STATUS LOGIC ---
            let statusIcon = '✓';
            let warningText = '';

            if (msg.status === 'pending') {
                statusIcon = '🕒'; // Clock
            } else if (msg.status === 'flagged') {
                statusIcon = '⚠️'; // Warning
                warningText = `<div style="font-size:10px; color:#ff4444; margin-top:5px; font-weight:bold;">${msg.reason || 'Flagged Content'}</div>`;
            } else if (msg.status === 'safe') {
                statusIcon = '✓✓'; // Safe
            }

            // Only show red bubble if flagged, otherwise standard sent/received
            const finalBubbleClass = (msg.status === 'flagged') ? 'message-bubble flagged' : 'message-bubble';

            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="${finalBubbleClass}" style="${msg.status === 'flagged' ? 'border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1);' : ''}">
                        
                        <!-- Added onclick to toggle reveal for flagged messages -->
                        <div class="message-text" 
                             onclick="this.classList.toggle('revealed')" 
                             title="${msg.status === 'flagged' ? 'Click to reveal' : ''}">
                             ${escapeHtml(msg.text)}
                        </div>

                        ${warningText}
                        
                        <div class="message-meta">
                            <span class="message-time">
                                ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            ${isSent ? `<span class="message-status">${statusIcon}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatUser || !currentChatId) return;

    // --- PUSH TO FIREBASE FOR PYTHON WORKER ---
    db.ref(`chats/${currentChatId}/messages`).push({
        text: text,
        sender: currentUser.id,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        type: 'text',
        // CRITICAL FIELDS FOR AI:
        status: 'pending', 
        is_flagged: false
    });

    messageInput.value = '';
    messageInput.focus();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    
    joinBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('searchInput').addEventListener('input', renderUsers);

    backBtn.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.remove('chat-open');
        document.querySelector('.chat-window').classList.remove('chat-open');
        currentChatUser = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
    });
}