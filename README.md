# 像素丛林僵尸射击（GitHub Pages 一键发布）

## 玩法更新（当前版本）
- 第一人称可见自己的身体和手持武器。
- 默认武器：**刀剑**（近战，弹药无限）。
- 商店购买：靠近商店里的 NPC，按 **B** 打开购买界面。
- 购买界面操作：
  - `↑/↓` 选择商品
  - `←/→` 查看说明
  - `Enter` 购买
  - `B` 关闭
- 可购买武器：
  - 手枪（购买后自动装备，补给100发）
  - 步枪（购买后自动装备，补给100发）
- 枪械弹药打空后，自动切回刀剑。

## 一键发布到 GitHub Pages

> 前提：仓库默认分支是 `main`。

1. 把代码推送到 GitHub 仓库 `main` 分支。
2. 进入仓库页面 → **Actions**。
3. 选择工作流：**Deploy static game to GitHub Pages**。
4. 点击 **Run workflow**。
5. 第一次部署时，去 **Settings → Pages** 确认 Source 为 **GitHub Actions**。
6. 部署完成后，打开：`https://<你的用户名>.github.io/<仓库名>/`

## 本地运行

```bash
python3 -m http.server 4173
```

打开：`http://127.0.0.1:4173`
