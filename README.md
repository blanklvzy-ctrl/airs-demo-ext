# AIRS 演示中心 · Chrome 插件（v1.3.0）

Prisma AIRS 演示中心的 Chrome MV3 插件版。通过 Prisma AIRS AI Gateway（Portkey）现场演示：攻击拦截、预算硬停、缓存与分流；KOI、红队用示例快照 + 控制台跳转链接展示。

---

## 安装

1. Chrome 地址栏打开 `chrome://extensions`，右上角打开「开发者模式」
2. 点「加载已解压的扩展程序」，选择 `airs-demo-ext` 目录
3. 点工具栏的 AIRS 图标打开演示中心（首次没有 Key 时会直接打开左侧「设置」）

更新版本后，在 `chrome://extensions` 里点插件卡片上的刷新按钮即可。

---

## 本仓库说明

Gateway 地址、API Key、Config ID、红队 Scan ID、SCM / KOI 控制台地址都在插件的「设置」里填写，保存在浏览器本地（`chrome.storage.local`），**不要写入本仓库或提交到 Git**。导出的环境档案也不含 Key；同事使用时请各自填写自己的 Key。仓库内的 `recordings/recordings.json` 是通用示例录制（已去掉个人 Config ID、环境标识和原始响应），仅供离线回放演示，不是真实环境数据。


---

## 设置（左侧菜单「工具 → 设置」）

设置页只有三块，**完成 ① 就能开始演示**；② ③ 按需填写。所有内容用右上角一个「保存设置」按钮保存，立即生效。

| 区块 | 必填 | 填什么 | 去哪里找（Strata Cloud Manager → AI Security） |
|---|---|---|---|
| ① 连接 AI Gateway | ★ 必填 | Gateway 地址 | Portkey SaaS 为 `https://aigw.portkey.ai/v1`；自建 Gateway 地址在哪里看：**待核实** |
| | ★ 必填 | Gateway API Key | AI Gateway → Security Keys，复制 Key 的值 |
| ② 场景 Config | 按需 | 安检 / 成本演示 / 条件分流 / 缓存 四个 Config ID | AI Gateway → Policies & Profiles → Configuration |
| ③ 成本演示 | 可选 | 预算 Key、预算额度、两个 Key 的显示名 | AI Gateway → Security Keys → 新建 Key → Add Budget → Tokens |
| 高级（折叠） | 可选 | SCM / KOI 地址、红队 Scan ID、模型单价 | Scan ID：AI Red Teaming → Scans → 打开扫描，地址栏 `/scans/` 后一段（按报告链接格式推断，首次使用请核对） |

说明：

- 第一次点「保存设置」时，Chrome 会弹框请你授权访问 Gateway 地址，点「允许」。没授权时请求会失败，自检里会提示。
- 某个场景没填 Config ID 时，请求不带 `x-portkey-config`，走 Key 默认挂载的 Config；自检里这个场景显示「未配置」。
- Key 输入框留空不会清除已保存的 Key；页面上只显示末 4 位。

### 场景和演示步骤的对应

| 演示步骤 | 需要 |
|---|---|
| 总览、① 发现（KOI）、② 上线前（红队） | 不需要配置（示例快照）；跳转链接用到 SCM / KOI 地址、Scan ID |
| ③ 运行时防护 | Gateway 地址 + Key + 「安检」Config |
| ④ 成本控制 | 「成本演示」Config（可与安检相同）+ 预算 Key |
| ⑤ 效率与路由 | 「条件分流」「缓存」Config |

---

## Config 怎么写（按本环境实测写法）

模型统一写成 `@接入短名/模型名`，接入短名在 AI Gateway → Integrations → LLM Integrations（早期文档写作 Catalogs → LLMs）。

**安检：负载均衡 + 输入/输出安检**（拦截时返回 HTTP 446）

```json
{
  "strategy": { "mode": "loadbalance" },
  "targets": [
    { "model": "@<接入短名A>/<模型名>", "weight": 0.5 },
    { "model": "@<接入短名B>/<模型名>", "weight": 0.5 }
  ],
  "input_guardrails":  [{ "id": "<Guardrail ID>", "deny": true }],
  "output_guardrails": [{ "id": "<Guardrail ID>", "deny": true }]
}
```

Guardrail ID（`pg-…`）在 AI Gateway → Policies & Profiles → Guardrails；它引用的 Runtime 安检方案在 AI Runtime API → Security Profiles。

**单模型 + 安检**（换用其他 LLM 最简单的写法）

```json
{
  "strategy": { "mode": "single" },
  "targets": [{ "override_params": { "model": "@<接入短名>/<模型名>" } }],
  "input_guardrails":  [{ "id": "<Guardrail ID>", "deny": true }],
  "output_guardrails": [{ "id": "<Guardrail ID>", "deny": true }]
}
```

**缓存**：`"cache": { "mode": "simple", "max_age": 600 }`，精确匹配，改一个字就不命中。

**条件分流**：`strategy.mode = "conditional"`，按请求头 `x-portkey-metadata` 里的 `x-task` 标签选目标（插件会自动带 `coding` / `normal`）。conditions 的具体字段写法以控制台 Config 编辑器为准（**待核实**）。

### 换用其他 LLM

1. AI Gateway → Integrations → LLM Integrations：新增对应供应商的接入（例如 Moonshot / Kimi），记下接入短名
2. 在 Config 里把模型改成 `@<接入短名>/<模型名>`，保存
3. 把 Config ID 填进插件设置的对应场景；要统计费用，在「高级 → 模型单价」里加一行该模型的单价

---

## 环境档案

设置页顶部的「环境档案」用来保存多套环境（例如自己的租户、客户 PoC 租户），可以新建、复制、重命名、删除、切换。

- **导出（不含 Key）**：下载 `airs-profiles.json`，里面只有地址、Config ID 等配置，不含任何 Key
- **导入**：同事导入后，需要在 ① 里填**自己的** Key
- 复制档案时不会复制 Key

---

## 分享给同事

1. 发 `airs-demo-ext.zip`（不含任何 Key 或个人 Config ID）
2. 同事解压后按「安装」加载，在「设置」里填自己的 Gateway 地址和 Key
3. 如需共用 Config ID 等配置，另发导出的 `airs-profiles.json`

---

## 离线回放与示例录制

- 插件自带一份**示例录制**（`recordings/recordings.json`）：只保留状态码、判定、检出类别、耗时和模型回复，已去掉 Config ID、Guardrail / Profile 名称、Trace / Transaction ID 和原始响应。回放示例录制时，结果卡片会标注「插件自带示例录制（非你的环境）」。
- 实时请求成功后会自动录制到本机（`chrome.storage.local`），之后回放的就是你自己环境的结果；「演示前自检 → 一键预录制」可以一次录完所有场景。
- 顶栏「离线回放」打开后，所有场景都用录制结果，不发真实请求。

---

## 用量监控

左侧菜单「工具 → 用量监控」（和其他菜单一样在本页打开；顶栏的「本场 $」也能点进来）。只统计插件自己发出的请求，按模型、提供商、档案汇总请求数、Token、拦截次数和估算费用，并显示按模型的费用 / 请求占比；费用按「高级 → 模型单价」估算，不是控制台的真实账单。支持今天 / 本场（自这次打开浏览器起）/ 7 天 / 全部，可导出 CSV；清零需连点两次确认。

---

## 总览 dashboard

总览页一屏看清能不能开始演示：连接状态、场景就绪（4 个 Config + 预算 Key）、最近一次自检结果、离线兜底覆盖了多少场景、本场调用 / 拦截 / 预算硬停 / 缓存命中 / 花费；5 个演示步骤卡片右上角的角标显示这一步当前能否现场演示（可现场演示 / 缺 Config / 未连接 / 离线回放 / 示例快照）。

## 顶栏

从左到右：菜单开关、面包屑 | 连接状态（点开进设置）、本场花费（点开进用量监控）| 离线回放、客户视图两个开关 | 白天 / 夜间、设置、演示前自检。窗口较窄时会自动隐藏网关地址和花费胶囊。

从 Gateway 拉取全量日志和统计：Gateway Security Key 能否调用 Portkey 的日志 / 统计接口，**待核实**，当前未实现。

---

## 快捷键

| 键 | 操作 |
|---|---|
| `←` / `→` | 上 / 下一步（设置页内不翻页） |
| `M` | 隐藏 / 显示左侧菜单 |
| `D` | 白天 / 夜间（演示页、监控页同步） |

---

## 已知限制与待核实

1. **待核实**：自建 Gateway 的地址在控制台哪里查看
2. **待核实**：Gateway Security Key 能否调用 Portkey 的日志 / 统计接口
3. **待首次核对**：红队 Scan ID 取自扫描报告地址栏 `/scans/<Scan ID>/report/overview`（依据已有报告链接格式推断）
4. KOI、红队页面是示例快照，不是实时数据；演示时用页面下方链接打开你自己的控制台
5. 预算进度条上限来自设置里的「预算额度」，只用于展示；真正的拦截由 Gateway 返回 HTTP 412
6. Key 级 412 不进 Gateway Observability 日志，证据以插件里的报错和控制台 Key 状态（Exhausted）为准
7. MV3 Service Worker 闲置后会被挂起，重新激活后的第一个请求会稍慢

---

## 版本记录

- **v1.3.0**：用量监控并入演示中心；顶栏重排为状态胶囊 + 开关；总览新增 dashboard 和步骤角标；运行时防护新增本场拦截统计（拦截率、按风险类型），分流新增模型分布，⑤ 新增本场缓存收益；成本控制回放改为播放最近一次现场结果；联网时 404/401 等配置错误不再用录制顶替
- **v1.2.0**：设置并入演示中心左侧菜单并简化为三块 + 一个保存按钮；总览横幅随白天/夜间切换；示例录制去除个人 Config ID 等标识；Config 示例和菜单路径按实测环境改正；KOI / 红队标注为示例快照并去掉环境名；移除 `web_accessible_resources`；修复设置 / 监控按钮一次打开两个标签页、未填 Config 时把场景名当 Config ID 发出、未填 Scan ID 时红队链接损坏等问题
- v1.1：主题三页同步、设置页加宽、必填 / 可选标注、快速向导
- v1.0：首版
