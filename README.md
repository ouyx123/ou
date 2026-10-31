# 藏语拉萨话视觉语音识别系统

可直接发布到 GitHub Pages 的静态网页，无需安装前端依赖或运行 Python 后端。

## 访问及操作

1. 打开 GitHub Pages 发布后的网页。
2. 从本地选择任意一组支持的视频。当前设备没有视频时，打开“使用说明”，先下载其中一个输入视频。
3. 上传后原视频自动播放，点击“开始识别”后唇部 ROI 自动播放。
4. ROI 完整播放一遍后才输出对应藏文；暂停时继续等待，更换或重置视频会取消当前处理。
5. 结果支持复制、导出 TXT；原视频和 ROI 支持同步播放。

页面不展示原始文件名，不显示素材画廊，主工作台只保留本地上传入口。

## 发布到 GitHub Pages

将本文件夹内的文件放到 GitHub 仓库根目录，确保 `index.html` 直接位于仓库根目录，而不是嵌套在另一层文件夹中。

在仓库 **Settings → Pages** 中设置：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`

保存并等待部署成功后，Pages 页面会给出实际网站地址。发给访客的是这个网站地址，而不是 GitHub 仓库源码地址。

静态文件全部使用相对路径，兼容 GitHub Pages 的项目子路径。`.nojekyll` 使文件直接作为静态资源提供。

参考：[GitHub Pages 官方发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 本地运行

直接打开 `index.html`，或在项目文件夹运行：

```sh
python web.py
```

本地预览地址为 `http://127.0.0.1:7860`。Python 只用于提供静态文件，与线上部署无关。

## 技术范围

目前实现前端流程，按文件标识加载四组已配对的 ROI 与藏文结果，没有接入实时识别模型。未知视频可预览，但不会生成识别结果。文件匹配与选择次序无关，支持大小写及复制序号规范化。

访客选择的视频只在其浏览器本地读取，不会上传至服务器。已配套的视频及 ROI 作为网站静态资源提供。

## 藏文字体

项目内置开源 Noto Serif Tibetan，避免访客设备未安装藏文字体时出现缺字。Windows 可优先使用系统 Microsoft Himalaya，其他系统回退到项目内置字体。

字体来源：[Google Fonts / Noto Serif Tibetan](https://github.com/google/fonts/tree/main/ofl/notoseriftibetan)，许可证为 SIL Open Font License，见 `assets/fonts/OFL.txt`。
