'use strict';
// AIRS Demo Hub — 设置面板（并入 demo.html 的「设置」菜单）
// 依赖 demo.js 里的全局：msg、$、esc、show、loadMeta
// 规则：Key 只经 service worker 存进 chrome.storage.local，页面上只显示脱敏后的末 4 位；导出档案不含 Key。

let SET_PROFILES = {};      // id → name
let SET_CUR = 'default';
let SET_NAME_MODE = null;   // 'new' | 'copy' | 'rename'
let SET_LOADED = false;

function setMsg(text, kind) {
  const el = $('#setMsg');
  el.textContent = text || '';
  el.className = 'set-msg ' + (kind || '');
  if (text) setTimeout(() => { if (el.textContent === text) { el.textContent = ''; el.className = 'set-msg'; } }, 5000);
}

// ---------------------------------------------------------------- 档案
async function setLoadProfiles() {
  const r = await msg('list_profiles');
  SET_PROFILES = {};
  for (const p of r.profiles) SET_PROFILES[p.id] = p.name;
  SET_CUR = r.current;
  $('#profileSelect').innerHTML = Object.entries(SET_PROFILES)
    .map(([id, name]) => `<option value="${esc(id)}" ${id === SET_CUR ? 'selected' : ''}>${esc(name)}</option>`).join('');
  $('#pDel').disabled = Object.keys(SET_PROFILES).length <= 1;
  await setLoadProfileData(SET_CUR);
}

$('#profileSelect').onchange = async () => {
  const id = $('#profileSelect').value;
  if (id === SET_CUR) return;
  await msg('switch_profile', { id });
  SET_CUR = id;
  await setLoadProfileData(id);
  loadMeta();
  setMsg(`已切换到「${SET_PROFILES[id]}」`, 'ok');
};

// 新建 / 复制 / 重命名：用行内输入框，不用 prompt() 弹窗
function setAskName(mode, def) {
  SET_NAME_MODE = mode;
  $('#pNameRow').style.display = 'inline-flex';
  $('#pNameInput').value = def;
  $('#pNameInput').focus(); $('#pNameInput').select();
}
$('#pNew').onclick = () => setAskName('new', '新档案');
$('#pCopy').onclick = () => setAskName('copy', (SET_PROFILES[SET_CUR] || '档案') + ' 副本');
$('#pRename').onclick = () => setAskName('rename', SET_PROFILES[SET_CUR] || '');
$('#pNameCancel').onclick = () => { $('#pNameRow').style.display = 'none'; SET_NAME_MODE = null; };
$('#pNameInput').onkeydown = e => { if (e.key === 'Enter') $('#pNameOk').click(); if (e.key === 'Escape') $('#pNameCancel').click(); };
$('#pNameOk').onclick = async () => {
  const name = $('#pNameInput').value.trim();
  if (!name) return;
  if (SET_NAME_MODE === 'rename') {
    await msg('rename_profile', { id: SET_CUR, name });
    setMsg('已重命名', 'ok');
  } else {
    const r = await msg('new_profile', { name, copyFrom: SET_NAME_MODE === 'copy' ? SET_CUR : undefined });
    if (r.error) return setMsg(r.error, 'err');
    await msg('switch_profile', { id: r.id });
    setMsg(SET_NAME_MODE === 'copy' ? '已复制并切换到新档案（Key 需重新填写）' : '已新建并切换（请填写 Gateway 地址和 Key）', 'ok');
  }
  $('#pNameRow').style.display = 'none'; SET_NAME_MODE = null;
  await setLoadProfiles(); loadMeta();
};

// 删除：点两次确认，不用 confirm() 弹窗
let SET_DEL_ARMED = 0;
$('#pDel').onclick = async () => {
  if (Date.now() - SET_DEL_ARMED > 3000) {
    SET_DEL_ARMED = Date.now();
    $('#pDel').textContent = '再点一次确认删除';
    $('#pDel').classList.add('danger');
    setTimeout(() => { $('#pDel').textContent = '删除'; $('#pDel').classList.remove('danger'); }, 3000);
    return;
  }
  SET_DEL_ARMED = 0;
  const name = SET_PROFILES[SET_CUR];
  const r = await msg('delete_profile', { id: SET_CUR });
  if (r.error) return setMsg(r.error, 'err');
  $('#pDel').textContent = '删除'; $('#pDel').classList.remove('danger');
  await setLoadProfiles(); loadMeta();
  setMsg(`已删除「${name}」`, 'ok');
};

$('#pExport').onclick = async () => {
  const r = await msg('export_profiles');
  const url = URL.createObjectURL(new Blob([r.data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'airs-profiles.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMsg('已导出 airs-profiles.json（不含任何 Key）', 'ok');
};
$('#pImport').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = await msg('import_profiles', { data: await f.text() });
  e.target.value = '';
  if (r.error) return setMsg(r.error, 'err');
  await setLoadProfiles(); loadMeta();
  setMsg(`已导入 ${r.count} 个档案；Key 不在档案里，请填写你自己的 Key`, 'ok');
};

// ---------------------------------------------------------------- 表单 ⇄ 档案
async function setLoadProfileData(id) {
  const { profile: p } = await msg('get_profile', { id });
  $('#gatewayUrl').value = p.gatewayBaseUrl || '';
  $('#cfgGuard').value = p.configs?.guard || '';
  $('#cfgLb').value = p.configs?.lb || '';
  $('#cfgConditional').value = p.configs?.conditional || '';
  $('#cfgCache').value = p.configs?.cache || '';
  $('#scmBase').value = p.scmBase || '';
  $('#koiBase').value = p.koiBase || '';
  $('#redteamScanId').value = p.redteamScanId || '';
  $('#budgetTokenLimit').value = p.budgetTokenLimit || '';
  $('#mainKeyLabel').value = p.mainKeyLabel || '';
  $('#budgetKeyLabels').value = p.budgetKeyLabels || '';
  $('#modelPrices').value = p.modelPrices ? JSON.stringify(p.modelPrices, null, 2) : '';
  await setRefreshKeys(id);
  setRefreshDots();
  await setRefreshConn();
}

async function setRefreshKeys(id) {
  const k = await msg('get_keys', { profileId: id || SET_CUR });
  $('#apiKey').value = '';
  $('#apiKey').placeholder = k.hasKey ? `已保存（${k.apiKeyMasked}），留空不修改` : '粘贴 Security Key 的值';
  $('#budgetKeys').value = '';
  $('#budgetKeys').placeholder = k.budgetKeysCount ? `已保存 ${k.budgetKeysCount} 把（${k.budgetKeysMasked.join('、')}），留空不修改` : '另一把设了额度的 Security Key';
  SET_HAS_KEY = k.hasKey;
}
let SET_HAS_KEY = false;

function setRefreshDots() {
  [['#cfgGuard', '#dGuard'], ['#cfgLb', '#dLb'], ['#cfgConditional', '#dCond'], ['#cfgCache', '#dCache']]
    .forEach(([inp, dot]) => $(dot).classList.toggle('on', Boolean($(inp).value.trim())));
}
['#cfgGuard', '#cfgLb', '#cfgConditional', '#cfgCache'].forEach(s => $(s).addEventListener('input', setRefreshDots));

async function setRefreshConn() {
  const url = $('#gatewayUrl').value.trim();
  let granted = false;
  if (url) { try { granted = (await msg('check_permission', { url })).has; } catch (e) {} }
  $('#connState').innerHTML =
    `<span class="st ${granted ? 'ok' : ''}">${granted ? '地址已授权' : '地址未授权'}</span>` +
    `<span class="st ${SET_HAS_KEY ? 'ok' : ''}">${SET_HAS_KEY ? 'Key 已保存' : '未填 Key'}</span>`;
}

function setReadForm() {
  let modelPrices;
  const mp = $('#modelPrices').value.trim();
  if (mp) {
    try { modelPrices = JSON.parse(mp); } catch (e) { throw new Error('模型单价不是合法 JSON：' + e.message); }
  }
  const limit = parseInt($('#budgetTokenLimit').value, 10);
  return {
    gatewayBaseUrl: $('#gatewayUrl').value.trim(),
    configs: {
      guard: $('#cfgGuard').value.trim(), lb: $('#cfgLb').value.trim(),
      conditional: $('#cfgConditional').value.trim(), cache: $('#cfgCache').value.trim(),
    },
    scmBase: $('#scmBase').value.trim(),
    koiBase: $('#koiBase').value.trim(),
    redteamScanId: $('#redteamScanId').value.trim(),
    ...(limit > 0 ? { budgetTokenLimit: limit } : {}),
    mainKeyLabel: $('#mainKeyLabel').value.trim(),
    budgetKeyLabels: $('#budgetKeyLabels').value.trim(),
    ...(modelPrices ? { modelPrices } : {}),
  };
}

// ---------------------------------------------------------------- 保存（一个按钮完成：授权 Gateway 地址 + 存配置 + 存 Key）
$('#setSave').onclick = function () {
  let form;
  try { form = setReadForm(); } catch (e) { return setMsg(e.message, 'err'); }
  let origin = null;
  if (form.gatewayBaseUrl) {
    try {
      const u = new URL(form.gatewayBaseUrl);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      origin = u.origin + '/*';
    } catch (e) { return setMsg('Gateway 地址格式不正确，应形如 https://aigw.portkey.ai/v1', 'err'); }
  }
  const finish = async granted => {
    try {
      const r = await msg('save_profile', { id: SET_CUR, profile: form });
      if (r?.error) throw new Error(r.error);
      const keys = { profileId: SET_CUR };
      const ak = $('#apiKey').value.trim(), bk = $('#budgetKeys').value.trim();
      if (ak) keys.apiKey = ak;
      if (bk) keys.budgetKeys = bk.split(',').map(x => x.trim()).filter(Boolean);
      if (ak || bk) await msg('save_keys_partial', keys);
      await setRefreshKeys(SET_CUR); setRefreshDots(); await setRefreshConn(); loadMeta();
      if (origin && !granted) setMsg('已保存，但没有授权访问 Gateway 地址，请求会失败；再点一次「保存设置」并在弹框里点允许', 'warn');
      else if (!form.gatewayBaseUrl || !SET_HAS_KEY) setMsg('已保存。还差：' + [!form.gatewayBaseUrl && 'Gateway 地址', !SET_HAS_KEY && 'API Key'].filter(Boolean).join('、'), 'warn');
      else setMsg('已保存，立即生效 ✓', 'ok');
    } catch (e) { setMsg('保存失败：' + e.message, 'err'); }
  };
  // chrome.permissions.request 必须在点击事件里同步调用；已授权的地址不会再弹框
  if (origin) chrome.permissions.request({ origins: [origin] }, granted => finish(Boolean(granted)));
  else finish(false);
};

// ---------------------------------------------------------------- 进入设置页时加载
async function settingsOnShow() {
  if (SET_LOADED) return;
  SET_LOADED = true;
  try { await setLoadProfiles(); } catch (e) { SET_LOADED = false; setMsg('读取设置失败：' + e.message, 'err'); }
}
if (new URLSearchParams(location.search).get('first') === '1') $('#firstBanner').style.display = 'block';
if ((location.hash || '').slice(1) === 'settings') settingsOnShow();
