# 随机图片占屏（Random Image Fullscreen）

打开网页先是一片纯黑空白，随后同一张图片以随机大小、随机位置不断铺满屏幕，覆盖率达到 80% 后画面定格。

## 效果说明

- 页面加载完成后延迟约 **300 毫秒** 开始，之后每隔约 **100 毫秒** 在页面内随机位置显示同一张图片。
- 每张图片宽度在**屏幕宽度的 5% ~ 30%** 之间随机，高度按原图宽高比换算（不变形）；位置随机，并尽量让整张图完整落在可视区域内。
- 已显示的图片**不会消失、也不会移动**，后显示的图片会盖住先显示的图片（z-index 递增）。
- 内部用 **100 × 100 的网格**记录图片覆盖了哪些格子，覆盖率达到 **80%** 时停止生成，保持最终画面。
- 退出方式：**电脑按 ESC 键**；**手机双击屏幕**（电脑上双击同样有效）。
  - 退出时会先尝试 `window.close()`；浏览器通常不允许脚本关闭非脚本打开的窗口，此时页面会显示一个居中的“已结束”提示作为兜底。
- 页面禁止滚动、禁止缩放、禁止长按选中，避免手机上误操作；使用 `100dvh` 保证手机地址栏存在时也能全屏显示。

## 关于图片

**仓库中已经包含默认图片 `assets/image.jpg`，访问者无需自备图片**，打开网页即可看到效果。
该图片无版权问题，允许随仓库公开分发。（图片本身是 JPEG 格式，610 × 690 像素。）

图片只需要通过网络加载一次，浏览器会缓存，后续所有 `<img>` 都复用同一份资源（脚本里先用一个 `Image` 对象预加载，确认加载成功后才开始生成）。

如果图片不存在或加载失败（比如路径写错、文件名大小写不符），页面中央会显示一行红色错误提示，不会静默失败。

## 文件结构

```text
项目根目录/
├── index.html       页面结构（HTML5）
├── style.css        全屏黑底、禁止滚动与选中、错误/结束提示样式
├── script.js        全部逻辑：预加载、随机生成、覆盖率统计、退出
├── README.md        本文件
├── LICENSE          MIT License
├── .gitignore       忽略常见无关文件（assets/ 不会被忽略）
└── assets/
    └── image.jpg    页面使用的图片（随仓库提交）
```

> 本项目按要求采用 **多文件结构**（HTML / CSS / JS 分离），没有合并成单个 `index.html`。
> 如果你更喜欢单文件版本，把 `style.css` 和 `script.js` 的内容分别内联进 `<style>` 和 `<script>` 标签即可，功能完全一致。

## 本地预览

方式一：直接双击打开 `index.html`（或用浏览器“打开文件”），图片也能正常显示。

方式二（推荐，更接近线上环境）：在项目根目录启动一个静态服务器：

```bash
# Python 3
python -m http.server 8000
```

然后浏览器访问 <http://localhost:8000/>。

## 一键发布脚本（国内网络推荐）

如果 `github.com` 网页时通时不通，用项目里的 `deploy_github.py` 更省事（本地工具脚本，不需要上传）。
它只访问 `api.github.com`（国内实测比网页稳定得多），会自动完成：建仓库 → 上传文件 → 开启 Pages，
网络抖动时会自动重试。

1. 在能打开 GitHub 的地方（例如用手机流量）生成一个令牌：
   <https://github.com/settings/tokens/new> → 勾选 **repo** → **Generate token**
   → 复制那串 `ghp_` 开头的字符（**只显示一次**，先粘到记事本）。
2. 在本项目目录里执行：

   ```bash
   export GITHUB_TOKEN=你复制的令牌     # CMD 里用：set GITHUB_TOKEN=你复制的令牌
   python deploy_github.py
   ```

3. 脚本跑完会打印网址，首次生效需要 1～2 分钟。

### 备选：发布到 Gitee（码云）

如果 `github.com` 时通时不通，国内直连 gitee.com 很稳，可以改用同款脚本 `deploy_gitee.py`：

1. 注册并登录 <https://gitee.com>，然后完成**实名认证**（这是 Gitee Pages 的硬性要求）。
2. 生成私人令牌：<https://gitee.com/personal_access_tokens> → 勾选 `user_info` 和 `projects` → 复制。
3. 执行：

   ```bash
   export GITEE_TOKEN=你复制的令牌
   python deploy_gitee.py
   ```

4. 如果脚本提示 Pages 接口不可用，打开仓库页面 → 顶部「服务」→「Gitee Pages」→ 选分支 → 点「启动」。

网址形如 `https://你的用户名.gitee.io/random-image-screen/`。

## 部署到 GitHub Pages

> 下面的步骤需要你能稳定打开 github.com 网页；打不开就用上面的脚本。

1. 在 GitHub 上新建一个**公开**仓库，例如 `random-image-screen`。
   （不要勾选 “Add a README file / .gitignore / license”，本地已经有了，避免冲突。）
2. 在本地项目根目录把文件推送到该仓库：

   ```bash
   cd 项目根目录
   git init
   git add .
   git commit -m "init: 随机图片占屏"
   git branch -M main
   git remote add origin https://github.com/你的用户名/random-image-screen.git
   git push -u origin main
   ```

3. 打开仓库页面，进入 **Settings → Pages**。
4. 在 **Source** 处选择 **Deploy from a branch**；**Branch** 选择 **main**，目录选择 **/ (root)**，然后点击 **Save**。
5. 等待 **1 ~ 2 分钟**（首次部署稍慢），刷新 Pages 页面即可看到访问地址：

   ```text
   https://你的用户名.github.io/random-image-screen/
   ```

> 提示：GitHub Pages 的服务器区分文件名大小写，图片必须正好叫 `assets/image.jpg`（全小写），否则会 404 并显示错误提示。

## 退出方式

| 设备 | 操作 |
| --- | --- |
| 电脑 | 按 **ESC** 键（双击页面也可以） |
| 手机 / 平板 | **双击屏幕** |

退出时会先尝试 `window.close()` 关闭窗口；如果浏览器拒绝关闭，页面会显示“已结束”提示。刷新或重新打开页面即可重放效果。

## 如何替换图片

把 `assets/image.jpg` 替换成你自己的图片（建议保持文件名为 `image.jpg`；若换成 PNG 等其它格式，记得把 `script.js` 顶部的 `IMAGE_SRC` 一起改掉），然后重新提交并推送：

```bash
git add assets/image.jpg
git commit -m "更新图片"
git push
```

推送后等 1 ~ 2 分钟（GitHub Pages 重新构建），刷新页面即可看到新图片。
（如果用的是 `deploy_github.py`，把新图覆盖 `assets/image.jpg` 后重新运行一次脚本即可。）

## 自定义参数

所有可调参数集中在 `script.js` 顶部的常量区：

| 常量 | 默认值 | 含义 |
| --- | --- | --- |
| `IMAGE_SRC` | `assets/image.jpg` | 图片路径 |
| `START_DELAY` | `300` | 页面加载后延迟多久开始（毫秒） |
| `SPAWN_INTERVAL` | `100` | 每张图片的生成间隔（毫秒） |
| `MIN_WIDTH_RATIO` / `MAX_WIDTH_RATIO` | `0.05` / `0.30` | 图片宽度占屏幕宽度的比例范围 |
| `GRID_SIZE` | `100` | 覆盖率网格大小（100 × 100） |
| `TARGET_COVERAGE` | `0.80` | 达到该覆盖率后停止生成 |
| `MAX_IMAGES` | `2000` | 图片数量安全上限（避免极端长宽比时 DOM 无限膨胀） |

## 常见问题

- **页面一直是黑的**：说明图片没加载出来，稍等会看到居中错误提示。检查 `assets/image.jpg` 是否存在、文件名大小写是否正确。
- **手机上双击没反应**：请确保是“快速连续点两下”（间隔小于 300ms），并且两次点击的位置基本重合。
- **多久能铺满**：取决于图片宽高比和随机结果，通常在几秒到几十秒之间；达到 80% 覆盖率后会自动停止。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。使用前请把 `LICENSE` 中的 `[year]` 和 `[fullname]` 替换为实际年份和作者名。
