import subprocess
import os
from datetime import datetime
from pathlib import Path

CAT12_PATH = '/opt/cat12/run_cat12.sh'  # Docker容器内路径

def sanitize_path(base_dir, user_path):
    """安全路径处理"""
    resolved_path = (base_dir / user_path).resolve()
    if not resolved_path.is_relative_to(base_dir):
        raise ValueError("非法路径访问")
    return resolved_path

# 使用示例
safe_input_path = sanitize_path(Path("/app/uploads"), input_path)


def process_mri(input_path):
    output_dir = os.path.join(
        os.path.dirname(input_path),
        'processed',
        datetime.now().strftime("%Y%m%d%H%M%S")
    )
    os.makedirs(output_dir, exist_ok=True)

    # 执行CAT12处理
    try:
        subprocess.run(
            [CAT12_PATH, '-i', input_path, '-o', output_dir],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        cmd = [
            "bash",
             CAT12_PATH,
             "-i", str(safe_input_path),
             "-o", str(output_dir),
             "-m", "/matlab", # 显式传递Matlab路径
             "-s", "/spm"     # 显式传递SPM路径
        ]
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # 合并输出流
            universal_newlines=True
        )   
        
        # 实时输出捕获
        while proc.poll() is None:
            yield proc.stdout.readline()
        return {
            'status': 'success',
            'output_dir': output_dir,
            'processed_img': os.path.join(output_dir, 'mri_processed.nii')
        }
    except subprocess.CalledProcessError as e:
        return {
            'status': 'error',
            'message': e.stderr.decode()
        }