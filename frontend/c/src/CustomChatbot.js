import React, { useState, useEffect, useRef } from 'react';
import './CustomChatbot.css';
import API_URL from './config';

function CustomChatbot() {
  const userId = localStorage.getItem('user_id');
  const hasResume = !!localStorage.getItem('current_jd_id');
  const chatStorageKey = `chat_history_${userId}`;
  
  // Load chat history from localStorage
  const loadChatHistory = () => {
    const stored = localStorage.getItem(chatStorageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error loading chat history:', e);
      }
    }
    
    // Always show a welcoming message - we'll auto-detect the application
    const welcomeMsg = "Hi! 👋 I'm your interview prep assistant. I'll ask you personalized screening questions based on your resume and the job you applied to. Type 'yes' when you're ready to start! 🚀";
    
    return [
      { sender: 'bot', text: welcomeMsg }
    ];
  };

  const [messages, setMessages] = useState(loadChatHistory());
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (userId) {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    }
  }, [messages, userId, chatStorageKey]);

  // Auto-hide tooltip after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Hide tooltip when chat is opened
  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
    }
  }, [isOpen]);

  // Generate questions by analyzing actual resume content
  const generatePersonalizedQuestions = (context) => {
    const resume = context.resume || {};
    const jd = context.job_description || {};
    const skillAnalysis = context.skill_analysis || {};
    
    const resumeText = resume.extracted_text_preview || '';
    const skills = resume.skills || [];
    const experience = resume.experience || [];
    const matchedSkills = skillAnalysis.matched_skills || [];
    const missingSkills = skillAnalysis.missing_skills || [];
    const jobTitle = jd.title || 'this position';
    
    const questions = [];
    
    // Parse resume text for specific mentions
    const textLower = resumeText.toLowerCase();
    
    // Question 1: Ask about specific project/work mentioned in resume
    if (textLower.includes('project')) {
      const projectMatch = resumeText.match(/project[s]?\s*[:-]?\s*([^.\n]{10,100})/i);
      if (projectMatch) {
        const projectSnippet = projectMatch[1].trim().split('.')[0];
        questions.push(`I see you mentioned working on "${projectSnippet}". Can you walk me through your specific contribution and the technical decisions you made?`);
      } else {
        questions.push(`Tell me about the most technically challenging project you've worked on.`);
      }
    } else if (textLower.includes('developed') || textLower.includes('built') || textLower.includes('created')) {
      const devMatch = resumeText.match(/(developed|built|created)\s+([^.\n]{10,80})/i);
      if (devMatch) {
        const work = devMatch[2].trim().split('.')[0];
        questions.push(`You mentioned you ${devMatch[1]} ${work}. What challenges did you face and how did you solve them?`);
      } else {
        questions.push(`Describe something you built from scratch.`);
      }
    } else {
      questions.push(`What's your most significant technical accomplishment?`);
    }
    
    // Question 2: Ask about specific matched skill usage
    if (matchedSkills.length > 0) {
      const skill = matchedSkills[0];
      // Check if skill is mentioned in context in resume
      const skillRegex = new RegExp(`${skill}[^.]{0,100}`, 'i');
      const skillMatch = resumeText.match(skillRegex);
      if (skillMatch) {
        const context = skillMatch[0].trim();
        questions.push(`In your resume, you mentioned ${skill} in the context of: "${context}". Can you elaborate on what you accomplished with it?`);
      } else {
        questions.push(`${skill} is required for this role. Tell me about a real situation where you used it to solve a problem.`);
      }
    } else if (skills.length > 0) {
      questions.push(`You listed ${skills[0]} in your skills. Give me a concrete example of how you've applied it.`);
    } else {
      questions.push(`What technical skills are you strongest in and why?`);
    }
    
    // Question 3: About experience or education
    if (experience.length > 0) {
      // Try to extract company or role from text
      const roleMatch = resumeText.match(/(?:as|role|position|worked)\s*[:-]?\s*([A-Z][^.\n]{10,60})/);
      if (roleMatch) {
        questions.push(`In your role as ${roleMatch[1].trim()}, what was your biggest achievement?`);
      } else {
        questions.push(`What was the most valuable lesson you learned from your professional experience?`);
      }
    } else {
      const eduMatch = resumeText.match(/(university|college|degree|bachelor|master)[^.\n]{0,80}/i);
      if (eduMatch) {
        questions.push(`During your education, what project or coursework best prepared you for real-world work?`);
      } else {
        questions.push(`How have you prepared yourself for this role?`);
      }
    }
    
    // Question 4: Gap analysis - missing skill
    if (missingSkills.length > 0) {
      const missingSkill = missingSkills[0];
      questions.push(`The role needs ${missingSkill}, which I don't see in your background. Have you had any exposure to it, or how would you get started?`);
    } else {
      questions.push(`What new technology or skill are you currently learning?`);
    }
    
    // Question 5: Role fit
    questions.push(`Based on everything in your resume, why do you think you're a good fit for ${jobTitle}?`);
    
    return questions;
  };

  const sendMessageToRasa = async (message) => {
    const userId = localStorage.getItem('chat_user_id') || localStorage.getItem('user_id') || 'user';
    let jdId = localStorage.getItem('current_jd_id');

    // If no jd_id in localStorage, try to fetch from user's applications
    if (!jdId) {
      try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
          const appsResponse = await fetch(`${API_URL}/applications/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const applications = await appsResponse.json();
          // Use the most recent application's jd_id
          if (applications && applications.length > 0) {
            jdId = applications[0].jd_id;
            localStorage.setItem('current_jd_id', jdId); // Cache it
            console.log('📌 Auto-detected jd_id from applications:', jdId);
          }
        }
      } catch (err) {
        console.error('Error fetching applications for jd_id:', err);
      }
    }

    try {
      const response = await fetch(`${API_URL.replace(/\/$/, '')}/rasa/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: userId,
          message: message,
          metadata: {
            user_id: userId,
            jd_id: jdId
          }
        })
      });

      const data = await response.json();
      console.log('Rasa response:', data);

      if (Array.isArray(data) && data.length > 0) {
        // Add all bot responses
        data.forEach(msg => {
          if (msg.text) {
            setMessages(prev => [...prev, { sender: 'bot', text: msg.text }]);
          }
        });
      } else {
        // Fallback: if Rasa returns empty, generate response based on user input
        const msgLower = message.trim().toLowerCase();
        
        // Check for affirmations at start
        if (['yes', 'y', 'yeah', 'yep', 'sure', 'okay', 'ok'].includes(msgLower)) {
          // Fetch candidate context to generate personalized questions
          try {
            const token = localStorage.getItem('access_token') || localStorage.getItem('token');
            const contextResponse = await fetch(`${API_URL}/chatbot/candidate-context/${userId}/${jdId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (contextResponse.ok) {
              const context = await contextResponse.json();
              console.log('📋 Fetched candidate context:', context);
              
              // Generate personalized questions
              const personalizedQuestions = generatePersonalizedQuestions(context);
              localStorage.setItem('interview_questions', JSON.stringify(personalizedQuestions));
              localStorage.setItem('current_question_index', '0'); // Start with first question
              
              setMessages(prev => [...prev, { 
                sender: 'bot', 
                text: `Great! Let's start your interview prep. I'll ask you personalized questions based on your resume and the ${context.job_description?.title || 'job'}. Let's begin! 🚀\n\n${personalizedQuestions[0]}` 
              }]);
            } else {
              // Fallback if context fetch fails
              setMessages(prev => [...prev, { 
                sender: 'bot', 
                text: "Great! Let's start your interview prep. I'll ask you some questions. Let's begin! 🚀\n\nQuestion 1: Tell me about a recent project you're proud of and what role you played in it." 
              }]);
            }
          } catch (err) {
            console.error('Error fetching candidate context:', err);
            setMessages(prev => [...prev, { 
              sender: 'bot', 
              text: "Great! Let's start your interview prep. Let's begin! 🚀\n\nQuestion 1: Tell me about a recent project you're proud of." 
            }]);
          }
        } else if (['no', 'n', 'nope', 'not now'].includes(msgLower)) {
          setMessages(prev => [...prev, { 
            sender: 'bot', 
            text: "No problem! Feel free to come back anytime you're ready to practice. Good luck! 👋" 
          }]);
        } else {
          // User provided an answer to a question - acknowledge and ask next one
          const storedQuestions = JSON.parse(localStorage.getItem('interview_questions') || '[]');
          const currentQuestionIndex = parseInt(localStorage.getItem('current_question_index') || '0', 10);
          
          console.log(`[CHATBOT] Current question index: ${currentQuestionIndex}, Total questions: ${storedQuestions.length}`);
          
          if (storedQuestions.length > 0 && currentQuestionIndex < storedQuestions.length - 1) {
            // Move to next question
            const nextIndex = currentQuestionIndex + 1;
            localStorage.setItem('current_question_index', nextIndex.toString());
            
            setMessages(prev => [...prev, { 
              sender: 'bot', 
              text: `Great answer! 👍\n\n${storedQuestions[nextIndex]}` 
            }]);
          } else if (currentQuestionIndex >= storedQuestions.length - 1 || currentQuestionIndex >= 4) {
            // Finished all questions
            localStorage.removeItem('current_question_index');
            localStorage.removeItem('interview_questions');
            
            setMessages(prev => [...prev, { 
              sender: 'bot', 
              text: "Excellent answers! You've completed the interview prep. You're well-prepared! 🎯✨ Best of luck with your interview!" 
            }]);
          } else {
            setMessages(prev => [...prev, { 
              sender: 'bot', 
              text: "Thank you for sharing! Please tell me more..." 
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Error communicating with Rasa:', error);
      setMessages(prev => [...prev, { sender: 'bot', text: "Thanks for your answer! That's valuable experience." }]);
    }
  };

  // No local shortcuts: always send user input to Rasa so behaviour matches
  // the original chatbot. This avoids duplicating bot messages and keeps
  // Rasa as the single source of truth for responses.

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    // Add user message to chat and send to Rasa
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsLoading(true);
    await sendMessageToRasa(userMessage);
    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChatHistory = () => {
    const confirmClear = window.confirm('Are you sure you want to clear chat history? This cannot be undone.');
    if (confirmClear) {
      const jdId = localStorage.getItem('current_jd_id');
      const hasResume = !!jdId;
      
      const welcomeMsg = hasResume 
        ? "Hi! 🎉 I'm your interview prep assistant. I'll ask personalized questions based on your resume and the job. Ready to practice? (Type 'yes' to start)"
        : "Hi! 🎉 I'm your interview prep assistant. Upload a resume first to get personalized interview questions, or type 'yes' for general practice questions.";
      
      const initialMessage = [
        { sender: 'bot', text: welcomeMsg }
      ];
      setMessages(initialMessage);
      localStorage.setItem(chatStorageKey, JSON.stringify(initialMessage));
    }
  };

  return (
    <>
      {/* Tooltip notification */}
      {showTooltip && !isOpen && hasResume && (
        <div className="chat-tooltip">
          👋 Hey there! I'm your assistant. Click to chat!
        </div>
      )}

      {/* Floating Chat Button */}
      <div 
        className={`chat-button ${isOpen ? 'chat-button-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => !isOpen && setTimeout(() => setShowTooltip(false), 2000)}
      >
        {isOpen ? '✕' : '💬'}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="custom-chatbot-container">
          {/* Header */}
          <div className="custom-chatbot-header">
            <span>🎯 Interview Prep Assistant</span>
            <div className="chat-header-actions">
              <button 
                className="chat-clear-btn" 
                onClick={clearChatHistory}
                title="Clear chat history"
              >
                🗑️
              </button>
              <button className="chat-close-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="custom-chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.sender}`}>
                <div className="chat-avatar">
                  {msg.sender === 'bot' ? '🤖' : '👤'}
                </div>
                <div className="chat-message-bubble">
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message bot">
                <div className="chat-avatar">🤖</div>
                <div className="chat-message-bubble typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="custom-chatbot-input">
            <input
              type="text"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button onClick={handleSend} disabled={!inputValue.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default CustomChatbot;
