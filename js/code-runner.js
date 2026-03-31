/**
 * Hexo Code Runner 插件 v2
 * 博客代码块一键运行功能
 * 支持 Go, Python, JS, Java, C/C++, Rust, TS 等 40+ 语言
 * 后端: Piston API (免费开源)
 */

'use strict';

const PistonAPI = 'https://emkc.org/api/v2/piston/execute';

const LANG_MAP = {
  go:'go', golang:'go', python:'python', py:'python', python3:'python',
  javascript:'javascript', js:'javascript', nodejs:'javascript',
  typescript:'typescript', ts:'typescript', java:'java', c:'c',
  cpp:'c++', 'c++':'c++', rust:'rust', rs:'rust', ruby:'ruby', rb:'ruby',
  php:'php', swift:'swift', kotlin:'kotlin', kt:'kotlin', scala:'scala',
  r:'r', shell:'bash', bash:'bash', sh:'bash', lua:'lua', perl:'perl',
  sql:'sql', mysql:'sql', dart:'dart', csharp:'csharp', 'c#':'csharp',
  fsharp:'fsharp', haskell:'haskell', lua:'lua', nim:'nim', objectivec:'objective-c',
  pascal:'pascal', sml:'sml', tcl:'tcl',
};

async function runCode(lang, code, stdin) {
  const mappedLang = LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
  try {
    const res = await fetch(PistonAPI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: mappedLang, version: '*', files: [{ content: code }], stdin: stdin || '' }),
    });
    const data = await res.json();
    if (data.code !== 0 && data.message) return { ok: false, output: data.message, type: 'API Error' };
    const run = data.run || {};
    const compile = data.compile || {};
    const compileOutput = compile.output || '';
    const runOutput = run.output || '';
    const stderr = run.stderr || '';
    return {
      ok: run.exitCode === 0 || run.signal === undefined,
      output: compileOutput + runOutput,
      stderr: stderr,
      exitCode: run.exitCode,
      runtime: run.signal ? `signal: ${run.signal}` : `exited in ${run.cpu_time || '?'}ms`,
    };
  } catch (e) {
    return { ok: false, output: e.message, type: 'Network Error' };
  }
}

// ============ UI ============

const CSS = `
#hcr-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99998;
  display: none; transition: opacity 0.2s;
}
#hcr-overlay.show { display: block; }
#hcr-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: min(90vw, 640px); max-height: 80vh; background: #1e1e2e; color: #cdd6f4;
  z-index: 99999; border-radius: 12px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  display: none; flex-direction: column;
  font-family: 'JetBrains Mono','Fira Code','Consolas',monospace; font-size: 13px;
}
#hcr-panel.show { display: flex; }
#hcr-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; background: #181825; border-bottom: 1px solid #313244;
}
#hcr-header h3 { margin: 0; font-size: 15px; color: #cba6f7; font-weight: 600; }
#hcr-close { background: none; border: none; color: #6c7086; font-size: 22px; cursor: pointer; }
#hcr-close:hover { color: #f38ba8; }
#hcr-meta { padding: 8px 20px; background: #11111b; border-bottom: 1px solid #313244; font-size: 12px; color: #a6adc8; display: flex; gap: 12px; align-items: center; }
#hcr-meta .badge { background: #313244; padding: 2px 10px; border-radius: 4px; color: #89b4fa; font-weight: 600; }
#hcr-status { padding: 8px 20px; font-size: 12px; }
#hcr-status.ok { color: #a6e3a1; }
#hcr-status.err { color: #f38ba8; }
#hcr-status.run { color: #f9e2af; }
.spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #313244; border-top-color: #f9e2af; border-radius: 50%; animation: hcr-spin .6s linear infinite; }
@keyframes hcr-spin { to { transform: rotate(360deg); } }
#hcr-output {
  flex: 1; overflow: auto; padding: 14px 20px; white-space: pre-wrap; word-break: break-all; line-height: 1.6; min-height: 100px;
}
#hcr-stdin-area { padding: 10px 20px; border-top: 1px solid #313244; display: none; }
#hcr-stdin-area textarea {
  width: 100%; min-height: 50px; max-height: 100px; background: #11111b; color: #cdd6f4;
  border: 1px solid #313244; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; resize: vertical; outline: none; box-sizing: border-box;
}
#hcr-stdin-area textarea:focus { border-color: #89b4fa; }
#hcr-actions { padding: 10px 20px; border-top: 1px solid #313244; display: flex; gap: 8px; }
#hcr-actions button { flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
#hcr-run { background: #a6e3a1; color: #1e1e2e; }
#hcr-run:hover { background: #94e2d5; }
#hcr-run:disabled { opacity: .5; cursor: not-allowed; }
#hcr-copy { background: #313244; color: #cdd6f4; }
#hcr-copy:hover { background: #45475a; }

/* Light theme */
html[data-theme=light] #hcr-panel { background: #fff; color: #4c4f69; box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
html[data-theme=light] #hcr-header { background: #eff1f5; border-color: #ccd0da; }
html[data-theme=light] #hcr-header h3 { color: #8839ef; }
html[data-theme=light] #hcr-meta { background: #e6e9ef; border-color: #ccd0da; color: #5c5f77; }
html[data-theme=light] #hcr-meta .badge { background: #ccd0da; color: #8839ef; }
html[data-theme=light] #hcr-output { background: #fff; }
html[data-theme=light] #hcr-stdin-area textarea { background: #eff1f5; color: #4c4f69; border-color: #ccd0da; }
html[data-theme=light] #hcr-actions { border-color: #ccd0da; }
html[data-theme=light] #hcr-copy { background: #ccd0da; color: #4c4f69; }
`;

function injectStyles() {
  if (document.getElementById('hcr-styles')) return;
  const s = document.createElement('style');
  s.id = 'hcr-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function createUI() {
  if (document.getElementById('hcr-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="hcr-overlay"></div>
    <div id="hcr-panel">
      <div id="hcr-header"><h3>▶ Code Runner</h3><button id="hcr-close">✕</button></div>
      <div id="hcr-meta"><span>Language:</span><span class="badge" id="hcr-lang">-</span></div>
      <div id="hcr-status"></div>
      <div id="hcr-output"></div>
      <div id="hcr-stdin-area"><textarea id="hcr-stdin" placeholder="输入 stdin（可选）"></textarea></div>
      <div id="hcr-actions">
        <button id="hcr-run">▶ 运行</button>
        <button id="hcr-copy">📋 复制输出</button>
      </div>
    </div>
  `);
  document.getElementById('hcr-close').onclick = closePanel;
  document.getElementById('hcr-overlay').onclick = closePanel;
  document.getElementById('hcr-run').onclick = doRun;
  document.getElementById('hcr-copy').onclick = doCopy;
}

let currentLang = '', currentCode = '';

function openPanel(lang, code) {
  currentLang = lang;
  currentCode = code;
  document.getElementById('hcr-lang').textContent = lang;
  document.getElementById('hcr-output').textContent = '';
  document.getElementById('hcr-status').textContent = '';
  document.getElementById('hcr-status').className = '';
  document.getElementById('hcr-run').disabled = false;
  document.getElementById('hcr-stdin-area').style.display = 'block';
  document.getElementById('hcr-stdin').value = '';
  document.getElementById('hcr-panel').classList.add('show');
  document.getElementById('hcr-overlay').classList.add('show');
}

function closePanel() {
  document.getElementById('hcr-panel').classList.remove('show');
  document.getElementById('hcr-overlay').classList.remove('show');
}

async function doRun() {
  const btn = document.getElementById('hcr-run');
  const status = document.getElementById('hcr-status');
  const output = document.getElementById('hcr-output');
  btn.disabled = true;
  status.className = 'run';
  status.innerHTML = '<span class="spinner"></span> 正在运行...';
  output.textContent = '';

  const result = await runCode(currentLang, currentCode, document.getElementById('hcr-stdin').value);
  btn.disabled = false;
  if (result.ok) {
    status.className = 'ok';
    status.textContent = `✅ 运行成功 · ${result.runtime}`;
  } else {
    status.className = 'err';
    status.textContent = `❌ ${result.type || 'Error'}`;
  }
  output.textContent = result.output + (result.stderr ? '\n\n[stderr]\n' + result.stderr : '');
  output.scrollTop = 0;
}

function doCopy() {
  const text = document.getElementById('hcr-output').textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const b = document.getElementById('hcr-copy');
    b.textContent = '✅ 已复制';
    setTimeout(() => b.textContent = '📋 复制输出', 1500);
  });
}

// ============ Detect language from Butterfly figure.highlight ============

function getLangFromFigure(figure) {
  const cls = figure.className || '';
  // Butterfly: class="highlight go" or class="highlight language-go"
  const m = cls.match(/highlight\s+(?:language-)?(\w+)/);
  return m ? m[1] : '';
}

// ============ Extract clean code text from highlighted HTML ============

function extractCode(figure) {
  // Try to find td.code > pre (Butterfly table layout)
  const tdCode = figure.querySelector('td.code');
  if (tdCode) {
    const pre = tdCode.querySelector('pre');
    if (pre) return pre.textContent;
  }
  // Fallback: figure > pre > code
  const pre = figure.querySelector('pre');
  if (pre) return pre.textContent;
  // Last resort: figure itself
  return figure.textContent;
}

// ============ Add run buttons ============

function addRunButtons() {
  document.querySelectorAll('figure.highlight').forEach(figure => {
    if (figure.querySelector('.hcr-run-btn')) return;
    const lang = getLangFromFigure(figure);
    if (!lang || !LANG_MAP[lang.toLowerCase()]) return;

    const btn = document.createElement('button');
    btn.className = 'hcr-run-btn';
    btn.textContent = '▶ Run';
    btn.style.cssText = 'position:relative;float:right;background:linear-gradient(135deg,#a6e3a1,#94e2d5);color:#1e1e2e;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;z-index:10;font-family:system-ui,sans-serif;margin:2px 0 0 8px;';
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel(lang, extractCode(figure));
    };

    // Insert into Butterfly's code-header or as first child
    const header = figure.querySelector('.code-header');
    if (header) {
      header.appendChild(btn);
    } else {
      // No header, create a small toolbar
      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'display:flex;justify-content:flex-end;padding:2px 8px;background:#181825;';
      toolbar.appendChild(btn);
      figure.insertBefore(toolbar, figure.firstChild);
    }
  });
}

// ============ Init ============

function init() {
  injectStyles();
  createUI();
  addRunButtons();
  // Re-scan on DOM changes
  const obs = new MutationObserver(() => setTimeout(addRunButtons, 300));
  obs.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
