# MRI图像处理系统

这是一个基于Flask的MRI图像处理系统，可以上传和处理MRI图像文件。

## 功能特点

- 支持上传DICOM格式的MRI图像
- 支持患者信息管理
- 图像处理和分析
- 生成报告

## 技术栈

- Python 3.11
- Flask
- SQLite
- OpenCV
- PyDICOM

## 项目结构

```
mri-web-app/
├── backend/             # 后端服务
│   ├── app.py          # 主应用程序
│   ├── uploads/        # 上传文件存储
│   ├── processed/      # 处理后的文件
│   ├── reports/        # 生成的报告
│   └── logs/          # 日志文件
├── test_data/          # 测试数据
└── test_upload.py      # 测试脚本
```

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/mri-web-app.git
cd mri-web-app
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

## 运行

1. 启动后端服务：
```bash
cd backend
python app.py
```

2. 测试文件上传：
```bash
python test_upload.py
```

## API接口

### 上传图像

- URL: `/api/process`
- 方法: `POST`
- 参数:
  - `file`: MRI图像文件
  - `patient_name`: 患者姓名
  - `patient_id`: 患者ID
- 返回:
  - 成功: `{"task_id": "xxx", "status": "processing"}`
  - 失败: `{"error": "错误信息"}`

### 查询任务状态

- URL: `/api/tasks/<task_id>`
- 方法: `GET`
- 返回:
  - 成功: `{"status": "completed", "results": {...}}`
  - 失败: `{"error": "错误信息"}`

## 许可证

MIT 