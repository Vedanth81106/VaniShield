// Firebase & State Setup
const contacts = [
    { id: 1, name: "Rahul Sharma", avatar: "👨‍💻", lastMessage: "", time: "Now", unread: 2, online: true },
    { id: 2, name: "Priya Patel", avatar: "👩", lastMessage: "", time: "5m", unread: 0, online: false },
    { id: 3, name: "Tech Team", avatar: "💻", lastMessage: "", time: "1h", unread: 5, isGroup: true, online: true },
    { id: 4, name: "Family Group", avatar: "👨‍👩‍👧‍👦", lastMessage: "", time: "2h", unread: 0, isGroup: true },
    { id: 5, name: "Amit Kumar", avatar: "👦", lastMessage: "", time: "Yesterday", unread: 0, online: true }
];

const firebaseConfig = {
    apiKey: "AIzaSyCbGP_iFbc9Tjrp1tToHkrk62Eza0YowYg",
    authDomain: "http://vannishield.firebaseapp.com",
    databaseURL: "https://vannishield-default-rtdb.firebaseio.com/",
    projectId: "vannishield",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let chatMessages = {};
let currentChat = null;
let currentFilter = 'all';
let activeListener = null;
const CURRENT_USER_ID = "user_1";

const themeToggle = document.getElementById('themeToggle');
const contactsList = document.getElementById('contactsList');
const emptyState = document.getElementById('emptyState');
const activeChat = document.getElementById('activeChat');
const chatAvatar = document.getElementById('chatAvatar');
const chatUserName = document.getElementById('chatUserName');
const userStatus = document.getElementById('userStatus');
const onlineIndicator = document.getElementById('onlineIndicator');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingAvatar = document.getElementById('typingAvatar');
const safetyBar = document.getElementById('safetyBar');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderContacts();
    setupEventListeners();
});

function initTheme() {
    const savedTheme = localStorage.getItem('vaanishield-theme') || 'dark';
    document.body.className = `${savedTheme}-mode`;
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    document.body.className = isDark ? 'light-mode' : 'dark-mode';
    localStorage.setItem('vaanishield-theme', isDark ? 'light' : 'dark');
}

function renderContacts(searchQuery = '') {
    const filteredContacts = contacts.filter(contact => {
        const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (currentFilter === 'all') return matchesSearch;
        if (currentFilter === 'unread') return matchesSearch && contact.unread > 0;
        if (currentFilter === 'groups') return matchesSearch && contact.isGroup;
        return matchesSearch;
    });

    contactsList.innerHTML = filteredContacts.map(contact => `
        <div class="contact-item ${currentChat === contact.id ? 'active' : ''}" data-id="${contact.id}">
            <div class="avatar-wrapper">
                <span class="contact-avatar">${contact.avatar}</span>
                ${!contact.isGroup ? `<span class="online-indicator ${contact.online ? '' : 'offline'}"></span>` : ''}
            </div>
            <div class="contact-info">
                <div class="contact-header">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-time">${contact.time}</span>
                </div>
                <div class="contact-footer">
                    <span class="contact-last-message">${contact.lastMessage || 'Start conversation'}</span>
                    ${contact.unread > 0 ? `<span class="unread-badge">${contact.unread}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', () => openChat(parseInt(item.dataset.id)));
    });
}

function openChat(contactId) {
    currentChat = contactId;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    emptyState.classList.add('hidden');
    activeChat.classList.remove('hidden');

    chatAvatar.textContent = contact.avatar;
    chatUserName.textContent = contact.name;
    userStatus.textContent = contact.online ? 'Online' : 'Last seen recently';
    onlineIndicator.style.display = contact.isGroup ? 'none' : 'block';
    onlineIndicator.className = `online-indicator ${contact.online ? '' : 'offline'}`;

    typingAvatar.textContent = contact.avatar;
    contact.unread = 0;

    if (activeListener) activeListener.off();
    setupRealtimeListener(contactId);

    renderContacts(searchInput.value);
    messageInput.focus();
    document.querySelector('.sidebar').classList.add('chat-open');
    document.querySelector('.chat-window').classList.add('chat-open');
}

function setupRealtimeListener(chatId) {
    const chatRef = db.ref(`chats/${chatId}/messages`);
    activeListener = chatRef;

    chatRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            chatMessages[chatId] = [];
            renderMessages(chatId);
            return;
        }

        const messages = Object.keys(data).map(key => ({
            ...data[key],
            firebaseKey: key
        })).sort((a, b) => a.timestamp - b.timestamp);

        chatMessages[chatId] = messages;
        renderMessages(chatId);
        updateSafetyBar();

        const contact = contacts.find(c => c.id === chatId);
        if (contact && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            contact.lastMessage = lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? '...' : '');
            contact.time = 'Now';
            renderContacts(searchInput.value);
        }
    });
}

function renderMessages(contactId) {
    const messages = chatMessages[contactId] || [];

    messagesArea.innerHTML = messages.map(message => {
        const isSent = message.sender === CURRENT_USER_ID;
        let bubbleClass = '';
        if (message.status === 'flagged') bubbleClass = 'flagged';

        let statusIcon = '✓';
        if (message.status === 'pending') statusIcon = '🕒';
        if (message.status === 'flagged') statusIcon = '⚠️';
        if (message.status === 'forced' || message.status === 'approved') statusIcon = '✓✓';

        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-bubble ${bubbleClass}">
                    <div class="message-text ${message.status === 'flagged' ? 'blurred' : ''}">
                        ${message.text}
                    </div>
                    <div class="message-meta">
                        <span class="message-time">${formatTimestamp(message.timestamp)}</span>
                        ${isSent ? `<span class="message-status">${statusIcon}</span>` : ''}
                    </div>
                    ${message.status === 'flagged' ? `<div class="flagged-overlay">⚠️ Flagged Content Hidden</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return date.toLocaleDateString();
}

function updateSafetyBar() {
    const messages = chatMessages[currentChat] || [];
    const hasHarmful = messages.some(m => m.status === 'flagged');

    if (hasHarmful) {
        safetyBar.className = 'safety-bar glass-danger';
        safetyBar.innerHTML = `
            <span>⚠️ Warning: Harmful content detected</span>
        `;
    } else {
        safetyBar.className = 'safety-bar glass-safe';
        safetyBar.innerHTML = `
            <span>✔️ Conversation is safe</span>
        `;
    }
}

function sendMessage(text) {
    if (!text.trim() || !currentChat) return;
    const trimmedText = text.trim();
    const newMessageRef = db.ref(`chats/${currentChat}/messages`).push();

    newMessageRef.set({
        id: newMessageRef.key,
        text: trimmedText,
        sender: CURRENT_USER_ID,
        timestamp: Date.now(),
        status: "pending",
        is_flagged: false
    })
    .then(() => {
        messageInput.value = '';
        messageInput.focus(); // Fix input blocking issue
    })
    .catch((error) => {
        console.error('Error sending message:', error);
        alert('Failed to send message.');
    });
}

function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    sendBtn.addEventListener('click', () => sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    searchInput.addEventListener('input', (e) => {
        renderContacts(e.target.value);
    });

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderContacts(searchInput.value);
        });
    });
}

// Add dynamic styles for blurred messages
const style = document.createElement('style');
style.textContent = `
    .blurred {
        filter: blur(6px);
        user-select: none;
        pointer-events: none;
    }
    .flagged-overlay {
        font-size: 11px;
        color: var(--danger);
        margin-top: 4px;
        font-weight: 600;
        opacity: 0.8;
    }
`;
document.head.appendChild(style);
