/**
 * Hexo Code Runner 插件
 * 
 * 给博客代码块添加"一键运行"功能
 * 支持 Go, Python, JavaScript, Java, C, C++, TypeScript 等 40+ 语言
 * 后端: Piston API (免费，无需 key)
 */

'use strict';

const PistonAPI = 'https://emkc.org/api/v2/piston/execute';

// 支持的语言别名映射
const LANG_MAP = {
  'go': 'go',
  'golang': 'go',
  'python': 'python',
  'py': 'python',
  'python3': 'python',
  'javascript': 'javascript',
  'js': 'javascript',
  'nodejs': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'java': 'java',
  'c': 'c',
  'cpp': 'c++',
  'c++': 'c++',
  'rust': 'rust',
  'rs': 'rust',
  'ruby': 'ruby',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'kt': 'kotlin',
  'scala': 'scala',
  'r': 'r',
  'shell': 'bash',
  'bash': 'bash',
  'sh': 'bash',
  'lua': 'lua',
  'perl': 'perl',
  'sql': 'sql',
  'mysql': 'sql',
};

// 需要输入的语言（默认添加 stdin）
const NEEDS_INPUT_LANGS = new Set(['c', 'c++', 'java', 'kotlin', 'scala', 'r', 'sql', 'mysql']);

function runCode(lang, code, stdin = '') {
  const mappedLang = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
  const body = {
    language: mappedLang,
    version: '*',  // latest
    files: [{ content: code }],
    stdin: stdin || '',
  };

  return fetch(PistonAPI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(r => r.json())
    .then(data => {
      if (data.code !== 0 && data.message) {
        return { success: false, output: data.message, error: data.compile ? 'Compile Error' : 'Runtime Error' };
      }
      return {
        success: true,
        output: (data.run && data.run.output) || (data.compile && data.compile.output) || '(no output)',
        stderr: (data.run && data.run.stderr) || '',
        exitCode: data.run ? data.run.exitCode : 0,
        runtime: data.run ? (data.run.signal ? `signal: ${data.run.signal}` : `exited in ${data.run.runtime || '?'}ms`) : '',
      };
    })
    .catch(err => {
      return { success: false, output: '', error: `Network error: ${err.message}` };
    });
}

// --- UI ---

const STYLE_ID = 'hexo-code-runner-style';

const CSS = `
#hexo-code-runner-panel {
  position: fixed;
  top: 0;
  right: -420px;
  width: 400px;
  height: 100vh;
  background: #1e1e2e;
  color: #cdd6f4;
  z-index: 99999;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  transition: right 0.3s ease;
  display: flex;
  flex-direction: column;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}
#hexo-code-runner-panel.open { right: 0; }
#hexo-code-runner-panel .panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #181825;
  border-bottom: 1px solid #313244;
}
#hexo-code-runner-panel .panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: #cba6f7;
  font-weight: 600;
}
#hexo-code-runner-panel .panel-header .close-btn {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
#hexo-code-runner-panel .panel-header .close-btn:hover { color: #f38ba8; }
#hexo-code-runner-panel .panel-lang {
  padding: 8px 16px;
  background: #11111b;
  color: #a6adc8;
  font-size: 12px;
  border-bottom: 1px solid #313244;
  display: flex;
  align-items: center;
  gap: 8px;
}
#hexo-code-runner-panel .panel-lang .lang-badge {
  background: #313244;
  padding: 2px 8px;
  border-radius: 4px;
  color: #89b4fa;
  font-weight: 600;
}
#hexo-code-runner-panel .panel-status {
  padding: 6px 16px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
#hexo-code-runner-panel .panel-status.success { color: #a6e3a1; }
#hexo-code-runner-panel .panel-status.error { color: #f38ba8; }
#hexo-code-runner-panel .panel-status.running { color: #f9e2af; }
#hexo-code-runner-panel .panel-status .spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #313244;
  border-top-color: #f9e2af;
  border-radius: 50%;
  animation: hcr-spin 0.6s linear infinite;
}
@keyframes hcr-spin { to { transform: rotate(360deg); } }
#hexo-code-runner-panel .panel-output {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  background: #1e1e2e;
}
#hexo-code-runner-panel .panel-output .output-line { margin: 0; }
#hexo-code-runner-panel .panel-stdin {
  padding: 8px 16px;
  border-top: 1px solid #313244;
}
#hexo-code-runner-panel .panel-stdin textarea {
  width: 100%;
  min-height: 60px;
  max-height: 120px;
  background: #11111b;
  color: #cdd6f4;
  border: 1px solid #313244;
  border-radius: 6px;
  padding: 8px;
  font-family: inherit;
  font-size: 12px;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
#hexo-code-runner-panel .panel-stdin textarea:focus { border-color: #89b4fa; }
#hexo-code-runner-panel .panel-actions {
  padding: 8px 16px;
  border-top: 1px solid #313244;
  display: flex;
  gap: 8px;
}
#hexo-code-runner-panel .panel-actions button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
#hexo-code-runner-panel .btn-run {
  background: #a6e3a1;
  color: #1e1e2e;
}
#hexo-code-runner-panel .btn-run:hover { background: #94e2d5; }
#hexo-code-runner-panel .btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
#hexo-code-runner-panel .btn-copy {
  background: #313244;
  color: #cdd6f4;
}
#hexo-code-runner-panel .btn-copy:hover { background: #45475a; }

/* Run button on code blocks */
.hcr-run-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 10;
  background: linear-gradient(135deg, #a6e3a1, #94e2d5);
  color: #1e1e2e;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hcr-run-btn:hover { opacity: 1; transform: scale(1.05); box-shadow: 0 2px 8px rgba(166,227,161,0.4); }
.hcr-run-btn svg { width: 12px; height: 12px; }
.hcr-run-btn.running { opacity: 0.5; pointer-events: none; }

/* Light theme support */
[data-theme="light"] #hexo-code-runner-panel,
html.light #hexo-code-runner-panel {
  background: #ffffff;
  color: #4c4f69;
  box-shadow: -4px 0 20px rgba(0,0,0,0.1);
}
[data-theme="light"] #hexo-code-runner-panel .panel-header,
html.light #hexo-code-runner-panel .panel-header { background: #eff1f5; border-color: #ccd0da; }
[data-theme="light"] #hexo-code-runner-panel .panel-header h3,
html.light #hexo-code-runner-panel .panel-header h3 { color: #8839ef; }
[data-theme="light"] #hexo-code-runner-panel .panel-lang,
html.light #hexo-code-runner-panel .panel-lang { background: #e6e9ef; border-color: #ccd0da; color: #5c5f77; }
[data-theme="light"] #hexo-code-runner-panel .panel-lang .lang-badge,
html.light #hexo-code-runner-panel .panel-lang .lang-badge { background: #ccd0da; color: #8839ef; }
[data-theme="light"] #hexo-code-runner-panel .panel-output,
html.light #hexo-code-runner-panel .panel-output { background: #fff; }
[data-theme="light"] #hexo-code-runner-panel .panel-stdin textarea,
html.light #hexo-code-runner-panel .panel-stdin textarea { background: #eff1f5; color: #4c4f69; border-color: #ccd0da; }
[data-theme="light"] #hexo-code-runner-panel .panel-actions,
html.light #hexo-code-runner-panel .panel-actions { border-color: #ccd0da; }
[data-theme="light"] #hexo-code-runner-panel .btn-copy,
html.light #hexo-code-runner-panel .btn-copy { background: #ccd0da; color: #4c4f69; }
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function createPanel() {
  if (document.getElementById('hexo-code-runner-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'hexo-code-runner-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <h3>▶ Code Runner</h3>
      <button class="close-btn" onclick="document.getElementById('hexo-code-runner-panel').classList.remove('open')">✕</button>
    </div>
    <div class="panel-lang">
      <span>Language:</span> <span class="lang-badge" id="hcr-lang">-</span>
    </div>
    <div class="panel-status" id="hcr-status"></div>
    <div class="panel-output" id="hcr-output"></div>
    <div class="panel-stdin" id="hcr-stdin-wrap" style="display:none;">
      <textarea id="hcr-stdin" placeholder="输入（stdin），按 Ctrl+Enter 运行..."></textarea>
    </div>
    <div class="panel-actions">
      <button class="btn-run" id="hcr-run-btn" onclick="hexoCodeRunner.run()">▶ 运行</button>
      <button class="btn-copy" onclick="hexoCodeRunner.copyOutput()">📋 复制输出</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Keyboard shortcut: Ctrl+Enter to run
  document.getElementById('hcr-stdin').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      hexoCodeRunner.run();
    }
  });
}

function addRunButtons() {
  const blocks = document.querySelectorAll('figure.highlight, .code-container pre, pre code');
  
  blocks.forEach(block => {
    if (block.querySelector('.hcr-run-btn')) return;
    if (block.closest('#hexo-code-runner-panel')) return;

    // Make parent position relative
    const container = block.closest('figure') || block.parentElement;
    if (container) container.style.position = 'relative';

    // Detect language
    let lang = '';
    const figure = block.closest('figure');
    if (figure) {
      const classList = figure.className || '';
      const match = classList.match(/language-(\w+)/);
      if (match) lang = match[1];
      const table = figure.querySelector('.code-header');
      if (table) {
        const text = table.textContent || '';
        const langMatch = text.match(/(\w+)/);
        if (langMatch) lang = langMatch[1];
      }
    }
    if (!lang) {
      const classList = block.className || '';
      const match = classList.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    if (!lang || !LANG_MAP[lang.toLowerCase()]) return;

    // Create button
    const btn = document.createElement('button');
    btn.className = 'hcr-run-btn';
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7zM6.38 5.17a.75.75 0 0 1 1.06-1.06l2.5 2.5a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 0 1-1.06-1.06L8.19 7l-1.81-1.83z"/></svg> 运行`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hexoCodeRunner.open(lang, block);
    });

    container.insertBefore(btn, container.firstChild);
  });
}

// Global API
window.hexoCodeRunner = {
  currentLang: '',
  currentCode: '',

  open(lang, block) {
    // Extract code text
    let code = '';
    const codeEl = block.querySelector('code');
    if (codeEl) {
      code = codeEl.textContent;
    } else {
      code = block.textContent;
    }

    this.currentLang = lang;
    this.currentCode = code;

    const panel = document.getElementById('hexo-code-runner-panel');
    document.getElementById('hcr-lang').textContent = lang;
    document.getElementById('hcr-output').textContent = '';
    document.getElementById('hcr-status').textContent = '';
    document.getElementById('hcr-status').className = 'panel-status';

    // Show/hide stdin
    const mappedLang = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
    const stdinWrap = document.getElementById('hcr-stdin-wrap');
    if (NEEDS_INPUT_LANGS.has(mappedLang)) {
      stdinWrap.style.display = 'block';
      document.getElementById('hcr-stdin').value = '';
    } else {
      stdinWrap.style.display = 'none';
    }

    panel.classList.add('open');
    document.getElementById('hcr-run-btn').disabled = false;
  },

  async run() {
    const btn = document.getElementById('hcr-run-btn');
    const status = document.getElementById('hcr-status');
    const output = document.getElementById('hcr-output');
    const stdin = document.getElementById('hcr-stdin').value;

    btn.disabled = true;
    status.className = 'panel-status running';
    status.innerHTML = '<span class="spinner"></span> 正在运行...';
    output.textContent = '';

    const result = await runCode(this.currentLang, this.currentCode, stdin);

    btn.disabled = false;
    if (result.success) {
      status.className = 'panel-status success';
      status.textContent = `✅ 运行成功 · ${result.runtime}`;
      output.textContent = result.output + (result.stderr ? '\n--- stderr ---\n' + result.stderr : '');
    } else if (result.error) {
      status.className = 'panel-status error';
      status.textContent = `❌ ${result.error}`;
      output.textContent = result.output || result.error;
    } else {
      status.className = 'panel-status success';
      status.textContent = '✅ 运行完成';
      output.textContent = result.output || '(no output)';
    }

    // Scroll output to top
    output.scrollTop = 0;
  },

  copyOutput() {
    const output = document.getElementById('hcr-output').textContent;
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      const btn = document.querySelector('.btn-copy');
      btn.textContent = '✅ 已复制';
      setTimeout(() => btn.textContent = '📋 复制输出', 2000);
    });
  }
};

// Initialize
function init() {
  injectStyles();
  createPanel();
  addRunButtons();

  // Re-add buttons when page content changes (SPA-like behavior)
  const observer = new MutationObserver(() => {
    setTimeout(addRunButtons, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Run when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
