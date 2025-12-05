# Load model directly
from transformers import AutoModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tokenizer = AutoTokenizer.from_pretrained("Hate-speech-CNERG/indic-abusive-allInOne-MuRIL")
model = AutoModelForSequenceClassification.from_pretrained("Hate-speech-CNERG/indic-abusive-allInOne-MuRIL")

def predict(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=1)
    label_id = torch.argmax(probs).item()
    confidence = probs[0][label_id].item()
    return label_id, confidence

label_map = {
    0: "Not Hate Speech",
    1: "Hate Speech"
}

text = "Your example text goes here."
# label, score = predict(text)
# print(label_map[label], score)

def get_toxic_words(text):
    # This is a placeholder function. Implement your logic to extract toxic words.
    mask_var = " "
    text_tokens = text.split()
    label, first_score = predict(text)
    print(f"Original Text Score: {first_score}, Label: {label_map[label]}")
    removed_words = []
    for i in range(len(text_tokens)):
        text_tokens = text.split()
        # text_tokens[i] = 
        word = "".join(text_tokens[i])
        label, score = predict(word)
        drop = score - first_score
        if label == 1:
            removed_words.append(word)
        print(f"Word: {word}, Score Drop: {drop}, Label: {label_map[label]}, Score: {score}")
    for i in removed_words:
        text = text.replace(i, "")
    return text

print(get_toxic_words(text))