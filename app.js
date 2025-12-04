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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// State Management
let chatMessages = {}; 
let currentChat = null;
let currentFilter = 'all';
let pendingMessageKey = null; // Store Firebase key of flagged message
let activeListener = null;
const CURRENT_USER_ID = "user_1"; // Hardcoded for demo - replace with actual auth

// DOM Elements
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
const typingIndicator = document.getElementById('typingIndicator');
const typingAvatar = document.getElementById('typingAvatar');
const safetyBar = document.getElementById('safetyBar');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const detectedContent = document.getElementById('detectedContent');
const modalCancel = document.getElementById('modalCancel');
const modalSend = document.getElementById('modalSend');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderContacts();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('vaanishield-theme') || 'dark';
    document.body.className = `${savedTheme}-mode`;
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    document.body.className = isDark ? 'light-mode' : 'dark-mode';
    localStorage.setItem('vaanishield-theme', isDark ? 'light' : 'dark');
}

// Render Contacts List
function renderContacts(searchQuery = '') {
    let filteredContacts = contacts.filter(contact => {
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

// Open Chat Window
function openChat(contactId) {
    currentChat = contactId;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Update UI
    emptyState.classList.add('hidden');
    activeChat.classList.remove('hidden');
    
    chatAvatar.textContent = contact.avatar;
    chatUserName.textContent = contact.name;
    userStatus.textContent = contact.online ? 'Online' : 'Last seen recently';
    
    if (!contact.isGroup) {
        onlineIndicator.style.display = 'block';
        onlineIndicator.className = `online-indicator ${contact.online ? '' : 'offline'}`;
    } else {
        onlineIndicator.style.display = 'none';
    }

    typingAvatar.textContent = contact.avatar;
    contact.unread = 0;

    // Remove old listener if exists
    if (activeListener) {
        activeListener.off();
    }

    setupRealtimeListener(contactId);

    renderContacts(searchInput.value);
    messageInput.focus();

    // Mobile responsive
    document.querySelector('.sidebar').classList.add('chat-open');
    document.querySelector('.chat-window').classList.add('chat-open');
}

// REALTIME LISTENER - Listens to Firebase changes
function setupRealtimeListener(chatId) {
    const chatRef = db.ref(`chats/${chatId}/messages`);
    
    activeListener = chatRef;
    
    // Listen for any changes in messages
    chatRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
            chatMessages[chatId] = [];
            renderMessages(chatId);
            return;
        }

        // Convert Firebase object to array with keys
        const messages = Object.keys(data).map(key => ({
            ...data[key],
            firebaseKey: key // Store the Firebase key for later updates
        }));

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        chatMessages[chatId] = messages;
        renderMessages(chatId);
        updateSafetyBar();
        
        // Update contact list preview
        const contact = contacts.find(c => c.id === chatId);
        if (contact && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            contact.lastMessage = lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? '...' : '');
            contact.time = 'Now';
            renderContacts(searchInput.value);
        }

        // Check if any message was just flagged by Django
        checkForNewlyFlaggedMessages(messages);
    });
}

// Check if Django just flagged a message
function checkForNewlyFlaggedMessages(messages) {
    messages.forEach(msg => {
        // If message is from current user, status changed to flagged, and modal not already shown
        if (msg.sender === CURRENT_USER_ID && 
            msg.status === 'flagged' && 
            !msg.modal_shown) {
            
            // Mark that we've shown the modal for this message
            db.ref(`chats/${currentChat}/messages/${msg.firebaseKey}`).update({
                modal_shown: true
            });

            // Show warning modal
            showFlaggedModal(msg);
        }
    });
}

// Show Modal for Flagged Message
function showFlaggedModal(message) {
    pendingMessageKey = message.firebaseKey;
    
    modalMessage.textContent = "⚠️ AI detected potentially harmful content";
    detectedContent.textContent = message.reason 
        ? `${message.reason}`
        : 'Potentially harmful language detected';
    
    modalOverlay.classList.remove('hidden');
}

// Render Messages
function renderMessages(contactId) {
    const messages = chatMessages[contactId] || [];
    
    messagesArea.innerHTML = messages.map(message => {
        let statusIcon = '✓'; 
        let bubbleClass = '';
        
        // Determine status icon
        if (message.status === 'pending') {
            statusIcon = '🕒'; // Waiting for moderation
        } else if (message.status === 'flagged') {
            statusIcon = '⚠️'; // Flagged by AI
            bubbleClass = 'flagged';
        } else if (message.status === 'approved' || message.status === 'forced') {
            statusIcon = '✓✓'; // Approved or force-sent
        }

        const isSent = message.sender === CURRENT_USER_ID;

        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-bubble ${bubbleClass}">
                    <div class="message-text">${message.text}</div>
                    <div class="message-meta">
                        <span class="message-time">${formatTimestamp(message.timestamp)}</span>
                        ${isSent ? `<span class="message-status">${statusIcon}</span>` : ''}
                    </div>
                    ${message.status === 'flagged' && message.reason ? 
                        `<div class="warning-label">${message.reason}</div>` 
                        : ''}
                </div>
            </div>
        `;
    }).join('');

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Format Timestamp
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

// Update Safety Bar
function updateSafetyBar() {
    const messages = chatMessages[currentChat] || [];
    const hasHarmful = messages.some(m => m.status === 'flagged');

    if (hasHarmful) {
        safetyBar.className = 'safety-bar glass-danger';
        safetyBar.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Warning: Potentially harmful content detected</span>
        `;
    } else {
        safetyBar.className = 'safety-bar glass-safe';
        safetyBar.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <span>Conversation is safe - No harmful content detected</span>
        `;
    }
}

// Send Message to Firebase
function sendMessage(text) {
    if (!text.trim() || !currentChat) return;

    const trimmedText = text.trim();

    // Create new message in Firebase
    const newMessageRef = db.ref(`chats/${currentChat}/messages`).push();
    
    newMessageRef.set({
        id: newMessageRef.key,           // Firebase auto-generated key
        text: trimmedText,
        sender: CURRENT_USER_ID,
        timestamp: Date.now(),
        status: "pending",               // Django watches for "pending" status
        is_flagged: false
    })
    .then(() => {
        console.log('Message sent to Firebase');
        messageInput.value = '';
    })
    .catch((error) => {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    });
}

// Force Send (User approves flagged message)
function forceSendMessage() {
    if (!pendingMessageKey || !currentChat) return;

    // Update the message status to "forced" (approved by user)
    db.ref(`chats/${currentChat}/messages/${pendingMessageKey}`).update({
        status: 'forced',
        force_send: true,
        approved_at: Date.now()
    })
    .then(() => {
        console.log('Message approved by user');
        modalOverlay.classList.add('hidden');
        pendingMessageKey = null;
    })
    .catch((error) => {
        console.error('Error approving message:', error);
    });
}

// Delete Flagged Message
function deleteMessage() {
    if (!pendingMessageKey || !currentChat) return;

    // Delete the message from Firebase
    db.ref(`chats/${currentChat}/messages/${pendingMessageKey}`).remove()
    .then(() => {
        console.log('Message deleted');
        modalOverlay.classList.add('hidden');
        pendingMessageKey = null;
    })
    .catch((error) => {
        console.error('Error deleting message:', error);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Send message
    sendBtn.addEventListener('click', () => {
        sendMessage(messageInput.value);
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        renderContacts(e.target.value);
    });

    // Filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderContacts(searchInput.value);
        });
    });

    // Modal - Cancel (Delete message)
    modalCancel.addEventListener('click', () => {
        deleteMessage();
    });

    // Modal - Send Anyway (Force send)
    modalSend.addEventListener('click', () => {
        forceSendMessage();
    });

    // Close modal on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            deleteMessage();
        }
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            deleteMessage();
        }
    });
}

// Add dynamic styles
const style = document.createElement('style');
style.textContent = `
    .warning-label {
        font-size: 11px;
        color: var(--danger);
        margin-top: 4px;
        font-weight: 500;
    }
    
    .message-sender {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 4px;
        opacity: 0.8;
    }
`;
document.head.appendChild(style);