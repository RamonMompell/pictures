/* ============================================================
   Clinia — Internal chat per patient
   ============================================================ */

(function (global) {
  const { el, escapeHtml, fmtDateTime, toast } = UI;

  function render(root, patientId) {
    if (!Permissions.can(Auth.currentUser(), Permissions.CAP.CHAT_USE)) {
      root.innerHTML = '<div class="empty"><h3>Sin acceso al chat</h3></div>';
      return;
    }
    root.innerHTML = '';
    const wrap = el('div', { class: 'chat-wrap' });
    const messages = el('div', { class: 'chat-messages' });
    const input = el('input', { type: 'text', placeholder: 'Escribe un mensaje… (usa @nombre para mencionar)' });
    const sendBtn = el('button', { class: 'btn btn-primary' }, 'Enviar');
    const inputBar = el('div', { class: 'chat-input' }, [input, sendBtn]);
    wrap.appendChild(messages);
    wrap.appendChild(inputBar);
    root.appendChild(wrap);

    function refresh() {
      messages.innerHTML = '';
      const u = Auth.currentUser();
      const list = DB.chatMessages
        .where((m) => m.patientId === patientId)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      if (list.length === 0) {
        messages.appendChild(el('div', { class: 'empty' }, 'Aún no hay mensajes.'));
      }
      list.forEach((m) => {
        const author = DB.users.get(m.userId);
        const mine = m.userId === u.id;
        messages.appendChild(
          el('div', { class: 'chat-msg' + (mine ? ' mine' : '') }, [
            el('div', { class: 'author' }, author?.name || 'Usuario'),
            el('div', { html: highlightMentions(escapeHtml(m.text)) }),
            el('div', { class: 'time' }, fmtDateTime(m.createdAt)),
          ])
        );
      });
      // Replace last innerHtml on each message with proper html
      messages.querySelectorAll('.chat-msg').forEach((node, idx) => {
        const m = list[idx];
        if (!m) return;
        const html = highlightMentions(escapeHtml(m.text));
        const target = node.children[1];
        target.innerHTML = html;
      });
      messages.scrollTop = messages.scrollHeight;
    }

    function highlightMentions(text) {
      return text.replace(/@(\w+)/g, '<strong style="color:var(--c-brand)">@$1</strong>');
    }

    function send() {
      const text = input.value.trim();
      if (!text) return;
      const u = Auth.currentUser();
      const mentions = (text.match(/@(\w+)/g) || []).map((s) => s.slice(1));
      DB.chatMessages.insert({ patientId, userId: u.id, text, mentions });
      Audit.log('chat.message', { targetType: 'patient', targetId: patientId });
      // Notify mentioned users
      mentions.forEach((m) => {
        const target = DB.users.where((usr) => usr.name.toLowerCase().includes(m.toLowerCase()))[0];
        if (target && target.id !== u.id) {
          DB.notifications.insert({
            userId: target.id,
            type: 'chat_mention',
            text: `${u.name} te ha mencionado en el chat de un paciente`,
            targetUrl: '#/patients/' + patientId + '?tab=chat',
            read: false,
          });
        }
      });
      input.value = '';
      refresh();
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });

    refresh();
  }

  global.Chat = { render };
})(window);
