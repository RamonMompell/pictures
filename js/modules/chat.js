/* ============================================================
   Clinia — Internal chat per patient
   With @-mention autocomplete and real-time refresh.
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtDateTime, timeAgo, initials, toast } = UI;

  function render(root, patientId) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.CHAT_USE)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso al chat</h3></div>';
      return;
    }
    root.innerHTML = '';
    root.appendChild(
      el('div', { class: 'card', style: { padding: '0', overflow: 'hidden' } }, [
        buildChatBox(patientId),
      ])
    );
  }

  function buildChatBox(patientId) {
    const wrap = el('div', { class: 'chat-wrap' });
    const messages = el('div', { class: 'chat-messages' });
    const input = el('input', {
      type: 'text',
      placeholder: 'Escribe un mensaje… usa @ para mencionar a un compañero',
      autocomplete: 'off',
    });
    const sendBtn = el('button', { class: 'btn btn-primary' }, 'Enviar');
    const inputBar = el('div', { class: 'chat-input', style: { position: 'relative' } }, [input, sendBtn]);
    const suggestions = el('div', { class: 'mention-suggestions hide' });
    inputBar.appendChild(suggestions);
    wrap.appendChild(messages);
    wrap.appendChild(inputBar);

    function refresh() {
      messages.innerHTML = '';
      const u = Auth.currentUser();
      const list = DB.chatMessages
        .where((m) => m.patientId === patientId)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      if (list.length === 0) {
        messages.appendChild(
          el('div', { class: 'empty' }, [
            el('div', { class: 'icon' }, '💬'),
            el('h4', {}, 'Sin mensajes todavía'),
            el('p', {}, 'Empieza la conversación con tu equipo sobre este paciente.'),
          ])
        );
      }
      let lastDate = '';
      list.forEach((m) => {
        const author = DB.users.get(m.userId);
        const mine = m.userId === u.id;
        const dateStr = new Date(m.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        if (dateStr !== lastDate) {
          messages.appendChild(el('div', { class: 'chat-day-sep' }, dateStr));
          lastDate = dateStr;
        }
        const bubble = el('div', { class: 'chat-msg' + (mine ? ' mine' : '') });
        bubble.appendChild(el('div', { class: 'chat-msg-author' }, [
          el('div', { class: 'avatar-sm' }, initials(author?.name || 'U')),
          el('span', {}, author?.name || 'Usuario'),
          el('span', { class: 'chat-msg-time' }, timeAgo(m.createdAt)),
        ]));
        const body = el('div', { class: 'chat-msg-body' });
        body.innerHTML = highlightMentions(escapeHtml(m.text));
        bubble.appendChild(body);
        messages.appendChild(bubble);
      });
      messages.scrollTop = messages.scrollHeight;
    }

    function highlightMentions(text) {
      return text.replace(/@([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]*)/g, '<span class="mention">@$1</span>');
    }

    // ---- Mention autocomplete ----
    let suggestionState = { open: false, query: '', startPos: 0, selected: 0, candidates: [] };

    function showSuggestions() {
      const allUsers = DB.users.where((u) => u.active && u.id !== Auth.currentUser().id);
      const q = suggestionState.query.toLowerCase();
      const candidates = allUsers
        .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        .slice(0, 6);
      suggestionState.candidates = candidates;
      if (candidates.length === 0) {
        suggestions.classList.add('hide');
        suggestionState.open = false;
        return;
      }
      suggestions.innerHTML = '';
      candidates.forEach((u, idx) => {
        const item = el(
          'div',
          {
            class: 'mention-item' + (idx === suggestionState.selected ? ' active' : ''),
            onClick: () => insertMention(u),
            onMouseEnter: () => {
              suggestionState.selected = idx;
              showSuggestions();
            },
          },
          [
            el('div', { class: 'avatar-sm' }, initials(u.name)),
            el('div', {}, [
              el('div', { style: { fontSize: '12.5px', fontWeight: '600' } }, u.name),
              el('div', { style: { fontSize: '10.5px', color: 'var(--c-text-soft)' } }, (u.roles || [])[0] || ''),
            ]),
          ]
        );
        suggestions.appendChild(item);
      });
      suggestions.classList.remove('hide');
      suggestionState.open = true;
    }

    function insertMention(user) {
      const tokenName = user.name.split(' ')[0];
      const before = input.value.slice(0, suggestionState.startPos);
      const after = input.value.slice(input.selectionStart);
      input.value = before + '@' + tokenName + ' ' + after;
      const pos = (before + '@' + tokenName + ' ').length;
      input.focus();
      input.setSelectionRange(pos, pos);
      suggestions.classList.add('hide');
      suggestionState.open = false;
    }

    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      const before = input.value.slice(0, pos);
      const m = before.match(/@([A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]*)$/);
      if (m) {
        suggestionState.query = m[1];
        suggestionState.startPos = pos - m[0].length;
        suggestionState.selected = 0;
        showSuggestions();
      } else {
        suggestions.classList.add('hide');
        suggestionState.open = false;
      }
    });

    input.addEventListener('keydown', (e) => {
      if (suggestionState.open && suggestionState.candidates.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          suggestionState.selected = (suggestionState.selected + 1) % suggestionState.candidates.length;
          showSuggestions();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          suggestionState.selected = (suggestionState.selected - 1 + suggestionState.candidates.length) % suggestionState.candidates.length;
          showSuggestions();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(suggestionState.candidates[suggestionState.selected]);
          return;
        }
        if (e.key === 'Escape') {
          suggestions.classList.add('hide');
          suggestionState.open = false;
          return;
        }
      }
      if (e.key === 'Enter' && !suggestionState.open) {
        e.preventDefault();
        send();
      }
    });

    function send() {
      const text = input.value.trim();
      if (!text) return;
      const u = Auth.currentUser();
      // Resolve mentions to actual user ids
      const mentions = [];
      const tokens = text.match(/@([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9_-]*)/g) || [];
      tokens.forEach((tk) => {
        const name = tk.slice(1).toLowerCase();
        const target = DB.users.where((usr) => usr.name.toLowerCase().includes(name))[0];
        if (target && !mentions.includes(target.id)) mentions.push(target.id);
      });
      DB.chatMessages.insert({ patientId, userId: u.id, text, mentions });
      Audit.log('chat.message', { targetType: 'patient', targetId: patientId, details: { mentions } });
      mentions.forEach((mid) => {
        if (mid === u.id) return;
        DB.notifications.insert({
          userId: mid,
          type: 'chat_mention',
          text: `${u.name} te ha mencionado en el chat de un paciente`,
          targetUrl: '#/patients/' + patientId + '?tab=chat',
          read: false,
        });
      });
      input.value = '';
      refresh();
    }

    sendBtn.addEventListener('click', send);

    // Auto refresh on cross-tab updates
    DB.Events.on('chat_messages:created', (m) => {
      if (m && m.patientId === patientId) refresh();
    });

    setTimeout(refresh, 0);
    return wrap;
  }

  global.Chat = { render };
})(window);
