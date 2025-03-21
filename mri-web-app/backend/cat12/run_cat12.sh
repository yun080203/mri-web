#!/bin/bash
# 后端路径：backend/cat12/run_cat12.sh



# ==== 配置您的实际路径 ====
MATLAB_ROOT="/d/Matlab/bin"
# 修正方案（使用容器内路径）
SPM_PATH="/spm/spm12"  # 对应docker的-v挂载路径
CAT12_DIR="$SPM_PATH/toolbox/cat12"

# 增强路径检查
if [ ! -d "$CAT12_DIR" ]; then
    echo "[ERROR] CAT12目录不存在: $CAT12_DIR"
    exit 1
fi

# ==== 主处理逻辑 ====
INPUT_FILE=$1
OUTPUT_DIR=$2

# 调用MATLAB运行CAT12脚本
"$MATLAB_ROOT/bin/matlab" -batch \
"addpath('$CAT12_DIR'); \
cat12_batch_processing('$INPUT_FILE', '$OUTPUT_DIR');"