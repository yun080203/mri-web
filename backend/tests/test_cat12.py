import os
import sys
import time
import requests
import logging
import pytest
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# 测试服务器地址
BASE_URL = 'http://localhost:5000/api'

@pytest.fixture
def task_id():
    """提供task_id的fixture"""
    # 测试文件路径
    test_file = Path(__file__).parent.parent / 'test_data' / 'test.dcm'
    
    # 如果测试文件不存在，创建一个空的DICOM文件用于测试
    if not test_file.exists():
        logger.info(f"创建测试文件: {test_file}")
        test_file.parent.mkdir(parents=True, exist_ok=True)
        with open(test_file, 'wb') as f:
            f.write(b'DICOM')  # 创建一个简单的测试文件
    
    # 上传文件
    with open(test_file, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{BASE_URL}/process", files=files)
    
    assert response.status_code == 200, f"上传失败: {response.text}"
    data = response.json()
    assert 'task_id' in data, "响应中没有task_id"
    logger.info(f"文件上传成功，任务ID: {data['task_id']}")
    return data['task_id']

def test_file_upload():
    """测试文件上传功能"""
    logger.info("开始测试文件上传...")
    
    # 测试文件路径
    test_file = Path(__file__).parent.parent / 'test_data' / 'test.dcm'
    
    # 如果测试文件不存在，创建一个空的DICOM文件用于测试
    if not test_file.exists():
        logger.info(f"创建测试文件: {test_file}")
        test_file.parent.mkdir(parents=True, exist_ok=True)
        with open(test_file, 'wb') as f:
            f.write(b'DICOM')  # 创建一个简单的测试文件
    
    # 上传文件
    with open(test_file, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{BASE_URL}/process", files=files)
    
    assert response.status_code == 200, f"上传失败: {response.text}"
    data = response.json()
    assert 'task_id' in data, "响应中没有task_id"
    logger.info(f"文件上传成功，任务ID: {data['task_id']}")

def test_task_status(task_id):
    """测试任务状态查询"""
    logger.info(f"开始测试任务状态查询 (任务ID: {task_id})...")
    
    # 查询任务状态
    response = requests.get(f"{BASE_URL}/tasks/{task_id}")
    assert response.status_code == 200, f"状态查询失败: {response.text}"
    
    data = response.json()
    assert 'status' in data, "响应中没有status字段"
    logger.info(f"任务状态: {data}")

def test_queue_status():
    """测试队列状态查询"""
    logger.info("开始测试队列状态查询...")
    
    # 查询队列状态
    response = requests.get(f"{BASE_URL}/tasks")
    assert response.status_code == 200, f"队列状态查询失败: {response.text}"
    
    data = response.json()
    assert 'tasks' in data, "响应中没有tasks字段"
    logger.info(f"队列状态: {data}")

def monitor_task_progress(task_id, timeout=300):
    """监控任务进度"""
    logger.info(f"开始监控任务进度 (任务ID: {task_id})...")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        response = requests.get(f"{BASE_URL}/tasks/{task_id}")
        assert response.status_code == 200, f"状态查询失败: {response.text}"
        
        data = response.json()
        status = data.get('status')
        
        logger.info(f"任务状态: {status}")
        
        if status in ['completed', 'failed']:
            assert status == 'completed', f"任务失败: {data.get('error', '未知错误')}"
            return True
            
        time.sleep(5)  # 每5秒查询一次
        
    pytest.fail("任务监控超时")

@pytest.mark.integration
def test_cat12_workflow():
    """测试完整的CAT12工作流程"""
    logger.info("开始CAT12功能测试...")
    
    # 1. 测试文件上传
    task_id = test_file_upload()
    
    # 2. 测试队列状态
    test_queue_status()
    
    # 3. 测试任务状态查询
    test_task_status(task_id)
    
    # 4. 监控任务进度
    monitor_task_progress(task_id)
    
    logger.info("所有测试完成")

if __name__ == '__main__':
    pytest.main() 