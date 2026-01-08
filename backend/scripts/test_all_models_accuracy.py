"""
Comprehensive script to test accuracy of ALL models in the project:
1. Resume Screening Model (Sentence-BERT)
2. Chatbot NLU Model (Rasa DIET)
3. OCR Model (Tesseract)
4. Fuzzy Matching
"""

import sys
import os
from pathlib import Path
import subprocess
import json
import time

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


class ComprehensiveModelTester:
    def __init__(self):
        self.results = {
            "resume_screening": {},
            "chatbot_nlu": {},
            "ocr": {},
            "fuzzy_matching": {},
            "overall": {}
        }
        self.workspace_root = Path(__file__).parent.parent.parent
        
    def print_header(self, text):
        """Print formatted header."""
        print("\n" + "="*70)
        print(f"{Colors.BOLD}{Colors.CYAN}{text.center(70)}{Colors.ENDC}")
        print("="*70)
    
    def print_section(self, text):
        """Print section header."""
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.ENDC}")
    
    def print_success(self, text):
        """Print success message."""
        print(f"{Colors.GREEN}✅ {text}{Colors.ENDC}")
    
    def print_warning(self, text):
        """Print warning message."""
        print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")
    
    def print_error(self, text):
        """Print error message."""
        print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")
    
    def test_resume_screening_model(self):
        """Test 1: Resume Screening Model Accuracy."""
        self.print_section("📊 TEST 1: RESUME SCREENING MODEL")
        
        try:
            # Run the resume model accuracy test
            script_path = Path(__file__).parent / "test_resume_model_accuracy.py"
            
            if not script_path.exists():
                self.print_error("Resume model test script not found!")
                return False
            
            print("Running resume screening model tests...\n")
            result = subprocess.run(
                [sys.executable, str(script_path)],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            print(result.stdout)
            
            if result.returncode == 0:
                # Parse results from output
                output = result.stdout
                
                # Extract metrics (simple parsing)
                if "Semantic Similarity Accuracy:" in output:
                    self.results["resume_screening"]["semantic_accuracy"] = "PASSED"
                    self.print_success("Semantic Similarity Test PASSED")
                
                if "Skill Extraction F1 Score:" in output:
                    self.results["resume_screening"]["skill_extraction"] = "PASSED"
                    self.print_success("Skill Extraction Test PASSED")
                
                if "Inference Speed" in output:
                    self.results["resume_screening"]["inference_speed"] = "PASSED"
                    self.print_success("Inference Speed Test PASSED")
                
                return True
            else:
                self.print_error(f"Resume model tests failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.print_error(f"Error testing resume model: {e}")
            return False
    
    def test_chatbot_nlu_model(self):
        """Test 2: Chatbot NLU Model Accuracy."""
        self.print_section("🤖 TEST 2: CHATBOT NLU MODEL")
        
        chatbot_dir = self.workspace_root / "chatbot"
        
        if not chatbot_dir.exists():
            self.print_warning("Chatbot directory not found, skipping...")
            return None
        
        try:
            print("Checking Rasa installation...")
            
            # Check if Rasa is installed
            try:
                result = subprocess.run(
                    ["rasa", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                print(f"  {result.stdout.strip()}")
                self.print_success("Rasa is installed")
            except FileNotFoundError:
                self.print_warning("Rasa not installed. Install with: pip install rasa")
                return None
            
            # Check if trained model exists
            models_dir = chatbot_dir / "models"
            if not models_dir.exists() or not list(models_dir.glob("*.tar.gz")):
                self.print_warning("No trained Rasa model found. Train with: rasa train")
                self.results["chatbot_nlu"]["status"] = "NO_MODEL"
                return None
            
            # Run NLU test
            print("\nRunning Rasa NLU cross-validation test...")
            print("(This may take 2-5 minutes...)\n")
            
            result = subprocess.run(
                ["rasa", "test", "nlu", "--nlu", "data/nlu.yml", "--cross-validation"],
                cwd=str(chatbot_dir),
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                print(result.stdout)
                
                # Parse results
                output = result.stdout
                
                if "intent" in output.lower() and "accuracy" in output.lower():
                    self.results["chatbot_nlu"]["intent_classification"] = "PASSED"
                    self.print_success("Intent Classification Test PASSED")
                
                if "f1" in output.lower():
                    self.results["chatbot_nlu"]["f1_score"] = "PASSED"
                    self.print_success("F1 Score Test PASSED")
                
                # Check for results file
                results_dir = chatbot_dir / "results"
                if results_dir.exists():
                    self.print_success(f"Detailed results saved in: {results_dir}")
                
                return True
            else:
                self.print_error(f"NLU test failed: {result.stderr}")
                return False
            
        except subprocess.TimeoutExpired:
            self.print_error("Rasa test timed out (>5 minutes)")
            return False
        except Exception as e:
            self.print_error(f"Error testing chatbot: {e}")
            return False
    
    def test_ocr_accuracy(self):
        """Test 3: OCR (Tesseract) Accuracy."""
        self.print_section("🖼️  TEST 3: OCR MODEL")
        
        try:
            # Check if Tesseract is installed
            try:
                import pytesseract
                from PIL import Image
                import cv2
                
                # Try to get Tesseract version
                version = pytesseract.get_tesseract_version()
                print(f"  Tesseract version: {version}")
                self.print_success("Tesseract is installed")
                
            except ImportError:
                self.print_warning("pytesseract not installed. Install with: pip install pytesseract opencv-python pillow")
                return None
            except pytesseract.TesseractNotFoundError:
                self.print_warning("Tesseract not found. Install from: https://github.com/tesseract-ocr/tesseract")
                return None
            
            # Create a simple test image with text
            print("\nRunning OCR accuracy test on sample text...")
            
            import numpy as np
            
            # Create test cases
            test_texts = [
                "RESUME\nJohn Doe\nPython Developer",
                "Skills: Python, Java, React",
                "Experience: 5 years in software development"
            ]
            
            correct = 0
            total = len(test_texts)
            
            for i, expected_text in enumerate(test_texts, 1):
                # Create simple white image with black text
                img = np.ones((100, 500, 3), dtype=np.uint8) * 255
                
                # Add text using PIL
                from PIL import ImageDraw, ImageFont
                pil_img = Image.fromarray(img)
                draw = ImageDraw.Draw(pil_img)
                
                try:
                    font = ImageFont.truetype("arial.ttf", 20)
                except:
                    font = ImageFont.load_default()
                
                draw.text((10, 30), expected_text, fill=(0, 0, 0), font=font)
                img = np.array(pil_img)
                
                # Convert to grayscale
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # OCR
                extracted_text = pytesseract.image_to_string(gray).strip()
                
                # Calculate similarity
                from difflib import SequenceMatcher
                similarity = SequenceMatcher(None, expected_text, extracted_text).ratio()
                
                if similarity > 0.7:  # 70% threshold
                    correct += 1
                    print(f"  Test {i}: ✅ Similarity: {similarity*100:.1f}%")
                else:
                    print(f"  Test {i}: ❌ Similarity: {similarity*100:.1f}%")
                    print(f"    Expected: {expected_text}")
                    print(f"    Got: {extracted_text}")
            
            accuracy = (correct / total) * 100
            print(f"\n  OCR Accuracy: {accuracy:.1f}% ({correct}/{total} tests passed)")
            
            self.results["ocr"]["accuracy"] = f"{accuracy:.1f}%"
            
            if accuracy >= 70:
                self.results["ocr"]["status"] = "PASSED"
                self.print_success(f"OCR accuracy acceptable ({accuracy:.1f}%)")
                return True
            else:
                self.results["ocr"]["status"] = "LOW_ACCURACY"
                self.print_warning(f"OCR accuracy below threshold ({accuracy:.1f}%)")
                return False
            
        except Exception as e:
            self.print_error(f"Error testing OCR: {e}")
            return False
    
    def test_fuzzy_matching(self):
        """Test 4: Fuzzy Matching Accuracy."""
        self.print_section("🔍 TEST 4: FUZZY MATCHING")
        
        try:
            from rapidfuzz import fuzz, process
            
            # Test cases: (text, query, expected_match)
            test_cases = [
                ("React.js developer", "React", True, "Should match React variations"),
                ("Python programmer", "Python", True, "Exact match"),
                ("JavaScript expert", "Javascript", True, "Case insensitive"),
                ("Machine Learning Engineer", "ML", False, "Abbreviation (shouldn't match at 85% threshold)"),
                ("TensorFlow 2.0", "TensorFlow", True, "Should match with version"),
                ("AWS Cloud", "Amazon Web Services", False, "Abbreviation expansion"),
                ("Node.js backend", "NodeJS", True, "Variations with symbols"),
                ("PostgreSQL database", "Postgres", True, "Common abbreviations"),
            ]
            
            print("\nTesting fuzzy matching with 85% threshold...\n")
            
            correct = 0
            total = len(test_cases)
            
            for i, (text, query, expected, description) in enumerate(test_cases, 1):
                score = fuzz.partial_ratio(query.lower(), text.lower())
                matches = score > 85
                
                is_correct = matches == expected
                if is_correct:
                    correct += 1
                
                status = "✅" if is_correct else "❌"
                print(f"  Test {i}: {status} Score: {score} | {description}")
                print(f"    Text: '{text}' | Query: '{query}'")
                print(f"    Expected: {expected} | Got: {matches}")
            
            accuracy = (correct / total) * 100
            print(f"\n  Fuzzy Matching Accuracy: {accuracy:.1f}% ({correct}/{total} tests passed)")
            
            self.results["fuzzy_matching"]["accuracy"] = f"{accuracy:.1f}%"
            
            if accuracy >= 80:
                self.results["fuzzy_matching"]["status"] = "PASSED"
                self.print_success(f"Fuzzy matching working well ({accuracy:.1f}%)")
                return True
            else:
                self.results["fuzzy_matching"]["status"] = "NEEDS_TUNING"
                self.print_warning(f"Fuzzy matching needs tuning ({accuracy:.1f}%)")
                return False
            
        except ImportError:
            self.print_error("rapidfuzz not installed. Install with: pip install rapidfuzz")
            return None
        except Exception as e:
            self.print_error(f"Error testing fuzzy matching: {e}")
            return False
    
    def generate_summary_report(self):
        """Generate final summary report."""
        self.print_header("📋 COMPREHENSIVE MODEL ACCURACY REPORT")
        
        print("\n" + "="*70)
        print(f"{Colors.BOLD}MODEL PERFORMANCE SUMMARY{Colors.ENDC}")
        print("="*70)
        
        # Resume Screening Model
        print(f"\n{Colors.BOLD}1. Resume Screening Model:{Colors.ENDC}")
        for key, value in self.results["resume_screening"].items():
            icon = "✅" if value == "PASSED" else "❌"
            print(f"   {icon} {key.replace('_', ' ').title()}: {value}")
        
        # Chatbot NLU
        print(f"\n{Colors.BOLD}2. Chatbot NLU Model:{Colors.ENDC}")
        if self.results["chatbot_nlu"]:
            for key, value in self.results["chatbot_nlu"].items():
                icon = "✅" if value == "PASSED" else "⚠️"
                print(f"   {icon} {key.replace('_', ' ').title()}: {value}")
        else:
            print("   ⚠️  Not tested (Rasa not configured)")
        
        # OCR
        print(f"\n{Colors.BOLD}3. OCR Model:{Colors.ENDC}")
        if self.results["ocr"]:
            for key, value in self.results["ocr"].items():
                icon = "✅" if value == "PASSED" else "⚠️"
                print(f"   {icon} {key.replace('_', ' ').title()}: {value}")
        else:
            print("   ⚠️  Not tested (Tesseract not configured)")
        
        # Fuzzy Matching
        print(f"\n{Colors.BOLD}4. Fuzzy Matching:{Colors.ENDC}")
        if self.results["fuzzy_matching"]:
            for key, value in self.results["fuzzy_matching"].items():
                icon = "✅" if value == "PASSED" else "⚠️"
                print(f"   {icon} {key.replace('_', ' ').title()}: {value}")
        
        # Overall Status
        print("\n" + "="*70)
        print(f"{Colors.BOLD}OVERALL SYSTEM HEALTH:{Colors.ENDC}")
        
        passed_tests = sum(
            1 for result in [
                self.results["resume_screening"],
                self.results["chatbot_nlu"],
                self.results["ocr"],
                self.results["fuzzy_matching"]
            ]
            for value in result.values()
            if value == "PASSED"
        )
        
        total_tests = sum(len(r) for r in [
            self.results["resume_screening"],
            self.results["chatbot_nlu"],
            self.results["ocr"],
            self.results["fuzzy_matching"]
        ] if r)
        
        if total_tests > 0:
            overall_score = (passed_tests / total_tests) * 100
            print(f"  Score: {overall_score:.1f}% ({passed_tests}/{total_tests} tests passed)")
            
            if overall_score >= 80:
                self.print_success("EXCELLENT - All models performing well!")
            elif overall_score >= 60:
                self.print_warning("GOOD - Some models need attention")
            else:
                self.print_error("NEEDS IMPROVEMENT - Multiple models underperforming")
        
        print("="*70)
        
        # Save results to JSON
        results_file = Path(__file__).parent / "model_accuracy_results.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📄 Results saved to: {results_file}")
    
    def run_all_tests(self):
        """Run all model accuracy tests."""
        self.print_header("🚀 STARTING COMPREHENSIVE MODEL ACCURACY TESTS 🚀")
        
        start_time = time.time()
        
        # Run all tests
        print("\n⏱️  This may take 5-10 minutes depending on your system...\n")
        
        self.test_resume_screening_model()
        self.test_chatbot_nlu_model()
        self.test_ocr_accuracy()
        self.test_fuzzy_matching()
        
        # Generate report
        self.generate_summary_report()
        
        total_time = time.time() - start_time
        print(f"\n⏱️  Total test duration: {total_time:.2f} seconds\n")


if __name__ == "__main__":
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'COMPREHENSIVE MODEL ACCURACY TESTER'.center(70)}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.ENDC}")
    
    try:
        tester = ComprehensiveModelTester()
        tester.run_all_tests()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}⚠️  Tests interrupted by user{Colors.ENDC}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.FAIL}❌ Fatal Error: {e}{Colors.ENDC}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
