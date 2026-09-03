# 静日 · Quiet Daybook

一个以“今天”为中心的私人工作台：日历式 Todo、每日想法、自然语言记账和月度预算。数据存放在当前浏览器的 IndexedDB 中，不需要登录，也不会上传到仓库。

## 本地运行

```bash
npm install
npm run dev
```

生产检查：

```bash
npm test
npm run build
```

## 部署到 GitHub Pages

1. 将仓库默认分支设为 `main` 并推送代码。
2. 在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。
3. 工作流会运行测试、构建并发布 `dist`。

应用使用 Hash 路由和相对资源路径，可部署在 `username.github.io/repository-name/` 子路径下。

## 数据与 AI

- 电脑和手机各自保存独立数据，不会自动同步。请在设置中定期导出 JSON 备份。
- 默认使用阿里云百炼的通义千问 OpenAI 兼容接口：`https://dashscope.aliyuncs.com/compatible-mode/v1`，模型为 `qwen-plus`。
- 中国内地通用域名仍可正常使用；如需官方推荐的业务空间专属域名，可在百炼控制台查看 Workspace ID 后替换。
- API Key 只保存在本机 IndexedDB，不会进入 JSON 备份或 Git 仓库；不要在公共电脑保存。
- 未配置 AI 或请求失败时，记账会降级为本地金额和关键词解析。
