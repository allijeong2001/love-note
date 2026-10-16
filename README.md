# Love Note · 姜宁 & 查理苏

一个装进手机里的恋爱小站。浅紫浅粉渐变 + 小鸟点缀，韩系柔和风。
所有数据都保存在**手机本地**（localStorage），退出重进不会丢失。

## 功能

| 页面 | 说明 |
| --- | --- |
| `index.html` | 壳层：里面用 iframe 装真正的页面，音乐在壳层里放，切页面不中断 |
| `home.html` | 主页，六个爱心入口 |
| `chat.html` | 和他聊天 · 带**聊天字卡库**小按键 |
| `note.html` | 小纸条（问他 A/B/C） |
| `timer.html` | 陪伴学习 · **可以自己设定专注/休息时长** |
| `music.html` | 一起听 · 从手机导入音频，可调音量/拖进度 |
| `moments.html` | 他的朋友圈 · 有独立的**朋友圈字卡库**，头像和封面都能换图 |
| `letter.html` | 写信给他 · 有独立的**写信字卡库** |
| `settings.html` | 设置 · 所有触发频率都能调 |

### 三套字卡库（互相独立）

1. **聊天字卡库**（`chat.html` 右上「🃏 字卡库」）—— 他回你消息时随机抽一张
2. **朋友圈字卡库**（`moments.html` 右上）—— 他发朋友圈、回你评论时随机抽一张
3. **写信字卡库**（`letter.html` 右上）—— 他回信、主动写信时随机抽一张

每套都可以：查看全部、逐条修改、逐条删除、**批量添加**（一行一张，换行一次就是下一张）、搜索、恢复默认、清空。
改动立刻写进手机本地。

### 触发规则（默认，可在设置里改）

- **朋友圈**：查理苏每天随机时刻发 1~3 条，时间按**北京时间**算；你评论之后他会在 20~90 秒内从字卡库里抽一条回复你。也可以手动点「让他发一条」。
- **写信**：你寄出信之后，他会在 **10~60 分钟**里随机挑一个时刻，从字卡库抽一封回信；每天还会**主动写信 0~1 次**。
- **计时器**：默认专注 25 分钟 / 休息 5 分钟，可以自己 ± 或选 15/25/45/60/90，选择会记下来。

> 提醒：这是纯前端应用，只有打开着的时候才会走时间。没赶上的动态/信件会在你下次打开时补上。

## 本地预览

直接用浏览器打开 `index.html` 即可（或 `python -m http.server` 起个本地服务）。

## 上传到 GitHub 并打包 APK

### 1. 建公开仓库并推送

```bash
git init
git add .
git commit -m "Love Note 初版"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

（仓库选 **Public**。如果 GitHub 需要登录，用 `gh auth login` 或在推送时输入用户名 + Personal Access Token。）

### 2. 自动打包 APK

推送到 `main` 之后，GitHub Actions（`.github/workflows/build-apk.yml`）会自动跑：

1. 装 JDK 17 + Android SDK + Gradle 8.5
2. 把网页文件同步进 `android/app/src/main/assets/www`
3. `gradle assembleDebug`
4. 把 APK 作为构建产物上传

去仓库的 **Actions** 页签，点最新的那次运行，在 **Artifacts** 里下载 `lovenote-debug-apk`，解压就是 `app-debug.apk`，传到手机安装即可。

想直接发 Release 的话：

```bash
git tag v1.0
git push origin v1.0
```

工作流会把 APK 挂到 Release 附件里。

### 3. 本地打包（可选）

需要装好 Android SDK，然后：

```bash
./copy-web.sh          # Windows 用 copy-web.bat
cd android
gradle assembleDebug
```

产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。

## 改文案

所有文案、配色、默认字卡都在 `config.js` 里，改完刷新页面即可生效，改完记得重新推一次 GitHub 再打包。
