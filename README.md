# SoEasyDrop - 简易文件传输工具

一个安全、高效的跨设备文件传输工具，支持拖拽上传和扫码下载。采用现代化的UI设计，提供流畅的用户体验。

## 功能特点
- 多文件同时上传
- 拖拽或点击上传文件
- 实时上传进度显示
- 实时传输速度显示
- 端到端加密传输
- 自动生成二维码分享
- 文件在线预览功能
- 24小时临时存储
- 无需登录即可使用
- 支持大文件传输（最大100MB）

## 支持的文件类型
- 图片（jpg, jpeg, png, gif, webp, bmp）
- 音频（mp3, wav, ogg, m4a, aac）
- 视频（mp4, webm, ogg, mov）
- 文档（pdf, txt, md）
- 其他文本文件（js, css, html, json）

## 技术栈
- 前端：HTML5 + CSS3 + JavaScript (原生)
- 后端：Node.js + Express
- 文件处理：Multer
- 加密算法：AES-GCM 256位
- 二维码生成：QRCode.js
- 开发工具：Nodemon（热重载）

## 安全特性
- AES-GCM 256位端到端加密
- 文件24小时后自动删除
- 安全的文件传输协议
- URL安全的Base64编码
- XSS防护

## 项目结构

## 启动方式
1. npm install
2. npm start
3. 访问 http://localhost:3000 