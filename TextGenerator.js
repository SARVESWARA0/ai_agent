let isGenerating = false;
let currentConversationId = null;
let conversations = [];

function createConversation() {
    const id = Date.now().toString();
    const conversation = {
        id: id,
        title: "New Conversation",
        messages: []
    };
    conversations.unshift(conversation);
    currentConversationId = id;
    updateConversationHistory();
    clearChatMessages();
    saveConversations();
}

function updateConversationHistory() {
    const historyContainer = document.getElementById('conversation-history');
    historyContainer.innerHTML = '';
    conversations.forEach(conv => {
        const convElement = document.createElement('div');
        convElement.className = 'conversation-item';
        convElement.innerHTML = `
            ${conv.title}
            <button class="delete-btn" onclick="deleteConversation('${conv.id}')">Delete</button>
        `;
        convElement.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                loadConversation(conv.id);
            }
        };
        if (conv.id === currentConversationId) {
            convElement.classList.add('active');
        }
        historyContainer.appendChild(convElement);
    });
}

function deleteConversation(id) {
    conversations = conversations.filter(conv => conv.id !== id);
    if (currentConversationId === id) {
        if (conversations.length > 0) {
            loadConversation(conversations[0].id);
        } else {
            createConversation();
        }
    } else {
        updateConversationHistory();
    }
    saveConversations();
}

function loadConversation(id) {
    currentConversationId = id;
    clearChatMessages();
    const conversation = conversations.find(conv => conv.id === id);
    if (conversation) {
        conversation.messages.forEach(message => {
            appendMessage(message.role, message.content);
        });
        updateConversationHistory();
        document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    }
    saveConversations();
}

function clearChatMessages() {
    document.getElementById('chat-messages').innerHTML = '';
}

async function streamText(textChunks, element) {
    for (const chunk of textChunks) {
        element.innerHTML += chunk;
        await delay(10);
        element.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateText() {
    if (isGenerating) return;
    
    const promptElement = document.getElementById('prompt');
    const prompt = promptElement.value.trim();
    
    if (!prompt) {
        alert('Please enter a message.');
        return;
    }
    
    isGenerating = true;
    promptElement.value = '';
    
    const chatMessages = document.getElementById('chat-messages');
    const userMessageId = `user-message-${Date.now()}`;
    const aiResponseId = `ai-response-${Date.now()}`;
    
    appendMessage('user', prompt, userMessageId);
    appendMessage('ai', '', aiResponseId);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    const aiResponseElement = document.getElementById(aiResponseId);
    
    try {
        const model = document.getElementById('model-select').value;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer (your_api_key_of_groq)',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            const parsedLines = lines
                .map(line => line.replace(/^data: /, '').trim())
                .filter(line => line !== '' && line !== '[DONE]')
                .map(line => JSON.parse(line));
            
            for (const parsedLine of parsedLines) {
                const content = parsedLine.choices[0]?.delta?.content || '';
                fullResponse += content;
                aiResponseElement.innerHTML += content;
                aiResponseElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
        
        // Convert Markdown to HTML
        aiResponseElement.innerHTML = marked.parse(fullResponse);

        // Update conversation
        const conversation = conversations.find(conv => conv.id === currentConversationId);
        conversation.messages.push({ role: 'user', content: prompt });
        conversation.messages.push({ role: 'ai', content: fullResponse });
        if (conversation.messages.length === 2) {
            conversation.title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
            updateConversationHistory();
        }
        saveConversations();
    } catch (error) {
        console.error("There was an error with the API call:", error);
        aiResponseElement.innerHTML = "An error occurred while fetching the response.";
    } finally {
        isGenerating = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function appendMessage(role, content, id = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = `
        <div class="message-header">${role === 'user' ? 'You' : 'AI'}</div>
        <div ${id ? `id="${id}"` : ''} class="message-content"></div>
    `;
    chatMessages.appendChild(messageDiv);

    if (content) {
        const contentElement = messageDiv.querySelector('.message-content');
        contentElement.textContent = content;
    }
}
function appendMessage(role, content, id = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = `
        <div class="message-header">${role === 'user' ? 'You' : 'AI'}</div>
        <div ${id ? `id="${id}"` : ''} class="message-content">${content}</div>
    `;
    chatMessages.appendChild(messageDiv);
}

function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
    localStorage.setItem('currentConversationId', currentConversationId);
}

function loadConversations() {
    try {
        const savedConversations = localStorage.getItem('conversations');
        const savedCurrentId = localStorage.getItem('currentConversationId');
        if (savedConversations) {
            conversations = JSON.parse(savedConversations);
            currentConversationId = savedCurrentId;
            updateConversationHistory();
            if (currentConversationId && conversations.some(conv => conv.id === currentConversationId)) {
                loadConversation(currentConversationId);
            } else if (conversations.length > 0) {
                loadConversation(conversations[0].id);
            } else {
                createConversation();
            }
        } else {
            createConversation();
        }
    } catch (error) {
        console.error("Error loading conversations:", error);
        conversations = [];
        createConversation();
    }
}

document.getElementById('prompt').addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        generateText();
    }
});

document.getElementById('new-chat').addEventListener('click', createConversation);

// Auto-resize textarea
document.getElementById('prompt').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Load conversations when the page loads
window.addEventListener('load', loadConversations);
