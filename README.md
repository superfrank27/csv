# 像素丛林僵尸射击（GitHub Pages 一键发布）

这是一个纯前端网页游戏（`index.html` + `style.css` + `game.js`）。

## 一键发布到 GitHub Pages

> 前提：仓库默认分支是 `main`。

1. 把代码推送到 GitHub 仓库 `main` 分支。
2. 进入仓库页面 → **Actions**。
3. 选择工作流：**Deploy static game to GitHub Pages**。
4. 点击 **Run workflow**（不改参数，直接运行）。
5. 第一次部署时，去 **Settings → Pages** 确认 Source 为 **GitHub Actions**。
6. 部署完成后，打开：
   - `https://<你的用户名>.github.io/<仓库名>/`

## 自动发布

- 之后每次你 push 到 `main`，都会自动重新部署。

## 本地运行

```bash
python3 -m http.server 4173
```

浏览器打开：

```text
http://127.0.0.1:4173
```
