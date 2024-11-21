const express = require('express');
const multer = require('multer');  // 用于处理文件上传的中间件
const path = require('path');      // Node.js 内置路径处理模块
const { v4: uuidv4 } = require('uuid');  // 用于生成唯一标识符
const fs = require('fs');          // 文件系统模块

const app = express();
const port = process.env.PORT || 3000;
// 判断是否为开发环境
const isDev = process.env.NODE_ENV !== 'production';

// 在开发环境下添加请求日志中间件
if (isDev) {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
}

/**
 * 配置文件存储选项
 * 设置文件保存目录和文件命名规则
 */
const storage = multer.diskStorage({
    destination: './uploads/',  // 文件保存目录
    filename: function(req, file, cb) {
        // 使用 UUID 生成唯一文件名，保留原始文件扩展名
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

/**
 * 配置文件上传中间件
 * 设置存储选项和文件大小限制
 */
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 100  // 限制文件大小为 100MB
    }
});

// 提供静态文件服务
app.use(express.static('public'));

// 文件类型判断函数
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    // 扩展支持的文件类型
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv'];
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'];
    const textExts = ['.txt', '.md', '.js', '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.ini', '.conf', '.sh', '.bat'];
    const codeExts = ['.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.ts', '.jsx', '.tsx'];
    const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'];
    
    // 根据扩展名返回文件类型
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (textExts.includes(ext)) return 'text';
    if (codeExts.includes(ext)) return 'code';
    if (docExts.includes(ext)) {
        if (ext === '.pdf') return 'pdf';
        return 'document';
    }
    return 'other';
}

// 文件上传路由
app.post('/upload', upload.array('files', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: '没有文件上传' });
    }

    // 获取过期时间（小时），默认24小时
    const expiryHours = parseInt(req.body.expiryHours) || 24;
    // 验证过期时间范围（1小时到7天）
    if (expiryHours < 1 || expiryHours > 168) {
        return res.status(400).json({ 
            success: false, 
            message: '过期时间必须在1小时到7天之间' 
        });
    }

    // 处理上传的文件
    const filesInfo = req.files.map(file => {
        const fileId = path.basename(file.filename, path.extname(file.originalname));
        const downloadUrl = `${req.protocol}://${req.get('host')}/download/${fileId}`;
        const previewUrl = `${req.protocol}://${req.get('host')}/preview/${fileId}`;
        const fileType = getFileType(file.originalname);

        // 设置自定义过期时间
        setTimeout(() => {
            fs.unlink(file.path, (err) => {
                if (err && isDev) console.error('Error deleting file:', err);
            });
        }, expiryHours * 60 * 60 * 1000);

        // 开发环境下记录上传信息
        if (isDev) {
            console.log(`File uploaded: ${file.originalname} (${file.size} bytes)`);
            console.log(`Type: ${fileType}, Expiry: ${expiryHours} hours`);
        }

        // 返回文件信息
        return {
            originalName: file.originalname,
            size: file.size,
            type: fileType,
            downloadUrl,
            previewUrl,
            mimeType: file.mimetype,
            expiryHours  // 添加过期时间信息
        };
    });

    res.json({
        success: true,
        files: filesInfo
    });
});

// 文件预览路由
app.get('/preview/:fileId', (req, res) => {
    const files = fs.readdirSync('./uploads/');
    // 查找匹配的文件
    const file = files.find(f => f.startsWith(req.params.fileId));
    
    if (!file) {
        return res.status(404).send('文件不存在或已过期');
    }

    const filePath = path.join(__dirname, 'uploads', file);
    const fileType = getFileType(file);

    // 发送文件供客户端处理
    res.sendFile(filePath);
});

// 文件下载路由
app.get('/download/:fileId', (req, res) => {
    const files = fs.readdirSync('./uploads/');
    const file = files.find(f => f.startsWith(req.params.fileId));
    
    if (!file) {
        if (isDev) console.log(`File not found: ${req.params.fileId}`);
        return res.status(404).send('文件不存在或已过期');
    }

    if (isDev) {
        console.log(`File download: ${file}`);
    }

    // 发送文件供下载
    res.download(path.join(__dirname, 'uploads', file));
});

// 确保上传目录存在
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

/**
 * 全局错误处理中间件
 * 处理服务器端错误，根据环境返回不同的错误信息
 */
app.use((err, req, res, next) => {
    if (isDev) {
        console.error(err.stack);
    }
    res.status(500).json({ 
        success: false, 
        message: isDev ? err.message : '服务器内部错误'
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    if (isDev) {
        console.log('Development mode enabled - watching for file changes...');
    }
}); 