import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate(r"c:\Users\k suhas\Downloads\firebase-adminsdk.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def process_data(input_data):
    
    # Change specific fields like this:
    input_data['name'] = 'New Name Here'
    input_data['status'] = 'updated'
    input_data['unread'] = 0
    input_data['lastMessage'] = 'Message has been updated!'.upper()
    input_data['online'] = False
    
    return input_data

def read_from_firestore(collection, doc_id):
    doc_ref = db.collection(collection).document(doc_id)
    doc = doc_ref.get()
    
    if doc.exists:
        data = doc.to_dict()
        print(f"📥 Read from '{collection}/{doc_id}': {data}")
        return data
    else:
        print(f"❌ Document '{collection}/{doc_id}' not found!")
        return None

def read_all_from_collection(collection):
    docs = db.collection(collection).stream()
    all_data = {}
    for doc in docs:
        all_data[doc.id] = doc.to_dict()
    print(f"📥 Read {len(all_data)} documents from '{collection}'")
    return all_data

def write_to_firestore(collection, doc_id, data):
    doc_ref = db.collection(collection).document(doc_id)
    doc_ref.set(data)
    print(f"📤 Written to '{collection}/{doc_id}': {data}")

def update_firestore(collection, doc_id, data):
    doc_ref = db.collection(collection).document(doc_id)
    doc_ref.update(data)
    print(f"🔄 Updated '{collection}/{doc_id}': {data}")

def read_process_write(collection, doc_id, output_collection=None):
    if output_collection is None:
        output_collection = collection
    
    input_data = read_from_firestore(collection, doc_id)
    
    if input_data is None:
        print("⚠️ No data found!")
        return None
    
    output_data = process_data(input_data)
    print(f"⚙️ Processed: {input_data} → {output_data}")
    
    write_to_firestore(output_collection, doc_id, output_data)
    
    return output_data

def list_collections():
    collections = db.collections()
    print("\n" + "="*50)
    print("📂 COLLECTIONS IN YOUR FIRESTORE:")
    print("="*50)
    for collection in collections:
        print(f"   → {collection.id}")
    print("="*50 + "\n")

def explore_collection(collection_name):
    docs = db.collection(collection_name).stream()
    
    print(f"\n{'='*50}")
    print(f"📂 DOCUMENTS IN '{collection_name}':")
    print('='*50)
    
    count = 0
    for doc in docs:
        count += 1
        print(f"\n📄 Document ID: {doc.id}")
        print(f"   Data: {doc.to_dict()}")
    
    if count == 0:
        print("❌ No documents found in this collection!")
    else:
        print(f"\n✅ Found {count} document(s)")
    
    print('='*50 + '\n')

if __name__ == "__main__":
    print("🔍 Exploring your Firestore database...\n")
    list_collections()
    explore_collection('contacts')
    read_process_write('contacts', '1', 'processed')