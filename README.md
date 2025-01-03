# SoEasyDrop - 简易文件传输工具

该项目源于我每次需要在PC、Android、iOS上互传文件时翻来覆去的找数据线而诞生的一个想法，本人是一名前端程序员，项目实现比较简单，过段时间会部署上线，欢迎大家使用。

## 功能特点
- 多文件同时上传（最多10个文件）
- 拖拽或点击上传文件
- 实时上传进度显示
- 实时传输速度显示
- AES-GCM 256位端到端加密
- 自动生成二维码分享
- 文件在线预览功能
- 自定义文件有效期（1小时至7天）
- 无需登录即可使用
- 支持大文件传输（最大100MB）

## 支持的文件类型和预览
### 图片
- 格式：jpg, jpeg, png, gif, webp, bmp, svg, ico
- 功能：直接预览、缩放显示

### 视频
- 格式：mp4, webm, ogg, mov, avi, mkv, flv
- 功能：在线播放、视频控制

### 音频
- 格式：mp3, wav, ogg, m4a, aac, flac, wma
- 功能：在线播放、音频控制

### 文本和代码
- 文本格式：txt, md, json, xml, yaml, yml, ini, conf
- 代码格式：js, ts, py, java, cpp, c, cs, php, rb, go, rs, swift, kt, jsx, tsx
- 功能：语法高亮显示、自动识别编程语言

### 文档
- Office格式：doc, docx, xls, xlsx, ppt, pptx
- 其他格式：pdf, odt, ods, odp
- 功能：
  - PDF：在线阅读
  - Office文档：通过Office Online Viewer在线预览
  - 支持文档下载

## 技术实现
### 前端技术
- 原生 JavaScript ES6+
- HTML5 拖放 API
- Web Crypto API（加密）
- FileReader API
- Fetch API
- CSS3 动画和过渡效果
- highlight.js（代码高亮）

### 后端技术
- Node.js + Express
- Multer（文件上传）
- UUID（文件命名）
- 文件系统操作

### 安全特性
- AES-GCM 256位端到端加密
- URL安全的Base64编码
- XSS防护
- 文件自动过期机制
- 文件大小限制

## 项目结构
easydrop/
├── public/
│ ├── index.html # 主页面
│ ├── styles.css # 样式文件
│ └── app.js # 前端逻辑
├── uploads/ # 文件上传目录（临时存储）
├── server.js # 服务器入口
├── package.json # 项目配置
└── README.md # 项目说明

## 环境要求
- Node.js >= 12.0.0
- npm >= 6.0.0

## 安装和使用

### 安装依赖
npm install

## 依赖说明

### 生产依赖
- express: Web 应用框架，用于构建 HTTP 服务器
- multer: 处理文件上传的中间件，支持 multipart/form-data
- uuid: 生成唯一标识符，用于文件命名

### 开发依赖
- nodemon: 开发工具，监听文件变化并自动重启服务器

### 启动命令
- `npm start`: 生产环境启动
- `npm run dev`: 开发环境启动，支持热重载

## 使用说明
1. 启动服务器后访问 http://localhost:3000
2. 将文件拖拽到上传区域或点击选择文件
3. 支持同时选择多个文件上传
4. 实时查看上传进度和传输速度
5. 上传完成后可以：
   - 扫描二维码下载文件
   - 点击预览查看文件内容
   - 点击下载按钮直接下载
6. 使用"重新上传"按钮开始新的上传

## 注意事项
- 文件大小限制为100MB
- 文件链接有效期为24小时
- 支持同时上传最多10个文件
- 最多同时处理3个文件的上传
- 建议在开发环境下使用 npm run dev 以获得更好的开发体验

## 后续优化计划
- [x] 支持设置自定义过期时间
- [x] 支持更多文件格式的预览
- [ ] 优化移动端适配
- [ ] 添加文件压缩功能

## 贡献指南
欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证
MIT License
