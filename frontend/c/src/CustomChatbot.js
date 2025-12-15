import React, { useState, useEffect, useRef } from 'react';
import './CustomChatbot.css';
import API_URL from './config';

function CustomChatbot() {
  const userId = localStorage.getItem('user_id');
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
        setMessages(prev => [...prev, { sender: 'bot', text: "I'm sorry, I didn't understand that. Could you rephrase?" }]);
      }
    } catch (error) {
      console.error('Error communicating with Rasa:', error);
      setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I'm having trouble connecting. Please try again." }]);
    }
  };

  // Quick local handling for trivial greetings/affirmations so UX feels responsive
  // while we investigate the Rasa parsing issues. Returns true if handled.
  const handleLocalShortcuts = async (message) => {
    const m = (message || '').toLowerCase().trim();
    // simple greeting
    if (/^(hi|hello|hey|hey there|hi there)$/.test(m)) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Hey! I'm your interview prep assistant — type 'yes' when you're ready to start." }]);
      return true;
    }
    // affirmative to start interview — forward a standardized trigger to Rasa
    if (/^(yes|yeah|yep|sure|okay|ok|y)$/.test(m)) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Great — starting the interview now...' }]);
      // trigger the start_interview intent on Rasa
      await sendMessageToRasa('start interview');
      return true;
    }
    return false;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // If a local shortcut handles this message (greeting/yes), let it handle UX
    try {
      const handled = await handleLocalShortcuts(userMessage);
      if (handled) return;
    } catch (e) {
      console.warn('Local shortcut handler failed:', e);
    }

    // Add user message to chat
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);

    // Show loading
    setIsLoading(true);

    // Send to Rasa
    await sendMessageToRasa(userMessage);

    // Hide loading
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
      {showTooltip && !isOpen && (
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
