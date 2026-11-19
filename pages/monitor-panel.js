'use strict';
// AIRS Demo Hub — 用量监控（并入 demo.html 的「用量监控」菜单）
// 依赖 demo.js 里的全局：msg、$、esc、usd、show
// 只统计插件自己发出的请求；费用按设置里的模型单价估算。

let MON_FILTER = 'session';
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);

function monShareBars(el, rows, field, fmt) {
  const total = rows.reduce((a, r) => a + (r[field] || 0), 0);
  if (!total) { el.innerHTML = '<div class="muted small">暂无数据</div>'; return; }
  const top = [...rows].sort((a, b) => b[field] - a[field]).slice(0, 6);
  el.innerHTML = top.map(r => {
    const pct = r[field] / total * 100;
    return `<div class="share"><span class="nm" title="${esc(r.model)}">${esc(r.model)}</span>
      <span class="tr"><i style="width:${Math.max(2, pct)}%"></i></span><span class="v">${fmt(r[field])} · ${pct.toFixed(0)}%</span></div>`;
  }).join('');
}

async function monLoad() {
  let rows = [];
  try { rows = await msg('monitor_data', { filter: MON_FILTER }); } catch (e) {}
  rows = Array.isArray(rows) ? rows : [];
  let reqs = 0, tin = 0, tout = 0, blk = 0, cost = 0;
  for (const r of rows) { reqs += r.requests; tin += r.inputTokens; tout += r.outputTokens; blk += r.blocked; cost += r.cost; }
  $('#mReqs').textContent = reqs.toLocaleString();
  $('#mIn').textContent = fmtN(tin);
  $('#mOut').textContent = fmtN(tout);
  $('#mBlock').textContent = blk.toLocaleString();
  $('#mCost').textContent = usd(cost);
  monShareBars($('#mShare'), rows, 'cost', usd);
  monShareBars($('#mReqShare'), rows, 'requests', n => n + ' 次');
  const tb = $('#monitorBody');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:30px">暂无数据（通过插件发起请求后才有记录）</td></tr>';
    return;
  }
  rows.sort((a, b) => b.cost - a.cost);
  const R = 'style="text-align:right"';
  tb.innerHTML = rows.map(r => `<tr>
      <td><b>${esc(r.model)}</b></td><td>${esc(r.provider)}</td><td>${esc(r.profile)}</td>
      <td ${R}>${r.requests.toLocaleString()}</td><td ${R}>${r.inputTokens.toLocaleString()}</td><td ${R}>${r.outputTokens.toLocaleString()}</td>
      <td ${R}>${r.cacheTokens > 0 ? r.cacheTokens.toLocaleString() : '-'}</td>
      <td style="text-align:right${r.blocked ? ';color:var(--red)' : ''}">${r.blocked || '-'}</td>
      <td style="text-align:right${r.budgetStop ? ';color:var(--amber)' : ''}">${r.budgetStop || '-'}</td>
      <td ${R}><b>${usd(r.cost)}</b></td></tr>`).join('') +
    `<tr class="total-row"><td colspan="3"><b>合计</b></td><td ${R}><b>${reqs.toLocaleString()}</b></td><td ${R}><b>${tin.toLocaleString()}</b></td>
      <td ${R}><b>${tout.toLocaleString()}</b></td><td ${R}>-</td><td ${R}><b>${blk || '-'}</b></td><td ${R}>-</td><td ${R}><b>${usd(cost)}</b></td></tr>`;
}

document.querySelectorAll('#monFilter button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#monFilter button').forEach(x => x.classList.toggle('sel', x === b));
  MON_FILTER = b.dataset.filter; monLoad();
});
$('#monRefresh').onclick = monLoad;
$('#monCsv').onclick = async () => {
  const r = await msg('monitor_csv', { filter: MON_FILTER });
  const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `airs-usage-${MON_FILTER}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// 清零：点两次确认，不用 confirm() 弹窗
let MON_CLR = 0;
$('#monClear').onclick = async () => {
  const b = $('#monClear');
  if (Date.now() - MON_CLR > 3000) {
    MON_CLR = Date.now(); b.textContent = '再点一次确认清零'; b.classList.add('danger');
    setTimeout(() => { b.textContent = '清零'; b.classList.remove('danger'); }, 3000);
    return;
  }
  MON_CLR = 0; b.textContent = '清零'; b.classList.remove('danger');
  await msg('monitor_clear'); monLoad();
};

function monitorOnShow() { monLoad(); }
if ((location.hash || '').slice(1) === 'monitor') monitorOnShow();
