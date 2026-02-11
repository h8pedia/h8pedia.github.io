/* eslint-disable */
// @ts-nocheck
// =========================
// APP.JS — Shared utilities and nav for h8pedia
// Depends on: auth.js (Auth)
// =========================

function esc(str) {
  if (!str) return "";
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function stripMarkdown(md) {
  return (md || "")
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/>\s?/g, "")
    .replace(/---/g, "")
    .replace(/\n/g, " ")
    .trim();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    var d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch(e) {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    var d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  } catch(e) {
    return dateStr;
  }
}

function showToast(message, type) {
  var container = document.getElementById("toastContainer");
  if (!container) return;
  var el = document.createElement("div");
  el.className = "toast toast-" + (type || "success");
  el.textContent = message;
  container.appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function renderMarkdown(md) {
  if (!md) return "";
  function censorDollarText(str) {
    if (!str) return "";
    return str.replace(/\$.*?\$/g, "█████");
  }
  
  md = censorDollarText(md);

  var html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:8px 0;">')
    .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\-\s(.+)$/gm, '<li>$1</li>')
    .replace(/^\*\s(.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');

  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  html = html.split('\n').map(function(line) {
    line = line.trim();
    if (!line) return '';
    if (line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<blockquote') || line.startsWith('<ul') || line.startsWith('<li') || line.startsWith('<hr') || line.startsWith('<img')) {
      return line;
    }
    return '<p>' + line + '</p>';
  }).join('\n');

  return html;
}

function buildTOC(html) {
  var headings = [];
  var regex = /<h([23])>(.*?)<\/h\1>/gi;
  var match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ level: parseInt(match[1]), text: match[2] });
  }
  if (headings.length < 2) return "";

  var toc = '<div class="toc"><div class="toc-title">Contents</div><ol>';
  headings.forEach(function(h, i) {
    var id = "section-" + i;
    toc += '<li style="margin-left:' + ((h.level - 2) * 16) + 'px"><a href="#' + id + '">' + h.text + '</a></li>';
  });
  toc += '</ol></div>';

  var idx = 0;
  var updatedHtml = html.replace(/<h([23])>(.*?)<\/h\1>/gi, function(m, level, text) {
    return '<h' + level + ' id="section-' + (idx++) + '">' + text + '</h' + level + '>';
  });

  return { toc: toc, html: updatedHtml };
}

function initNav() {
  var navAuth = document.getElementById("navAuth");
  if (!navAuth) return;

  if (window.Auth && window.Auth.isLoggedIn()) {
    var user = window.Auth.getUser();
    var initial = user.charAt(0).toUpperCase();

    navAuth.innerHTML = `
      <div class="nav-auth">
        <a href="profile.html?user=${encodeURIComponent(user)}" class="nav-user" aria-label="Your profile">
          <span class="nav-avatar">${esc(initial)}</span>${esc(user)}
        </a>
        <a href="#" class="nav-link" onclick="Auth.logout(); return false;">Logout</a>
      </div>
    `;

    window.Auth.isModerator().then(function(isMod) {
      if (isMod) {
        var modLink = document.createElement("a");
        modLink.href = "moderator.html";
        modLink.className = "nav-link";
        modLink.textContent = "Mod Panel";
        navAuth.prepend(modLink);
      }
    });

  } else {
    navAuth.innerHTML =
      '<a href="login.html" class="nav-link">Log in</a>' +
      '<a href="signup.html" class="nav-link active">Sign up</a>';
  }
}


document.addEventListener("DOMContentLoaded", function() {
  var btn = document.getElementById("mobileMenuBtn");
  var nav = document.getElementById("headerNav");
  if (btn && nav) {
    btn.addEventListener("click", function() {
      if (nav.style.display === "flex") {
        nav.style.display = "none";
      } else {
        nav.style.display = "flex";
        nav.style.flexDirection = "column";
        nav.style.position = "absolute";
        nav.style.top = "56px";
        nav.style.right = "16px";
        nav.style.background = "var(--bg-primary)";
        nav.style.border = "1px solid var(--border)";
        nav.style.borderRadius = "8px";
        nav.style.padding = "8px";
        nav.style.boxShadow = "var(--shadow-md)";
        nav.style.zIndex = "200";
      }
    });
  }
});
