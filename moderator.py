import sys
import os
import time
from pathlib import Path

print("="*60)
print("🛡️  VaaniShield - AI Content Moderator")
print("="*60)

# STEP 1: Import Firebase
print("\n[1/3] Importing Firebase Admin SDK...")
try:
    import firebase_admin
    from firebase_admin import credentials, db
    print("    ✅ Firebase imported successfully")
except ImportError:
    print("    ❌ ERROR: Firebase Admin SDK not installed")
    print("    Run: pip install firebase-admin")
    sys.exit(1)

# STEP 2: Import AI Model
print("\n[2/3] Loading AI model from ai_models/AI.py...")
print("    ⏳ This may take 30-60 seconds on first run...")

ai_models_path = Path(__file__).parent / "ai_models"
sys.path.insert(0, str(ai_models_path))

try:
    if not (ai_models_path / "AI.py").exists():
        print(f"    ❌ ERROR: AI.py not found in {ai_models_path}")
        sys.exit(1)
    from AI import predict, get_toxic_words, label_map
    print("    ✅ AI model loaded successfully")
except Exception as e:
    print(f"    ❌ ERROR loading AI model: {e}")
    sys.exit(1)

# STEP 3: Initialize Firebase
FIREBASE_CRED_PATH = "D:/Git Repos/VaniShield/serviceAccountKey.json"
FIREBASE_DB_URL = "https://vannishield-default-rtdb.firebaseio.com/"

print("\n[3/3] Connecting to Firebase...")
if not os.path.exists(FIREBASE_CRED_PATH):
    print(f"    ❌ ERROR: {FIREBASE_CRED_PATH} not found")
    sys.exit(1)

try:
    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred, {
        'databaseURL': FIREBASE_DB_URL
    })
    print("    ✅ Connected to Firebase")
except Exception as e:
    print(f"    ❌ Firebase initialization failed: {e}")
    sys.exit(1)

print("\n" + "="*60)
print("🚀 VaaniShield is now monitoring messages...")
print("="*60 + "\n")

# AI ANALYSIS WRAPPER
def analyze_message(text):
    if not text or not text.strip():
        return {
            'is_toxic': False,
            'reason': 'Empty message',
            'confidence': 0,
            'toxic_words': []
        }
    try:
        label_id, confidence = predict(text)
        is_toxic = (label_id == 1)
        toxic_words = []
        if is_toxic:
            words = text.split()
            for word in words:
                if len(word.strip()) > 1:
                    word_label, word_score = predict(word)
                    if word_label == 1 and word_score > 0.6:
                        toxic_words.append(word)
        reason = (
            f"Hate speech detected. Flagged words: {', '.join(toxic_words[:3])}"
            if is_toxic and toxic_words
            else "Hate speech detected in message context" if is_toxic
            else "Content is safe"
        )
        return {
            'is_toxic': is_toxic,
            'reason': reason,
            'confidence': round(confidence * 100, 2),
            'toxic_words': toxic_words
        }
    except Exception as e:
        print(f"    ❌ AI analysis error: {e}")
        return {
            'is_toxic': False,
            'reason': f'Analysis error: {str(e)}',
            'confidence': 0,
            'toxic_words': []
        }

# MESSAGE PROCESSING
processed_messages = set()

def process_message(chat_id, msg_id, msg_data):
    message_key = f"{chat_id}_{msg_id}"
    if message_key in processed_messages:
        return
    status = msg_data.get('status')
    text = msg_data.get('text')
    sender = msg_data.get('sender')
    if status != 'pending' or not text:
        return
    if msg_data.get('force_send'):
        print(f"📤 [{chat_id}:{msg_id[:8]}] User force-sent, skipping moderation")
        processed_messages.add(message_key)
        return
    print(f"\n🔍 [{chat_id}:{msg_id[:8]}] Analyzing message from {sender}...")
    print(f"    📝 Text: \"{text[:50]}{'...' if len(text) > 50 else ''}\"")
    try:
        result = analyze_message(text)
        msg_ref = db.reference(f'chats/{chat_id}/messages/{msg_id}')
        if result['is_toxic']:
            print(f"    🔴 FLAGGED: {result['reason']}")
            print(f"    📊 Confidence: {result['confidence']:.1f}%")
            if result['toxic_words']:
                print(f"    🚫 Toxic words: {', '.join(result['toxic_words'])}")
            msg_ref.update({
                'status': 'flagged',
                'is_flagged': True,
                'reason': result['reason'],
                'confidence': result['confidence'],
                'toxic_words': result['toxic_words'],
                'modal_shown': False
            })
        else:
            print(f"    🟢 SAFE: {result['reason']}")
            print(f"    📊 Confidence: {result['confidence']:.1f}%")
            msg_ref.update({
                'status': 'approved',
                'is_flagged': False
            })
        processed_messages.add(message_key)
    except Exception as e:
        print(f"    ❌ Error processing message: {e}")

# FIXED MESSAGE SCANNER
def scan_all_pending_messages():
    print("🔎 Scanning for existing pending messages...")
    try:
        chats_ref = db.reference('chats')
        all_chats = chats_ref.get()
        if not all_chats:
            print("📭 No chats found")
            return
        pending_count = 0
        if isinstance(all_chats, list):
            for i, chat_data in enumerate(all_chats):
                if not chat_data or 'messages' not in chat_data:
                    continue
                for msg_id, msg_data in chat_data['messages'].items():
                    if isinstance(msg_data, dict) and msg_data.get('status') == 'pending':
                        process_message(str(i), msg_id, msg_data)
                        pending_count += 1
        else:
            for chat_id, chat_data in all_chats.items():
                if not chat_data or 'messages' not in chat_data:
                    continue
                for msg_id, msg_data in chat_data['messages'].items():
                    if isinstance(msg_data, dict) and msg_data.get('status') == 'pending':
                        process_message(chat_id, msg_id, msg_data)
                        pending_count += 1
        if pending_count == 0:
            print("    ✅ No pending messages found")
        else:
            print(f"    ✅ Processed {pending_count} pending message(s)")
    except Exception as e:
        print(f"    ❌ Error scanning messages: {e}")

# REALTIME LISTENER
def message_listener(event):
    try:
        print(f"📥 Firebase Event Triggered: {event.path} | {event.data}")
        path = event.path.strip('/')
        path_parts = path.split('/')
        if len(path_parts) >= 4 and path_parts[0] == 'chats' and path_parts[2] == 'messages':
            chat_id = path_parts[1]
            msg_id = path_parts[3]
            if event.data and isinstance(event.data, dict):
                process_message(chat_id, msg_id, event.data)
    except Exception as e:
        print(f"❌ Listener error: {e}")

# MAIN LOOP
def main():
    scan_all_pending_messages()
    print("\n" + "-"*60)
    print("👂 Now listening for new messages in real-time...")
    print("   Press Ctrl+C to stop")
    print("-"*60 + "\n")
    def poll_for_messages():
        while True:
            scan_all_pending_messages()
            time.sleep(2)
    try:
        poll_for_messages()
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("👋 VaaniShield moderator stopped")
        print("="*60)
        sys.exit(0)

if __name__ == "__main__":
    main()
