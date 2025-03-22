# 脑部 MRI 图像处理系统

这是一个用于处理和分析脑部 MRI 图像的 Web 应用程序。

## 功能特点

- 支持上传 DICOM、NIfTI 等格式的 MRI 图像
- 图像预处理和分割
- 病变体积计算
- 组织统计分析
- 生成分析报告
- 图像对比和可视化

## 技术栈

### 后端
- Python 3.8+
- Flask
- SQLAlchemy
- OpenCV
- NumPy
- PyDicom
- ReportLab

### 前端
- React
- Cornerstone.js
- React Router
- Axios

## 安装说明

1. 克隆仓库：
```bash
git clone https://github.com/yun080203/brain-mri-processor.git
cd brain-mri-processor
```

2. 创建并激活 Python 虚拟环境：
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
```

3. 安装后端依赖：
```bash
pip install -r requirements.txt
```

4. 安装前端依赖：
```bash
cd frontend
npm install
```

5. 配置环境变量：
- 复制 `.env.example` 为 `.env`
- 根据需要修改配置

6. 初始化数据库：
```bash
python init_db.py
```

## 运行应用

1. 启动后端服务：
```bash
cd backend
python run.py
```

2. 启动前端开发服务器：
```bash
cd frontend
npm start
```

3. 访问应用：
打开浏览器访问 http://localhost:3000

## 项目结构

```
brain-mri-processor/
├── backend/
│   ├── app/
│   │   ├── api/        # API 路由
│   │   ├── models/     # 数据模型
│   │   ├── services/   # 业务逻辑
│   │   └── utils/      # 工具函数
│   ├── config/         # 配置文件
│   ├── tests/          # 测试文件
│   └── run.py          # 应用入口
├── frontend/
│   ├── public/         # 静态文件
│   ├── src/            # 源代码
│   └── package.json    # 前端依赖
├── test_data/          # 测试数据
├── .env                # 环境变量
├── requirements.txt    # Python 依赖
└── README.md          # 项目文档
```

## 开发指南

### 代码风格
- 后端使用 Black 进行代码格式化
- 前端使用 ESLint 和 Prettier
- 遵循 PEP 8 和 React 最佳实践

### 测试
- 后端使用 pytest 进行测试
- 前端使用 Jest 和 React Testing Library

### 提交规范
- feat: 新功能
- fix: 修复问题
- docs: 文档修改
- style: 代码格式修改
- refactor: 代码重构
- test: 测试用例修改
- chore: 其他修改

## 许可证

MIT License

# MRI图像处理系统

## 项目简介
这是一个基于Web的MRI图像处理系统，支持以下功能：
- 上传脑部MRI图像（支持DICOM、NIfTI格式）
- 使用CAT12工具包进行图像处理
- 图像对比和可视化
- 患者数据管理
- 自动生成分析报告

## 系统要求
- Docker和Docker Compose
- MATLAB R2020b或更高版本
- SPM12和CAT12工具包
- 至少8GB RAM
- 至少20GB可用磁盘空间

## 安装步骤

1. 克隆项目：
```bash
git clone https://github.com/your-username/mri-web-app.git
cd mri-web-app
```

2. 配置环境：
- 确保MATLAB和SPM12已正确安装
- 在docker-compose.yml中更新MATLAB和SPM12的路径

3. 启动服务：
```bash
docker-compose up --build
```

4. 访问应用：
- 打开浏览器访问 http://localhost:3000
- 后端API地址：http://localhost:5000

## 使用说明

### 上传图像
1. 点击"上传图像"按钮
2. 选择MRI图像文件（支持.dcm、.nii、.nii.gz格式）
3. 填写患者信息
4. 点击"上传"按钮
5. 等待处理完成

### 图像对比
1. 在"图像对比"页面查看原始图像和处理后的图像
2. 使用放大/缩小按钮调整图像大小
3. 鼠标悬停在图像上可以查看细节

### 数据管理
1. 在"数据管理"页面查看所有患者记录
2. 使用搜索框按患者姓名或ID搜索
3. 点击患者卡片查看详细信息
4. 点击"生成报告"按钮下载PDF格式的分析报告

## 技术栈
- 前端：React.js
- 后端：Flask
- 数据库：SQLite
- 图像处理：MATLAB + SPM12 + CAT12
- 容器化：Docker + Docker Compose

## 目录结构
```
mri-web-app/
├── backend/           # 后端代码
│   ├── app.py        # 主应用
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # 前端代码
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 开发说明
1. 前端开发：
```bash
cd frontend
npm install
npm start
```

2. 后端开发：
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask run
```

## 注意事项
- 确保MATLAB和SPM12的路径配置正确
- 上传大文件时可能需要较长时间
- 建议定期备份数据库文件

## 许可证
MIT License

## 贡献指南
1. Fork项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 联系方式

# 检查Docker和Docker Compose
docker --version
docker-compose --version