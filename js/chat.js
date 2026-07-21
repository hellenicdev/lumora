(function () {
  let currentRepoId = null;
  let currentSessionId = null;
  let sessions = [];
  let isStreaming = false;

  document.addEventListener('DOMContentLoaded', function () {
    loadRepos();
    loadSessions();

    const chatRepoSelect = document.getElementById('chatRepoSelect');
    if (chatRepoSelect) {
      chatRepoSelect.addEventListener('change', function () {
        currentRepoId = this.value;
        loadSessions();
      });
    }

    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) newChatBtn.addEventListener('click', createNewSession);

    document.querySelectorAll('.chat-suggestion').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
          chatInput.value = this.dataset.q;
          sendMessage();
        }
      });
    });

    const input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
      });
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  });

  async function loadRepos() {
    try {
      const data = await apiRequest('/repositories');
      const repos = data.data.repositories || [];
      const select = document.getElementById('chatRepoSelect');
      if (!select) return;
      repos.forEach(function (r) {
        const opt = document.createElement('option');
        opt.value = r._id;
        opt.textContent = r.fullName || r.name;
        select.appendChild(opt);
      });
    } catch {
      showToast('Failed to load repositories', 'error');
    }
  }

  async function loadSessions() {
    const list = document.getElementById('sessionList');
    if (!list) return;
    if (!currentRepoId) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px">Select a repository first.</p>';
      return;
    }

    try {
      const data = await apiRequest('/chat/sessions?repositoryId=' + currentRepoId);
      sessions = data.data.sessions || [];

      if (sessions.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px">No chats yet. Start a new one.</p>';
        return;
      }

      list.innerHTML = sessions.map(function (s) {
        return '<div class="chat-session-item' + (s._id === currentSessionId ? ' active' : '') + '" data-id="' + s._id + '">' +
          '<div class="chat-session-item-title">' + (s.title || 'New Chat') + '</div>' +
          '<div class="chat-session-item-meta">' + new Date(s.updatedAt || s.createdAt).toLocaleDateString() + '</div>' +
          '</div>';
      }).join('');

      list.querySelectorAll('.chat-session-item').forEach(function (item) {
        item.addEventListener('click', function () {
          loadSession(this.dataset.id);
        });
      });
    } catch {
      showToast('Failed to load chat sessions', 'error');
    }
  }

  async function loadSession(sessionId) {
    currentSessionId = sessionId;
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    const chatEmpty = document.getElementById('chatEmpty');
    const chatSuggestions = document.getElementById('chatSuggestions');
    if (chatEmpty) chatEmpty.style.display = 'none';
    if (chatSuggestions) chatSuggestions.style.display = 'none';

    try {
      const data = await apiRequest('/chat/session/' + sessionId);
      const messages = data.data.messages || [];

      messagesEl.innerHTML = messages.map(function (m) {
        return renderMessage(m);
      }).join('');

      loadSessions();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch {
      showToast('Failed to load messages', 'error');
    }
  }

  async function createNewSession() {
    if (!currentRepoId) {
      showToast('Select a repository first.', 'error');
      return;
    }

    try {
      const data = await apiRequest('/chat/session', {
        method: 'POST',
        body: { repositoryId: currentRepoId },
      });
      currentSessionId = data.data.session._id;
      loadSession(currentSessionId);
    } catch (err) {
      showToast('Failed to create chat: ' + err.message, 'error');
    }
  }

  async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content || isStreaming) return;

    if (!currentRepoId) {
      showToast('Select a repository first.', 'error');
      return;
    }

    if (!currentSessionId) {
      try {
        const data = await apiRequest('/chat/session', {
          method: 'POST',
          body: { repositoryId: currentRepoId, title: content.slice(0, 50) },
        });
        currentSessionId = data.data.session._id;
        loadSessions();
      } catch (err) {
        showToast('Failed to create chat: ' + err.message, 'error');
        return;
      }
    }

    input.value = '';
    input.style.height = 'auto';

    const chatEmpty = document.getElementById('chatEmpty');
    const chatSuggestions = document.getElementById('chatSuggestions');
    if (chatEmpty) chatEmpty.style.display = 'none';
    if (chatSuggestions) chatSuggestions.style.display = 'none';

    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    messagesEl.insertAdjacentHTML('beforeend', renderMessage({
      role: 'user',
      content: content,
    }));

    const typingId = 'typing-' + Date.now();
    messagesEl.insertAdjacentHTML('beforeend', '<div class="chat-message assistant" id="' + typingId + '">' +
      '<div class="chat-message-avatar">L</div>' +
      '<div class="chat-message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>');

    messagesEl.scrollTop = messagesEl.scrollHeight;
    isStreaming = true;

    try {
      const apiBase = (typeof LUMORA_CONFIG !== 'undefined' && LUMORA_CONFIG.API_BASE)
        ? LUMORA_CONFIG.API_BASE
        : null;
      if (!apiBase) {
        throw new Error('API base URL not configured');
      }

      const response = await fetch(apiBase + '/chat/session/' + currentSessionId + '/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAccessToken(),
        },
        body: JSON.stringify({ content }),
      });

      if (!response.body) {
        throw new Error('Streaming not supported by server');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullContent += data.content;
                updateTypingMessage(typingId, fullContent);
              }
            } catch (parseErr) {
              console.error('SSE parse error:', parseErr, 'line:', line);
              updateTypingMessage(typingId, fullContent + '\n\n[Message truncated due to parse error]');
            }
          }
        }
      }

      updateTypingMessage(typingId, fullContent);
    } catch (err) {
      const el = document.getElementById(typingId);
      if (el) {
        el.querySelector('.chat-message-content').innerHTML = '<p style="color:var(--error)">Error: ' + err.message + '</p>';
      }
    } finally {
      isStreaming = false;
    }
  }

  function renderMessage(msg) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    const avatar = role === 'user' ? 'U' : 'L';
    const content = escapeHtml(msg.content);
    const sources = msg.sources && msg.sources.length > 0
      ? '<div class="chat-sources">' + msg.sources.map(function (s) {
          return '<span class="chat-source">' + s.file + '</span>';
        }).join('') + '</div>'
      : '';

    return '<div class="chat-message ' + role + '">' +
      '<div class="chat-message-avatar">' + avatar + '</div>' +
      '<div class="chat-message-content">' + renderChatMarkdown(content) + sources + '</div></div>';
  }

  function updateTypingMessage(id, content) {
    const el = document.getElementById(id);
    if (!el) return;
    const contentEl = el.querySelector('.chat-message-content');
    if (!contentEl) return;
    contentEl.innerHTML = renderChatMarkdown(escapeHtml(content));
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function renderChatMarkdown(text) {
    let html = text;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
