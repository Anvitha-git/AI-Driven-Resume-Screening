# Model Accuracy Testing Guide

This project includes comprehensive testing scripts to validate the accuracy of all AI/ML models used in the resume screening system.

## 📋 Available Tests

### 1. Resume Screening Model Test
**File:** `backend/scripts/test_resume_model_accuracy.py`

Tests the core resume screening model including:
- ✅ Semantic similarity accuracy (Sentence-BERT)
- ✅ Skill extraction accuracy (fuzzy matching)
- ✅ Inference speed (performance benchmarks)

**Run:**
```bash
cd backend
python scripts/test_resume_model_accuracy.py
```

**Expected Output:**
- Semantic Similarity Accuracy: ~90%+
- Skill Extraction F1 Score: ~70%+
- Inference Speed: <2s per resume

---

### 2. Comprehensive Model Test
**File:** `backend/scripts/test_all_models_accuracy.py`

Tests ALL models in the project:
- ✅ Resume screening model (Sentence-BERT)
- ✅ Chatbot NLU model (Rasa DIET)
- ✅ OCR model (Tesseract)
- ✅ Fuzzy matching accuracy

**Run:**
```bash
cd backend
python scripts/test_all_models_accuracy.py
```

**Duration:** 5-10 minutes (includes Rasa cross-validation)

---

## 🔧 Setup Requirements

### 1. Install Python Dependencies
```bash
pip install -r backend/requirements.txt
pip install scikit-learn  # For accuracy metrics
```

### 2. Install Rasa (for chatbot tests)
```bash
pip install rasa==3.6.21
```

### 3. Install Tesseract (for OCR tests)
- **Windows:** Download from https://github.com/tesseract-ocr/tesseract
- **Mac:** `brew install tesseract`
- **Linux:** `sudo apt-get install tesseract-ocr`

---

## 📊 Test Metrics Explained

### Semantic Similarity Test
- **Accuracy:** % of correctly classified resume-JD matches (HIGH/MEDIUM/LOW)
- **Precision:** % of predicted matches that are correct
- **Recall:** % of actual matches found
- **F1 Score:** Harmonic mean of precision and recall

### Skill Extraction Test
- **Precision:** % of extracted skills that are correct
- **Recall:** % of required skills that were found
- **F1 Score:** Balance between precision and recall

### Inference Speed Test
- **Single Resume:** Time to process 1 resume (target: <2s)
- **Batch Processing:** Time to process 50 resumes (target: <3s)

### Chatbot NLU Test
- **Intent Classification Accuracy:** % of correctly predicted intents
- **Entity Recognition F1:** Accuracy of extracting entities
- **Cross-Validation Score:** Average across multiple folds

---

## 🎯 Interpreting Results

### ✅ EXCELLENT
- Semantic Accuracy: **≥80%**
- Skill F1 Score: **≥70%**
- Inference Speed: **<2s**

### ⚠️ GOOD (Needs Improvement)
- Semantic Accuracy: **60-80%**
- Skill F1 Score: **50-70%**
- Inference Speed: **2-5s**

### ❌ NEEDS ATTENTION
- Semantic Accuracy: **<60%**
- Skill F1 Score: **<50%**
- Inference Speed: **>5s**

---

## 🐛 Troubleshooting

### Issue: "Model not found"
**Solution:**
```bash
# Download Sentence-BERT model
python backend/scripts/preload_model.py

# Train Rasa model
cd chatbot
rasa train
```

### Issue: "Rasa not installed"
**Solution:**
```bash
pip install rasa==3.6.21
```

### Issue: "Tesseract not found"
**Solution:**
- Install Tesseract OCR from official website
- Add to PATH: `C:\Program Files\Tesseract-OCR`

### Issue: "Out of memory"
**Solution:**
```bash
# Use lighter model
export EMBEDDING_MODEL=all-MiniLM-L6-v2
python scripts/test_resume_model_accuracy.py
```

---

## 📈 Improving Model Accuracy

### 1. Semantic Similarity
- Use larger model: `all-mpnet-base-v2` (higher accuracy, slower)
- Fine-tune on domain-specific data
- Increase embedding dimensions

### 2. Skill Extraction
- Add more skills to `SKILL_KEYWORDS` dictionary
- Lower fuzzy matching threshold (85% → 80%)
- Use NER model for skill extraction

### 3. Chatbot NLU
- Add more training examples (current: ~102)
- Increase epochs (current: 100)
- Use larger DIET model

### 4. Inference Speed
- Use GPU acceleration
- Switch to `all-MiniLM-L6-v2` (faster, slightly lower accuracy)
- Batch process resumes

---

## 📝 Output Files

### Test Results
- **Location:** `backend/scripts/model_accuracy_results.json`
- **Contains:** JSON report of all test metrics

### Chatbot Test Results
- **Location:** `chatbot/results/`
- **Contains:** Confusion matrix, intent/entity reports

---

## 🔄 CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test-models.yml
name: Model Accuracy Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      - name: Test models
        run: python backend/scripts/test_resume_model_accuracy.py
```

---

## 📞 Support

If tests fail repeatedly:
1. Check [docs/BACKEND_DOCUMENTATION.md](docs/BACKEND_DOCUMENTATION.md)
2. Verify all dependencies are installed
3. Check model files exist in `~/.cache/torch/sentence_transformers/`
4. Review logs in `model_accuracy_results.json`

---

## 🎓 Learn More

- [Sentence-BERT Documentation](https://www.sbert.net/)
- [Rasa Testing Guide](https://rasa.com/docs/rasa/testing-your-assistant)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
- [rapidfuzz Documentation](https://github.com/maxbachmann/RapidFuzz)

---

**Last Updated:** January 8, 2026
