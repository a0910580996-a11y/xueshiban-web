# 学事板设计系统与前端约定

第三版界面（2026-10-07）的设计依据与维护约定。改界面前先读这一页。

## 设计原则

1. **内容优先**：手机首屏必须能看到第一条作业。页头只放日期、标题和一句由数据生成的摘要，不放装饰性大标语。
2. **按时间组织作业**：作业按“今天 / 明天 / 7 天内 / 7 天后 / 已截止 / 已完成”分组；排序方式决定分组方式（按课程排序时按课程分组）。
3. **颜色只表达含义**：品牌绿用于主要操作和选中状态；朱红只表示“今天截止 / 考试 / 未读徽标”；银杏金只表示“明天截止”。不要为装饰使用这两种颜色。
4. **一个组件，两种形态**：课程筛选在桌面是侧栏，在手机是横滑标签；导航在桌面是顶部分段控件，在手机是底部标签栏。标记相同，由 CSS 断点切换。

## 令牌（styles.css 顶部）

| 类别 | 令牌 | 说明 |
| --- | --- | --- |
| 底色 | `--paper` | 与插图纸色一致（`#f9f4e8`），插图才能无缝融入页面 |
| 面 | `--surface` `--surface-2` `--surface-3` | 卡片、次级填充、按压 |
| 文字 | `--ink` `--ink-2` `--ink-3` `--ink-4` | 正文、次要、辅助、占位/禁用 |
| 线 | `--line` `--line-2` | 分隔线、输入框边框 |
| 交互 | `--hover` `--press` `--track` `--focus` | 悬停、按下、分段控件轨道、焦点环 |
| 语义 | `--brand` `--accent` `--danger` | 品牌绿、银杏金、印章朱红 |
| 课程色 | `--tone-0` … `--tone-7` | 由 `courseTone()` 分配，同一课程永远同色 |
| 文件色 | `--ft-pdf` `--ft-word` `--ft-slides` `--ft-image` `--ft-other` | 文件类型徽章 |

深色主题的令牌写在两处：`:root[data-theme="dark"]`（手动选择）和 `prefers-color-scheme` 媒体查询（跟随系统）。**两处必须一致**，`tests/release.test.js` 会检查。

浅色着色背景统一用 `::before { background: currentColor; opacity: .12 }` 生成（截止徽章、标签、文件徽章、状态标记），这样一个颜色令牌同时适用于深浅两种主题。

## 断点

- `< 640px`：手机。详情为底部抽屉。
- `≥ 640px`：加宽边距、页头放大，详情为居中对话框。
- `≥ 760px`：导航移到顶部。
- `≥ 960px`：出现左侧筛选栏。

## 代码约定

- **视图与状态分离**：所有学生端标记在 `student-view.js`（纯函数，可在 Node 中测试）；`app.js` 只负责状态、路由和事件；管理端在 `admin.js`；图标只在 `icons.js` 定义。
- **局部刷新**：页面分为 `data-region="head|facets|body"` 三个区域，筛选变化只重绘这些区域。搜索框不在区域内，因此输入中文时不会被打断；`app.js` 同时处理了 `compositionend`。
- **事件委托**：可交互元素写 `data-action`（以及 `data-value` / `data-id`），不要逐个绑定 `onclick`。重绘后焦点按 `data-action|data-value|data-id` 自动恢复。
- **CSP**：页面禁止内联脚本和内联样式（包括 `style=""` 属性）。需要按数据变化的颜色时，输出 `data-*` 属性并在 CSS 中映射。测试会检查。
- **转义**：所有内容字段经 `escapeHtml` 输出；链接经 `safeUrl`。
- **本地存储键**：`xueshiban:class`、`xueshiban:done`、`xueshiban:read`、`xueshiban:theme`。不要改名，否则同学的完成记录会丢失。管理端另有 `xueshiban:admin-vault`（密码加密的授权）、`xueshiban:admin-remember`（保持登录时的密文）和 IndexedDB `xueshiban/keys`（不可导出的设备密钥），只由 `vault.js` 读写。
- **历史记录**：打开详情会推入 `#板块/编号`，所以手机返回键只关闭详情。关闭按钮会回退这条记录，不会堆积历史。

## 发布前

```bash
npm test
npm run version:bump
```

`version:bump` 把 `index.html` 和全部模块的 `?v=` 统一成同一个新版本号。GitHub Pages 有缓存，版本号不一致会让新旧模块混用。

本地预览真实内容用 `npm start`（端口 4173）；带测试作业和通知的预览用 `npm run preview`（端口 4174，测试数据的截止日期按当天生成，覆盖所有分组，不写入 `content.json`）。至少在 375 px 手机宽度与 1280 px 桌面宽度、浅色与深色下各看一遍。
