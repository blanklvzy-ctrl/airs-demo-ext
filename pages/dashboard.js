'use strict';
// AIRS Demo Hub — 总览 dashboard
// 依赖 demo.js 里的全局：msg、$、esc、usd、show、META、OFFLINE
// 汇总：连接状态、场景是否就绪、最近一次自检、离线兜底覆盖、本场数据，并给 5 个演示步骤打角标。

function sbadge(id, text, cls) {
  const el = $('#sb-' + id);
  if (!el) return;
  el.textContent = text;
  el.className = 'sbadge ' + (cls || '');
}

const DASH_SCEN = [['guard', '安检'], ['lb', '成本演示'], ['conditional', '分流'], ['cache', '缓存']];

async function dashRefresh() {
  const m = (typeof META === 'object' && META) || {};
  const cfg = m.configs || {};
  const hasKey = Boolean(m.key_configured), hasGw = Boolean(m.gateway);

  // 连接
  $('#dConn').textContent = hasKey && hasGw ? '已连接' : '未完成';
  $('#dConn').className = 'dbig ' + (hasKey && hasGw ? 'ok' : 'bad');
  $('#dConnSub').textContent = hasKey && hasGw
    ? `${m.gateway.replace(/^https?:\/\//, '')} · 档案「${m.profileName || '默认'}」`
    : '缺少 ' + [!hasGw && 'Gateway 地址', !hasKey && 'API Key'].filter(Boolean).join('、') + ' · 点这里去设置';

  // 场景就绪
  const filled = DASH_SCEN.filter(([k]) => (cfg[k] || '').trim());
  const budgetN = m.budget?.count || 0;
  const readyN = filled.length + (budgetN ? 1 : 0);
  $('#dReady').textContent = `${readyN} / 5`;
  $('#dReady').className = 'dbig ' + (readyN === 5 ? 'ok' : readyN >= 2 ? 'warn' : 'bad');
  $('#dReadyDots').innerHTML = DASH_SCEN.map(([k, n]) => `<span class="${(cfg[k] || '').trim() ? 'on' : ''}">${n}</span>`).join('') +
    `<span class="${budgetN ? 'on' : ''}">预算 Key</span>`;

  // 最近自检
  try {
    const { lastSelfcheck: sc } = await chrome.storage.local.get('lastSelfcheck');
    if (sc) {
      const mins = Math.round((Date.now() - sc.at) / 60000);
      const ago = mins < 1 ? '刚刚' : mins < 60 ? `${mins} 分钟前` : mins < 1440 ? `${Math.round(mins / 60)} 小时前` : `${Math.round(mins / 1440)} 天前`;
      $('#dSelf').textContent = sc.fail ? `${sc.fail} 项失败` : sc.slow ? `${sc.ok}/${sc.n} 正常` : '全部正常';
      $('#dSelf').className = 'dbig ' + (sc.fail ? 'bad' : sc.slow ? 'warn' : 'ok');
      $('#dSelfSub').textContent = `${ago}${sc.skip ? ` · ${sc.skip} 个场景未配置` : ''}${mins > 60 ? ' · 建议演示前再跑一次' : ''}`;
    }
  } catch (e) {}

  // 离线兜底
  try {
    const r = await msg('recordings');
    const own = (r.items || []).filter(i => !i.sample).length, sample = (r.items || []).length - own;
    $('#dRec').textContent = own ? `${own} 个场景` : '仅示例';
    $('#dRec').className = 'dbig ' + (own >= 20 ? 'ok' : own ? 'warn' : 'bad');
    $('#dRecSub').textContent = (own ? '你自己环境的录制' : `只有 ${sample} 条插件自带示例`) + (OFFLINE ? ' · 离线回放已开启' : ' · 点这里一键预录制');
  } catch (e) {}

  // 本场数据
  try {
    const s = await msg('stats_detail');
    $('#dCalls').textContent = s.calls || 0;
    $('#dBlocked').textContent = s.blocked || 0;
    $('#dStops').textContent = s.budgetStops || 0;
    $('#dHits').textContent = s.cacheHits || 0;
    $('#dSpend').textContent = usd(s.spend || 0);
  } catch (e) {}

  // 演示步骤角标：这一步现在能不能现场演示
  sbadge('koi', '示例快照', '');
  sbadge('redteam', m.links?.redteam_report && !/\/scans$/.test(m.links.redteam_report) ? '已关联报告' : '示例快照', '');
  const live = hasKey && hasGw;
  sbadge('guard', OFFLINE ? '离线回放' : !live ? '未连接' : (cfg.guard || '').trim() ? '可现场演示' : '用默认 Config', OFFLINE ? 'warn' : live ? 'ok' : 'warn');
  sbadge('cost', OFFLINE ? '离线回放' : !live ? '未连接' : budgetN ? '可现场演示' : '缺预算 Key', OFFLINE ? 'warn' : live && budgetN ? 'ok' : 'warn');
  const effOk = (cfg.cache || '').trim() && (cfg.conditional || '').trim();
  sbadge('eff', OFFLINE ? '离线回放' : !live ? '未连接' : effOk ? '可现场演示' : '缺 Config', OFFLINE ? 'warn' : live && effOk ? 'ok' : 'warn');
}

$('#dSelfCard').onclick = () => $('#btnSelf').click();
$('#dRecCard').onclick = () => $('#btnSelf').click();
dashRefresh();
