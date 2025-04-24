const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessagesContainer = document.getElementById('chat-messages');
const newChatButton = document.getElementById('new-chat-button');
const chatList = document.getElementById('chat-list');
const clearChatsButton = document.getElementById('clear-chats-button');
const totalRequestsSpan = document.getElementById('total-requests');
const todayRequestsSpan = document.getElementById('today-requests');
const roleSelect = document.getElementById('role-select');
const roleSelectDropdown = document.getElementById('role-select-dropdown');
const selectedRoleNameSpan = document.getElementById('selected-role-name');
const burgerButton = document.getElementById('burger-button');
const mobileBurgerButton = document.getElementById('mobile-burger-button');
const sidebar = document.querySelector('.sidebar');
const overlay = document.createElement('div');
overlay.classList.add('overlay');
document.body.appendChild(overlay);

const modelSelect = document.getElementById('model-select');
const modelSelectDropdown = document.getElementById('model-select-dropdown');
const selectedModelNameSpan = document.getElementById('selected-model-name');

const GOOGLE_API_KEY = 'AIzaSyDhMSW32l2RocTIuWh6bO4vecvufYVMYTU';
const OPENROUTER_API_KEY = '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';

const MODELS = [
    {
        id: 'gemini-flash',
        name: 'gemini (работает с впн)',
        apiKey: GOOGLE_API_KEY,
        apiType: 'google',
        supportsStreaming: false,
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
        requestFormatter: (messages, systemInstruction) => {
             const contents = messages.map(msg => ({
                 role: msg.sender === 'user' ? 'user' : 'model',
                 parts: [{ text: msg.text }]
             }));
             const body = { contents: contents };
             if (systemInstruction) {
                 body.systemInstruction = { parts: [{ text: systemInstruction }] };
             }
             return body;
         }
    },
    {
        id: 'deepseek-r1',
        name: 'deepseek Безлимит',
        apiKey: OPENROUTER_API_KEY,
        apiType: 'openrouter',
        supportsStreaming: true,
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        requestFormatter: (messages, systemInstruction) => {
             const openrouterMessages = [];
             if (systemInstruction) {
                 openrouterMessages.push({ role: 'system', content: systemInstruction });
             }
             messages.forEach(msg => {
                 openrouterMessages.push({
                     role: msg.sender === 'user' ? 'user' : 'assistant',
                     content: msg.text
                 });
             });
             return {
                 model: 'microsoft/mai-ds-r1:free',
                 messages: openrouterMessages,
                 stream: true
             };
        }
    }
];

const ROLES = [
    { id: 'standard', name: 'Стандарт', prompt: '' },
    { id: 'coder', name: 'Программист', prompt: 'Ты - опытный программист, эксперт в различных языках и технологиях. Твоя задача - предоставлять подробные и точные ответы на вопросы, связанные с кодом, алгоритмами и архитектурой. Все примеры кода должны быть представлены в форматированных блоках, снабженных комментариями для облегчения понимания. Тщательно объясняй сложные концепции программирования, используя аналогии и примеры из реального мира. ПИШИ ВСЕГДА ПО РУССКИ' },
    { id: 'writer', name: 'Писатель', prompt: 'Ты - талантливый писатель с богатым воображением и отточенным стилем. Твоя задача - помогать пользователю с созданием захватывающих текстов, разработкой оригинальных сюжетов, написанием трогательных стихов и запоминающихся песен. Используй яркий и выразительный язык, умело играй со словами и создавай неповторимую атмосферу. Предлагай несколько вариантов, раскрывающих разные грани темы. ПИШИ ВСЕГДА ПО РУССКИ' },
    { id: 'translator', name: 'Переводчик', prompt: 'Ты - профессиональный переводчик, владеющий множеством языков и обладающий глубоким пониманием культурных нюансов. Твоя задача - обеспечивать точный и стилистически грамотный перевод предоставленного текста с одного языка на другой. Учитывай контекст и целевую аудиторию, чтобы сохранить смысл и эмоциональную окраску оригинала. При необходимости предлагай несколько вариантов перевода. ПИШИ ВСЕГДА ПО РУССКИ' },
];


let dialogues = [];
let currentDialogueId = null;
let totalRequests = 0;
let todayRequests = 0;
let lastRequestDate = null;
let currentRoleId = ROLES[0].id;
let currentModelId = MODELS[0].id;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function saveState() {
    localStorage.setItem('menapiState', JSON.stringify({
        dialogues: dialogues,
        currentDialogueId: currentDialogueId,
        totalRequests: totalRequests,
        todayRequests: todayRequests,
        lastRequestDate: lastRequestDate,
        currentRoleId: currentRoleId,
        currentModelId: currentModelId
    }));
}

function loadState() {
    const savedState = localStorage.getItem('menapiState');
    if (savedState) {
        const state = JSON.parse(savedState);
        dialogues = state.dialogues || [];
        totalRequests = state.totalRequests || 0;
        todayRequests = state.todayRequests || 0;
        lastRequestDate = state.lastRequestDate || null;
        currentRoleId = state.currentRoleId || ROLES[0].id;
        const loadedModelId = state.currentModelId;
        const foundModel = MODELS.find(m => m.id === loadedModelId);
        currentModelId = foundModel ? foundModel.id : MODELS[0].id;

        const today = new Date().toISOString().split('T')[0];
        if (lastRequestDate !== today) {
            todayRequests = 0;
            lastRequestDate = today;
        }

        const foundDialogue = dialogues.find(d => d.id === state.currentDialogueId);
        if (dialogues.length === 0 || !foundDialogue) {
             createNewChat(true);
        } else {
            currentDialogueId = state.currentDialogueId;
        }
    } else {
        createNewChat(true);
    }
    if (!currentDialogueId || !dialogues.find(d => d.id === currentDialogueId)) {
         if (dialogues.length > 0) {
             currentDialogueId = dialogues[0].id;
         } else {
             createNewChat(true);
             return;
         }
     }
    saveState();
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatMessageContent(text) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let html = '';
    let lastIndex = 0;
    text.replace(codeBlockRegex, (match, lang, code, offset) => {
        let nonCodePart = text.substring(lastIndex, offset);
        nonCodePart = escapeHTML(nonCodePart);
        nonCodePart = nonCodePart.replace(boldRegex, '<span class="bold-text">$1</span>');
        nonCodePart = nonCodePart.replace(/\n/g, '<br>');
        html += nonCodePart;
        const language = lang || 'code';
        const codeContent = code.trim();
        html += `
            <div class="code-block">
                 <div class="code-block-header">
                    <span class="code-language">${escapeHTML(language)}</span>
                    <button class="copy-button" title="Скопировать код"><i class="fas fa-copy"></i></button>
                </div>
                <pre><code>${escapeHTML(codeContent)}</code></pre>
            </div>
        `;
        lastIndex = offset + match.length;
        return match;
    });
    let remainingPart = text.substring(lastIndex);
    remainingPart = escapeHTML(remainingPart);
    remainingPart = remainingPart.replace(boldRegex, '<span class="bold-text">$1</span>');
    remainingPart = remainingPart.replace(/\n/g, '<br>');
    html += remainingPart;
    return html;
}

function addMessageToChat(text, sender, isThinking = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
    if (isThinking) {
        messageElement.classList.add('thinking');
    }
    const avatarElement = document.createElement('div');
    avatarElement.classList.add('message-avatar');
    avatarElement.textContent = sender === 'user' ? 'Вы' : 'AI';
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    if (isThinking) {
        contentElement.innerHTML = text;
    } else {
        if (sender === 'ai') {
            contentElement.innerHTML = formatMessageContent(text);
        } else {
            contentElement.textContent = text;
            contentElement.innerHTML = contentElement.innerHTML.replace(/\n/g, '<br>');
        }
    }
    messageElement.appendChild(avatarElement);
    messageElement.appendChild(contentElement);
    chatMessagesContainer.appendChild(messageElement);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    if (isThinking) {
        return messageElement;
    }
}

function updateMessageInChatElement(messageElement, newText) {
     if (messageElement && messageElement.classList.contains('thinking')) {
         messageElement.classList.remove('thinking');
         const contentElement = messageElement.querySelector('.message-content');
         if (contentElement) {
             contentElement.innerHTML = formatMessageContent(newText);
         }
         chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
     }
}

function removeMessageFromChatElement(messageElement) {
    if (messageElement && messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
    }
}

function renderMessages(dialogueId) {
    chatMessagesContainer.innerHTML = '';
    const dialogue = dialogues.find(d => d.id === dialogueId);
    if (!dialogue) {
        addMessageToChat('Ошибка: Диалог не найден.', 'ai');
        return;
    }
    if (dialogue.messages.length === 0) {
        addMessageToChat('Задавай свои вопросы а я помогу вам на них ответить.', 'ai');
    } else {
        dialogue.messages.forEach(msg => {
            addMessageToChat(msg.text, msg.sender);
        });
    }
}

function renderChatList() {
    chatList.innerHTML = '';
    if (dialogues.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.classList.add('chat-item', 'empty');
        emptyItem.textContent = 'Нет диалогов';
        chatList.appendChild(emptyItem);
        return;
    }
    dialogues.forEach(dialogue => {
        const listItem = document.createElement('li');
        listItem.classList.add('chat-item');
        if (dialogue.id === currentDialogueId) {
            listItem.classList.add('active');
        }
        listItem.dataset.dialogueId = dialogue.id;
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-title');
        const firstUserMessage = dialogue.messages.find(msg => msg.sender === 'user');
        titleSpan.textContent = dialogue.title || (firstUserMessage ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') : 'Новый диалог');
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('chat-item-actions');
        const deleteIcon = document.createElement('i');
        deleteIcon.classList.add('fas', 'fa-trash-alt');
        deleteIcon.title = 'Удалить диалог';
        deleteIcon.dataset.action = 'delete';
        actionsDiv.appendChild(deleteIcon);
        listItem.appendChild(titleSpan);
        listItem.appendChild(actionsDiv);
        chatList.appendChild(listItem);
    });
}

function renderRolesDropdown() {
    roleSelectDropdown.innerHTML = '';
    ROLES.forEach(role => {
        const roleItem = document.createElement('div');
        roleItem.classList.add('dropdown-item');
        if (role.id === currentRoleId) {
            roleItem.classList.add('active');
        }
        roleItem.dataset.roleId = role.id;
        roleItem.textContent = role.name;
        roleSelectDropdown.appendChild(roleItem);
    });
    updateSelectedRoleName();
}

function updateSelectedRoleName() {
    const selectedRole = ROLES.find(role => role.id === currentRoleId);
    selectedRoleNameSpan.textContent = selectedRole ? selectedRole.name : 'Неизвестная роль';
}

function switchRole(roleId) {
    if (currentRoleId === roleId) {
        return;
    }
    currentRoleId = roleId;
    saveState();
    renderRolesDropdown();
}

function renderModelsDropdown() {
    modelSelectDropdown.innerHTML = '';
    MODELS.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.classList.add('dropdown-item');
        if (model.id === currentModelId) {
            modelItem.classList.add('active');
        }
        modelItem.dataset.modelId = model.id;
        modelItem.textContent = model.name;
        modelSelectDropdown.appendChild(modelItem);
    });
    updateSelectedModelName();
}

function updateSelectedModelName() {
    const selectedModel = MODELS.find(model => model.id === currentModelId);
    selectedModelNameSpan.textContent = selectedModel ? selectedModel.name : 'Неизвестная модель';
}

function switchModel(modelId) {
    if (currentModelId === modelId) {
        return;
    }
    currentModelId = modelId;
    saveState();
    renderModelsDropdown();
}


function updateCountersUI() {
    totalRequestsSpan.textContent = totalRequests;
    todayRequestsSpan.textContent = todayRequests;
}

function createNewChat(activateAndSave = true) {
    const newId = generateUUID();
    const newDialogue = {
        id: newId,
        title: '',
        messages: []
    };
    dialogues.unshift(newDialogue);
    if (activateAndSave) {
        currentDialogueId = newId;
        saveState();
        renderChatList();
        renderMessages(currentDialogueId);
    }
}

function switchChat(dialogueId) {
    if (currentDialogueId === dialogueId) {
        return;
    }
    currentDialogueId = dialogueId;
    saveState();
    renderChatList();
    renderMessages(currentDialogueId);
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
}

function deleteChat(dialogueId) {
    const index = dialogues.findIndex(d => d.id === dialogueId);
    if (index === -1) return;
    dialogues.splice(index, 1);
    if (dialogues.length === 0) {
        createNewChat(true);
    } else if (currentDialogueId === dialogueId) {
        currentDialogueId = dialogues[0].id;
        saveState();
        renderChatList();
        renderMessages(currentDialogueId);
    } else {
        saveState();
        renderChatList();
    }
}

function clearAllChats() {
    if (confirm('Вы действительно хотите очистить ВСЕ диалоги? Это действие нельзя отменить.')) {
        dialogues = [];
        createNewChat(true);
        updateCountersUI();
        saveState();
    }
}

async function sendMessage() {
    const userMessageText = messageInput.value.trim();
    if (!userMessageText) {
        return;
    }

    const currentDialogue = dialogues.find(d => d.id === currentDialogueId);
    if (!currentDialogue) {
        addMessageToChat('Ошибка: Текущий диалог не найден.', 'ai');
        saveState();
        return;
    }

    addMessageToChat(userMessageText, 'user');
    currentDialogue.messages.push({ text: userMessageText, sender: 'user' });
    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    const thinkingMessageElement = addMessageToChat('<i class="fas fa-spinner fa-spin"></i> Печатает...', 'ai', true);

    try {
        const selectedModel = MODELS.find(model => model.id === currentModelId);
        if (!selectedModel) {
             throw new Error('Выбранная модель не найдена.');
        }

        const selectedRole = ROLES.find(role => role.id === currentRoleId);
        const systemInstruction = selectedRole ? selectedRole.prompt : '';

        const requestBody = selectedModel.requestFormatter(currentDialogue.messages, systemInstruction);

        const headers = {
            'Content-Type': 'application/json',
        };
        if (selectedModel.apiKey) {
             if (selectedModel.apiType === 'google') {
                // API Key is already in the endpoint for Google
             } else if (selectedModel.apiType === 'openrouter') {
                 headers['Authorization'] = `Bearer ${selectedModel.apiKey}`;
             }
        }


        const response = await fetch(selectedModel.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            removeMessageFromChatElement(thinkingMessageElement);
            const errorData = await response.json();
            console.error('API HTTP Ошибка:', response.status, response.statusText, errorData);
            let errorMsg = `HTTP Ошибка API: ${response.status} ${response.statusText}.`;
            if (errorData && errorData.error && errorData.error.message) {
                errorMsg += ` Детали: ${errorData.error.message}`;
            } else if (errorData && errorData.message) {
                 errorMsg += ` Детали: ${errorData.message}`;
            }
            addMessageToChat(errorMsg, 'ai');
        } else {
             if (selectedModel.supportsStreaming && response.body) {
                 let aiResponseText = '';
                 const reader = response.body.getReader();
                 const decoder = new TextDecoder('utf-8');

                 while (true) {
                     const { done, value } = await reader.read();
                     if (done) {
                         break;
                     }
                     const chunk = decoder.decode(value, { stream: true });
                     const lines = chunk.split('\n').filter(line => line.trim() !== '');

                     for (const line of lines) {
                        if (line.startsWith('data: ')) {
                           const data = line.substring(6);
                           if (data === '[DONE]') {
                              break;
                           }
                           try {
                               const json = JSON.parse(data);
                               if (json.choices && json.choices.length > 0) {
                                   const content = json.choices[0].delta.content || '';
                                   if (content) {
                                       aiResponseText += content;
                                       updateMessageInChatElement(thinkingMessageElement, aiResponseText);
                                   }
                               }
                           } catch (e) {
                               console.error('Ошибка парсинга JSON чанка:', e, data);
                           }
                        }
                     }
                 }
                removeMessageFromChatElement(thinkingMessageElement);
                addMessageToChat(aiResponseText, 'ai'); // Add final message after streaming
                currentDialogue.messages.push({ text: aiResponseText, sender: 'ai' });

             } else {
                 const data = await response.json();
                 removeMessageFromChatElement(thinkingMessageElement);
                 console.log('API Response data:', data);
                 let aiResponseText = 'Не удалось получить ответ от AI.';

                 if (selectedModel.apiType === 'google') {
                     if (data.candidates && data.candidates.length > 0 &&
                         data.candidates[0].content && data.candidates[0].content.parts &&
                         data.candidates[0].content.parts.length > 0 && data.candidates[0].content.parts[0].text) {
                         aiResponseText = data.candidates[0].content.parts[0].text;
                         addMessageToChat(aiResponseText, 'ai');
                         currentDialogue.messages.push({ text: aiResponseText, sender: 'ai' });
                     } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                         let blockReason = data.promptFeedback.blockReason;
                         let safetyRatings = data.promptFeedback.safetyRatings;
                         let blockMsg = `Ваш запрос был заблокирован из-за: ${blockReason}.`;
                         if (safetyRatings && safetyRatings.length > 0) {
                             blockMsg += ' Причины: ' + safetyRatings.map(r => `${r.category} (${r.probability})`).join(', ');
                         }
                         addMessageToChat(blockMsg, 'ai');
                     } else {
                         console.error('Неожиданная структура ответа Google API:', data);
                         addMessageToChat('Получен неожиданный ответ от AI (Google). Проверьте консоль браузера.', 'ai');
                     }
                 } else if (selectedModel.apiType === 'openrouter') {
                      // If not streaming, handle non-streaming response structure
                      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                         aiResponseText = data.choices[0].message.content;
                         addMessageToChat(aiResponseText, 'ai');
                         currentDialogue.messages.push({ text: aiResponseText, sender: 'ai' });
                      } else {
                         console.error('Неожиданная структура ответа OpenRouter API (не-стрим):', data);
                         addMessageToChat('Получен неожиданный ответ от AI (OpenRouter, не-стрим). Проверьте консоль браузера.', 'ai');
                      }
                 } else {
                      console.error('Неизвестный тип API:', selectedModel.apiType);
                      addMessageToChat('Неизвестный тип API модели.', 'ai');
                 }
             }

            if (!currentDialogue.title && currentDialogue.messages.length > 0 && currentDialogue.messages[0].sender === 'user') {
                currentDialogue.title = currentDialogue.messages[0].text.substring(0, 30) + (currentDialogue.messages[0].text.length > 30 ? '...' : '');
                renderChatList();
            }

            totalRequests++;
            const today = new Date().toISOString().split('T')[0];
            if (lastRequestDate !== today) {
                todayRequests = 1;
                lastRequestDate = today;
            } else {
                todayRequests++;
            }
            updateCountersUI();
        }

        saveState();

    } catch (error) {
        console.error('Произошла ошибка:', error);
        removeMessageFromChatElement(thinkingMessageElement);
        const errorMsg = `Произошла ошибка: ${error.message || 'Неизвестная ошибка'}. Проверьте консоль браузера (F12).`;
        addMessageToChat(errorMsg, 'ai');
        saveState();
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
        renderChatList();
    }
}


sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

newChatButton.addEventListener('click', () => {
    createNewChat(true);
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
});

clearChatsButton.addEventListener('click', () => {
    clearAllChats();
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
});

chatList.addEventListener('click', (event) => {
    const listItem = event.target.closest('.chat-item');
    if (!listItem || !listItem.dataset.dialogueId) return;
    const dialogueId = listItem.dataset.dialogueId;
    const target = event.target;
    if (target.classList.contains('fa-trash-alt')) {
        if (confirm('Вы действительно хотите удалить этот диалог?')) {
            deleteChat(dialogueId);
        }
    } else {
        switchChat(dialogueId);
    }
});

roleSelect.addEventListener('click', (event) => {
    event.stopPropagation();
    roleSelectDropdown.style.display = roleSelectDropdown.style.display === 'block' ? 'none' : 'block';
    modelSelectDropdown.style.display = 'none';
});

roleSelectDropdown.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item');
    if (item && item.dataset.roleId) {
        switchRole(item.dataset.roleId);
        roleSelectDropdown.style.display = 'none';
    }
});

modelSelect.addEventListener('click', (event) => {
    event.stopPropagation();
    modelSelectDropdown.style.display = modelSelectDropdown.style.display === 'block' ? 'none' : 'block';
    roleSelectDropdown.style.display = 'none';
});

modelSelectDropdown.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item');
    if (item && item.dataset.modelId) {
        switchModel(item.dataset.modelId);
        modelSelectDropdown.style.display = 'none';
    }
});


document.addEventListener('click', (event) => {
    if (!roleSelect.contains(event.target)) {
        roleSelectDropdown.style.display = 'none';
    }
    if (!modelSelect.contains(event.target)) {
         modelSelectDropdown.style.display = 'none';
    }
});

chatMessagesContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('copy-button') || event.target.closest('.copy-button')) {
        const button = event.target.closest('.copy-button');
        const codeBlock = button.closest('.code-block');
        if (codeBlock) {
            const codeElement = codeBlock.querySelector('code');
            if (codeElement) {
                navigator.clipboard.writeText(codeElement.textContent).then(() => {
                    const originalIcon = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.innerHTML = originalIcon;
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Ошибка при копировании текста:', err);
                });
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderChatList();
    if (currentDialogueId) {
        renderMessages(currentDialogueId);
    } else {
        if (dialogues.length > 0) {
            switchChat(dialogues[0].id);
        } else {
            createNewChat(true);
        }
    }
    renderRolesDropdown();
    renderModelsDropdown();
    updateCountersUI();

    burgerButton.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    });
    mobileBurgerButton.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    });
});

