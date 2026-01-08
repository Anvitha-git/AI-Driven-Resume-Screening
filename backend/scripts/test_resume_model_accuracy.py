"""
Script to test the accuracy of the resume screening model.
Tests semantic similarity, skill matching, and ranking accuracy.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sentence_transformers import SentenceTransformer
from rapidfuzz import fuzz
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import time

# Test data: (resume_text, job_description, expected_match_quality, expected_skills)
TEST_CASES = [
    {
        "resume": "Experienced Python developer with 5 years in machine learning. Skills: Python, TensorFlow, PyTorch, AWS, Docker. Built ML models for production.",
        "job_desc": "Looking for ML Engineer with Python, TensorFlow, and cloud experience",
        "expected_quality": "HIGH",  # Should be high match
        "expected_skills": ["Python", "TensorFlow", "PyTorch", "AWS", "Docker", "Machine Learning"],
        "expected_score_range": (0.7, 1.0)
    },
    {
        "resume": "Front-end developer with React and JavaScript. 2 years experience building user interfaces. Skills: React, JavaScript, HTML, CSS.",
        "job_desc": "Looking for ML Engineer with Python, TensorFlow, and cloud experience",
        "expected_quality": "LOW",  # Should be low match
        "expected_skills": ["React", "JavaScript", "HTML", "CSS"],
        "expected_score_range": (0.0, 0.4)
    },
    {
        "resume": "Full-stack developer with 3 years experience. Python, Django, React, PostgreSQL. Built web applications with REST APIs.",
        "job_desc": "Looking for ML Engineer with Python, TensorFlow, and cloud experience",
        "expected_quality": "MEDIUM",  # Partial match (Python but no ML)
        "expected_skills": ["Python", "Django", "React", "PostgreSQL"],
        "expected_score_range": (0.4, 0.7)
    },
    {
        "resume": "Senior Data Scientist with 7 years experience. Expert in Python, TensorFlow, Keras, AWS SageMaker. Published papers on deep learning.",
        "job_desc": "Looking for ML Engineer with Python, TensorFlow, and cloud experience",
        "expected_quality": "HIGH",  # Perfect match
        "expected_skills": ["Python", "TensorFlow", "Keras", "AWS", "Deep Learning"],
        "expected_score_range": (0.8, 1.0)
    },
    {
        "resume": "Java backend developer. 4 years with Spring Boot, Microservices, Kubernetes. Built scalable APIs.",
        "job_desc": "Looking for ML Engineer with Python, TensorFlow, and cloud experience",
        "expected_quality": "LOW",  # Wrong tech stack
        "expected_skills": ["Java", "Spring Boot", "Kubernetes"],
        "expected_score_range": (0.0, 0.3)
    },
]

# Skill dictionary for testing
SKILL_KEYWORDS = [
    "Python", "Java", "JavaScript", "React", "TensorFlow", "PyTorch", 
    "AWS", "Docker", "Kubernetes", "Machine Learning", "Deep Learning",
    "Django", "Flask", "PostgreSQL", "MongoDB", "HTML", "CSS",
    "Spring Boot", "Keras", "REST API", "Microservices"
]


class ResumeModelAccuracyTester:
    def __init__(self):
        print("🔄 Loading Sentence-BERT model...")
        model_name = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        self.model = SentenceTransformer(model_name)
        print(f"✅ Loaded model: {model_name}\n")
        
    def calculate_semantic_similarity(self, text1, text2):
        """Calculate semantic similarity using Sentence-BERT."""
        embeddings = self.model.encode([text1, text2])
        similarity = np.dot(embeddings[0], embeddings[1]) / (
            np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])
        )
        return float(similarity)
    
    def extract_skills(self, text):
        """Extract skills using fuzzy matching."""
        extracted = []
        text_lower = text.lower()
        
        for skill in SKILL_KEYWORDS:
            if fuzz.partial_ratio(skill.lower(), text_lower) > 85:
                extracted.append(skill)
        
        return extracted
    
    def calculate_skill_match_score(self, resume_skills, required_skills):
        """Calculate skill match percentage."""
        if not required_skills:
            return 1.0
        
        matched = sum(1 for skill in required_skills if skill in resume_skills)
        return matched / len(required_skills)
    
    def run_semantic_similarity_test(self):
        """Test semantic similarity accuracy."""
        print("="*60)
        print("📊 SEMANTIC SIMILARITY TEST")
        print("="*60)
        
        predictions = []
        actuals = []
        scores = []
        
        for i, test in enumerate(TEST_CASES, 1):
            score = self.calculate_semantic_similarity(test["resume"], test["job_desc"])
            scores.append(score)
            
            # Predict quality based on score
            if score >= 0.7:
                predicted = "HIGH"
            elif score >= 0.4:
                predicted = "MEDIUM"
            else:
                predicted = "LOW"
            
            predictions.append(predicted)
            actuals.append(test["expected_quality"])
            
            # Check if score is in expected range
            in_range = test["expected_score_range"][0] <= score <= test["expected_score_range"][1]
            status = "✅" if in_range else "❌"
            
            print(f"\nTest {i}: {status}")
            print(f"  Similarity Score: {score:.4f}")
            print(f"  Expected Range: {test['expected_score_range']}")
            print(f"  Predicted: {predicted} | Expected: {test['expected_quality']}")
        
        # Calculate accuracy
        accuracy = accuracy_score(actuals, predictions)
        precision = precision_score(actuals, predictions, average='weighted', zero_division=0)
        recall = recall_score(actuals, predictions, average='weighted', zero_division=0)
        f1 = f1_score(actuals, predictions, average='weighted', zero_division=0)
        
        print("\n" + "="*60)
        print("📈 SEMANTIC SIMILARITY METRICS:")
        print(f"  Accuracy:  {accuracy*100:.2f}%")
        print(f"  Precision: {precision*100:.2f}%")
        print(f"  Recall:    {recall*100:.2f}%")
        print(f"  F1 Score:  {f1*100:.2f}%")
        print(f"  Avg Similarity: {np.mean(scores):.4f}")
        print("="*60)
        
        return accuracy
    
    def run_skill_extraction_test(self):
        """Test skill extraction accuracy."""
        print("\n" + "="*60)
        print("🎯 SKILL EXTRACTION TEST")
        print("="*60)
        
        total_expected = 0
        total_extracted = 0
        total_correct = 0
        
        for i, test in enumerate(TEST_CASES, 1):
            extracted = self.extract_skills(test["resume"])
            expected = test["expected_skills"]
            
            correct = set(extracted) & set(expected)
            
            precision = len(correct) / len(extracted) if extracted else 0
            recall = len(correct) / len(expected) if expected else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            
            total_expected += len(expected)
            total_extracted += len(extracted)
            total_correct += len(correct)
            
            status = "✅" if f1 >= 0.7 else "⚠️" if f1 >= 0.5 else "❌"
            
            print(f"\nTest {i}: {status}")
            print(f"  Expected: {expected}")
            print(f"  Extracted: {extracted}")
            print(f"  Correct: {list(correct)}")
            print(f"  Precision: {precision*100:.2f}% | Recall: {recall*100:.2f}% | F1: {f1*100:.2f}%")
        
        # Overall metrics
        overall_precision = total_correct / total_extracted if total_extracted else 0
        overall_recall = total_correct / total_expected if total_expected else 0
        overall_f1 = 2 * (overall_precision * overall_recall) / (overall_precision + overall_recall) if (overall_precision + overall_recall) > 0 else 0
        
        print("\n" + "="*60)
        print("📈 SKILL EXTRACTION METRICS:")
        print(f"  Precision: {overall_precision*100:.2f}%")
        print(f"  Recall:    {overall_recall*100:.2f}%")
        print(f"  F1 Score:  {overall_f1*100:.2f}%")
        print(f"  Total Expected: {total_expected}")
        print(f"  Total Extracted: {total_extracted}")
        print(f"  Total Correct: {total_correct}")
        print("="*60)
        
        return overall_f1
    
    def run_inference_speed_test(self):
        """Test model inference speed."""
        print("\n" + "="*60)
        print("⚡ INFERENCE SPEED TEST")
        print("="*60)
        
        # Test single inference
        start = time.time()
        _ = self.calculate_semantic_similarity(TEST_CASES[0]["resume"], TEST_CASES[0]["job_desc"])
        single_time = time.time() - start
        
        # Test batch inference (simulating 50 resumes)
        batch_size = 50
        start = time.time()
        for _ in range(batch_size):
            _ = self.calculate_semantic_similarity(TEST_CASES[0]["resume"], TEST_CASES[0]["job_desc"])
        batch_time = time.time() - start
        avg_time = batch_time / batch_size
        
        print(f"\n  Single Resume Processing: {single_time*1000:.2f} ms")
        print(f"  Batch (50 resumes) Processing: {batch_time:.2f} s")
        print(f"  Average per Resume: {avg_time*1000:.2f} ms")
        
        # Check against requirements
        single_check = "✅" if single_time < 2 else "❌"
        batch_check = "✅" if batch_time < 3 else "❌"
        
        print(f"\n  {single_check} Single resume < 2s: {single_time < 2}")
        print(f"  {batch_check} 50 resumes < 3s: {batch_time < 3}")
        print("="*60)
        
        return avg_time
    
    def run_all_tests(self):
        """Run all accuracy tests."""
        print("\n" + "🚀 STARTING RESUME MODEL ACCURACY TESTS 🚀".center(60))
        print("="*60)
        
        start_time = time.time()
        
        # Run tests
        sem_accuracy = self.run_semantic_similarity_test()
        skill_f1 = self.run_skill_extraction_test()
        avg_speed = self.run_inference_speed_test()
        
        # Final summary
        total_time = time.time() - start_time
        
        print("\n" + "="*60)
        print("🎉 FINAL SUMMARY")
        print("="*60)
        print(f"\n  Semantic Similarity Accuracy: {sem_accuracy*100:.2f}%")
        print(f"  Skill Extraction F1 Score:    {skill_f1*100:.2f}%")
        print(f"  Average Inference Speed:      {avg_speed*1000:.2f} ms")
        print(f"\n  Overall Model Health: ", end="")
        
        if sem_accuracy >= 0.8 and skill_f1 >= 0.7 and avg_speed < 2:
            print("✅ EXCELLENT")
        elif sem_accuracy >= 0.6 and skill_f1 >= 0.5:
            print("⚠️  GOOD (Room for improvement)")
        else:
            print("❌ NEEDS IMPROVEMENT")
        
        print(f"\n  Total Test Duration: {total_time:.2f}s")
        print("="*60 + "\n")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("RESUME SCREENING MODEL ACCURACY TESTER".center(60))
    print("="*60)
    
    try:
        tester = ResumeModelAccuracyTester()
        tester.run_all_tests()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
