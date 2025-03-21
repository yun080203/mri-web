backend/：

后端代码，使用 Python（Flask）实现图像处理逻辑。

frontend/：

前端代码，使用 React 实现用户界面。

public/：存放静态文件（如 index.html）。

node_modules/：存放 Node.js 依赖包（无需手动修改）。

package.json：定义项目依赖和脚本。

package-lock.json：锁定依赖版本（无需手动修改）。

src/：存放 React 源码。

docker-compose.yml：

定义 Docker 容器配置，用于启动前后端服务。

.gitignore：

定义 Git 忽略的文件和目录。

README.md：

项目说明文档。

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