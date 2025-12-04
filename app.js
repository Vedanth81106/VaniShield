// ========================================
// VaaniShield - Application JavaScript
// AI-Powered Vernacular Content Moderation
// ========================================

// Sample Data
const contacts = [
    { id: 1, name: "Rahul Sharma", avatar: "👨‍💻", lastMessage: "Hey, how are you?", time: "Now", unread: 2, online: true },
    { id: 2, name: "Priya Patel", avatar: "👩", lastMessage: "See you tomorrow!", time: "5m", unread: 0, online: false },
    { id: 3, name: "Tech Team", avatar: "💻", lastMessage: "Meeting at 3pm", time: "1h", unread: 5, isGroup: true, online: true },
    { id: 4, name: "Family Group", avatar: "👨‍👩‍👧‍👦", lastMessage: "Mom: Dinner at 8", time: "2h", unread: 0, isGroup: true },
    { id: 5, name: "Amit Kumar", avatar: "👦", lastMessage: "Thanks buddy!", time: "Yesterday", unread: 0, online: true }
];

// Chat messages storage
const chatMessages = {
    1: [
        { id: 1, text: "Hey! How's it going?", sent: false, time: "10:30 AM" },
        { id: 2, text: "Hi Rahul! I'm doing great, thanks for asking!", sent: true, time: "10:31 AM", status: "read" },
        { id: 3, text: "That's awesome! Working on any cool projects?", sent: false, time: "10:32 AM" },
        { id: 4, text: "Yes! I'm building a chat app with AI moderation 🚀", sent: true, time: "10:33 AM", status: "read" },
        { id: 5, text: "Hey, how are you?", sent: false, time: "10:35 AM" }
    ],
    2: [
        { id: 1, text: "Hi Priya!", sent: true, time: "Yesterday", status: "read" },
        { id: 2, text: "Hey! Want to catch up tomorrow?", sent: false, time: "Yesterday" },
        { id: 3, text: "Sure! Let's meet at the cafe", sent: true, time: "Yesterday", status: "read" },
        { id: 4, text: "See you tomorrow!", sent: false, time: "Yesterday" }
    ],
    3: [
        { id: 1, text: "Team, we have a meeting at 3pm", sent: false, time: "1h ago", sender: "Manager" },
        { id: 2, text: "Got it! I'll be there", sent: true, time: "1h ago", status: "read" },
        { id: 3, text: "Meeting at 3pm", sent: false, time: "1h ago", sender: "Lead" }
    ],
    4: [
        { id: 1, text: "What time is dinner?", sent: true, time: "2h ago", status: "read" },
        { id: 2, text: "Dinner at 8", sent: false, time: "2h ago", sender: "Mom" }
    ],
    5: [
        { id: 1, text: "Hey Amit! Can you help me with something?", sent: true, time: "Yesterday", status: "read" },
        { id: 2, text: "Sure, what do you need?", sent: false, time: "Yesterday" },
        { id: 3, text: "I need your feedback on my project", sent: true, time: "Yesterday", status: "read" },
        { id: 4, text: "Thanks buddy!", sent: false, time: "Yesterday" }
    ]
};

// Harmful content patterns (vernacular examples)
const harmfulPatterns = [
    // Hindi slurs
    /\b(bevkoof|gadha|kutta|kamina|harami|chutiya|madarch[o0]d|bhench[o0]d)\b/gi,
    // Tamil slurs
    /\b(poda|patti|naai|otha)\b/gi,
    // Telugu slurs
    /\b(dengey|lanja)\b/gi,
    // Common English
    /\b(idiot|stupid|dumb|hate you|kill yourself|die)\b/gi,
    // Threats
    /\b(i will kill|murder|attack|bomb|threat)\b/gi
];

// Auto-reply responses
const autoReplies = [
    "That's interesting! Tell me more.",
    "I see what you mean!",
    "Thanks for sharing that!",
    "That sounds great!",
    "I appreciate you reaching out!",
    "Got it! Let me think about that.",
    "Interesting perspective!",
    "I'll get back to you on that.",
    "Makes sense to me!",
    "Thanks for the update!"
];

// State
let currentChat = null;
let currentFilter = 'all';
let pendingMessage = null;

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

// Render Contacts
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
                    <span class="contact-last-message">${contact.lastMessage}</span>
                    ${contact.unread > 0 ? `<span class="unread-badge">${contact.unread}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    // Add click listeners
    document.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', () => openChat(parseInt(item.dataset.id)));
    });
}

// Open Chat
function openChat(contactId) {
    currentChat = contactId;
    const contact = contacts.find(c => c.id === contactId);
    
    if (!contact) return;

    // Update UI
    emptyState.classList.add('hidden');
    activeChat.classList.remove('hidden');
    
    // Update header
    chatAvatar.textContent = contact.avatar;
    chatUserName.textContent = contact.name;
    userStatus.textContent = contact.online ? 'Online' : 'Last seen recently';
    
    if (!contact.isGroup) {
        onlineIndicator.style.display = 'block';
        onlineIndicator.className = `online-indicator ${contact.online ? '' : 'offline'}`;
    } else {
        onlineIndicator.style.display = 'none';
    }

    // Update typing avatar
    typingAvatar.textContent = contact.avatar;

    // Clear unread
    contact.unread = 0;

    // Render messages
    renderMessages(contactId);

    // Update contacts list
    renderContacts(searchInput.value);

    // Update safety status
    updateSafetyBar();

    // Focus input
    messageInput.focus();

    // Mobile: Add chat-open class
    document.querySelector('.sidebar').classList.add('chat-open');
    document.querySelector('.chat-window').classList.add('chat-open');
}

// Render Messages
function renderMessages(contactId) {
    const messages = chatMessages[contactId] || [];
    
    messagesArea.innerHTML = messages.map(message => `
        <div class="message ${message.sent ? 'sent' : 'received'}">
            <div class="message-bubble ${message.flagged ? 'flagged' : ''}">
                ${message.sender ? `<div class="message-sender">${message.sender}</div>` : ''}
                <div class="message-text">${message.text}</div>
                <div class="message-meta">
                    <span class="message-time">${message.time}</span>
                    ${message.sent ? `
                        <span class="message-status">
                            ${message.status === 'read' ? '✓✓' : '✓'}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Content Moderation
function checkContent(text) {
    for (const pattern of harmfulPatterns) {
        if (pattern.test(text)) {
            return { harmful: true, match: text.match(pattern)?.[0] };
        }
    }
    return { harmful: false };
}

// Update Safety Bar
function updateSafetyBar() {
    const messages = chatMessages[currentChat] || [];
    const hasHarmful = messages.some(m => m.flagged);

    if (hasHarmful) {
        safetyBar.className = 'safety-bar glass-danger';
        safetyBar.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Warning: Potentially harmful content detected in this conversation</span>
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

// Send Message
function sendMessage(text, forcesSend = false) {
    if (!text.trim() || !currentChat) return;

    const moderation = checkContent(text);

    if (moderation.harmful && !forcesSend) {
        // Show modal
        pendingMessage = text;
        detectedContent.textContent = `Detected: "${moderation.match}"`;
        modalOverlay.classList.remove('hidden');
        return;
    }

    const messages = chatMessages[currentChat] || [];
    const newMessage = {
        id: messages.length + 1,
        text: text,
        sent: true,
        time: getCurrentTime(),
        status: 'sent',
        flagged: moderation.harmful
    };

    messages.push(newMessage);
    chatMessages[currentChat] = messages;

    // Update contact's last message
    const contact = contacts.find(c => c.id === currentChat);
    if (contact) {
        contact.lastMessage = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        contact.time = 'Now';
    }

    // Render
    renderMessages(currentChat);
    renderContacts(searchInput.value);
    updateSafetyBar();

    // Clear input
    messageInput.value = '';

    // Trigger auto-reply
    if (!moderation.harmful) {
        simulateReply();
    }
}

// Get Current Time
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Simulate Reply
function simulateReply() {
    // Show typing indicator
    typingIndicator.classList.remove('hidden');
    
    // Random delay between 1-3 seconds
    const delay = 1000 + Math.random() * 2000;

    setTimeout(() => {
        typingIndicator.classList.add('hidden');

        const messages = chatMessages[currentChat] || [];
        const reply = autoReplies[Math.floor(Math.random() * autoReplies.length)];
        
        const newMessage = {
            id: messages.length + 1,
            text: reply,
            sent: false,
            time: getCurrentTime()
        };

        messages.push(newMessage);
        chatMessages[currentChat] = messages;

        // Update contact
        const contact = contacts.find(c => c.id === currentChat);
        if (contact) {
            contact.lastMessage = reply.substring(0, 30) + (reply.length > 30 ? '...' : '');
            contact.time = 'Now';
        }

        // Render
        renderMessages(currentChat);
        renderContacts(searchInput.value);

        // Mark previous message as read
        const lastSentIdx = messages.findIndex(m => m.sent && m.status === 'sent');
        if (lastSentIdx !== -1) {
            messages[lastSentIdx].status = 'read';
        }
    }, delay);
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Send message
    sendBtn.addEventListener('click', () => sendMessage(messageInput.value));
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
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

    // Modal actions
    modalCancel.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        pendingMessage = null;
    });

    modalSend.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        if (pendingMessage) {
            sendMessage(pendingMessage, true);
            pendingMessage = null;
        }
    });

    // Close modal on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.add('hidden');
            pendingMessage = null;
        }
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            modalOverlay.classList.add('hidden');
            pendingMessage = null;
        }
    });
}
