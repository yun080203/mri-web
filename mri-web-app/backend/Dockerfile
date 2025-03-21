# 使用更完整的基础镜像
FROM python:3.9-slim-bullseye

# 修改环境配置
ENV SPM_PATH=/spm/spm12
ENV CAT12_PATH=$SPM_PATH/toolbox/cat12
ENV MATLAB_ROOT=/matlab
ENV LD_LIBRARY_PATH=$MATLAB_ROOT/bin/glnxa64:$LD_LIBRARY_PATH

# 设置时区和清华镜像源
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装构建依赖后清理
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安装系统依赖（补充更多OpenCV所需依赖）
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libc6-dev-i386 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libxt6 \
    libgtk2.0-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    dcm2niix \
    libncurses5 \
    libtinfo5 \
    libxss1 \
    libxtst6 \
    libasound2 \
    libnss3 \
    libgbm1 \
    libxcb1 \
    vim \
    htop \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 升级pip
RUN python -m pip install --upgrade pip

# 使用指定版本的OpenCV
RUN pip install opencv-python-headless==4.5.5.64 -i https://pypi.tuna.tsinghua.edu.cn/simple  

# 设置工作目录
WORKDIR /app

# 使用清华pip镜像
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip cache purge

# 创建非root用户
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 创建并设置目录权限
RUN mkdir -p /app/uploads /app/processed && \
    chown -R appuser:appuser /app

# 复制项目文件
COPY . .
RUN chown -R appuser:appuser /app

# 切换到非root用户
USER appuser

EXPOSE 5000
CMD ["python", "app.py"]