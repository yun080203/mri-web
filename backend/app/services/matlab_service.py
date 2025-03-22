import os
import subprocess
import logging
from datetime import datetime
import pydicom
import numpy as np
from flask import current_app

logger = logging.getLogger(__name__)

class MatlabService:
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        self.app = app
        self.matlab_path = app.config['MATLAB_PATH']
        self.cat12_path = app.config['CAT12_PATH']
        self.workspace_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    def convert_dicom_to_nifti(self, dicom_file, output_dir):
        """将DICOM文件转换为NIfTI格式"""
        try:
            logger.info(f"开始转换DICOM文件: {dicom_file}")
            
            # 读取DICOM文件
            ds = pydicom.dcmread(dicom_file)
            
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 生成输出文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(output_dir, f"converted_{timestamp}.nii")
            
            # 创建MATLAB脚本
            matlab_script = f"""
            % 添加CAT12路径
            addpath('{self.cat12_path}');
            
            % 设置输入输出路径
            dicom_file = '{dicom_file}';
            output_file = '{output_file}';
            
            % 使用CAT12的DICOM导入功能
            cat_io_vol2nii(dicom_file, output_file);
            
            % 退出MATLAB
            exit;
            """
            
            # 保存MATLAB脚本
            script_file = os.path.join(output_dir, "convert_script.m")
            with open(script_file, 'w') as f:
                f.write(matlab_script)
            
            # 执行MATLAB脚本
            cmd = f'"{self.matlab_path}" -nosplash -nodesktop -r "run(\'{script_file}\');"'
            subprocess.run(cmd, shell=True, check=True)
            
            logger.info(f"DICOM转换完成: {output_file}")
            return output_file
            
        except Exception as e:
            logger.error(f"DICOM转换失败: {str(e)}")
            raise
    
    def process_with_cat12(self, nifti_file, output_dir):
        """使用CAT12处理NIfTI文件"""
        try:
            logger.info(f"开始CAT12处理: {nifti_file}")
            
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 从配置文件获取CAT12参数
            config = current_app.config
            
            # 创建MATLAB脚本
            matlab_script = f"""
            % 添加CAT12路径
            addpath('{self.cat12_path}');
            
            % 设置输入输出路径
            nifti_file = '{nifti_file}';
            output_dir = '{output_dir}';
            
            % 配置CAT12参数
            cat12_config = struct();
            cat12_config.output_dir = output_dir;
            cat12_config.quality = {config['CAT12_QUALITY']};  % 处理质量
            cat12_config.surface = {config['CAT12_SURFACE']};  % 表面重建
            cat12_config.ROI = {config['CAT12_ROI']};         % ROI分析
            cat12_config.norm = {config['CAT12_NORM']};        % 标准化
            cat12_config.deform = {config['CAT12_DEFORM']};    % 变形场
            cat12_config.vbm = {config['CAT12_VBM']};         % VBM分析
            
            % 运行CAT12处理
            cat_run(nifti_file, cat12_config);
            
            % 退出MATLAB
            exit;
            """
            
            # 保存MATLAB脚本
            script_file = os.path.join(output_dir, "cat12_script.m")
            with open(script_file, 'w') as f:
                f.write(matlab_script)
            
            # 执行MATLAB脚本
            cmd = f'"{self.matlab_path}" -nosplash -nodesktop -r "run(\'{script_file}\');"'
            subprocess.run(cmd, shell=True, check=True)
            
            logger.info(f"CAT12处理完成: {output_dir}")
            return output_dir
            
        except Exception as e:
            logger.error(f"CAT12处理失败: {str(e)}")
            raise
    
    def extract_results(self, cat12_output_dir):
        """从CAT12输出中提取结果"""
        try:
            logger.info(f"开始提取CAT12结果: {cat12_output_dir}")
            
            # 读取CAT12生成的XML报告
            report_file = os.path.join(cat12_output_dir, "report.xml")
            if not os.path.exists(report_file):
                raise FileNotFoundError(f"未找到CAT12报告文件: {report_file}")
            
            # TODO: 解析XML报告，提取关键信息
            # 这里需要根据CAT12的具体输出格式来实现
            
            results = {
                "volume": {
                    "total": 0,  # 总脑体积
                    "gm": 0,     # 灰质体积
                    "wm": 0,     # 白质体积
                    "csf": 0     # 脑脊液体积
                },
                "thickness": {
                    "mean": 0,   # 平均皮层厚度
                    "std": 0     # 标准差
                },
                "surface": {
                    "area": 0,   # 表面积
                    "volume": 0  # 表面体积
                }
            }
            
            logger.info("结果提取完成")
            return results
            
        except Exception as e:
            logger.error(f"结果提取失败: {str(e)}")
            raise 