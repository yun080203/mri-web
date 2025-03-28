import requests
import os
import json
import traceback

def test_upload():
    print("\n=== 开始测试文件上传功能 ===")
    base_url = 'http://localhost:5000/api'
    upload_url = f'{base_url}/process'
    file_path = r'E:\ceshi.dcm'  # 使用真实的DICOM文件路径
    
    print(f"目标URL: {upload_url}")
    print(f"文件路径: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在: {file_path}")
        return
    
    print(f"文件大小: {os.path.getsize(file_path)} 字节")
    
    try:
        print("\n准备上传文件...")
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f)}
            data = {
                'patient_name': '测试患者',
                'patient_id': 'test-001'
            }
            
            print(f"请求数据:")
            print(f"- 文件名: {os.path.basename(file_path)}")
            print(f"- 患者姓名: {data['patient_name']}")
            print(f"- 患者ID: {data['patient_id']}")
            
            print("\n发送请求...")
            response = requests.post(upload_url, files=files, data=data)
            
            print(f"\n收到响应:")
            print(f"状态码: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"响应内容: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                
                if response.status_code == 200:
                    print("\n文件上传成功!")
                    task_id = response_data.get('task_id')
                    if task_id:
                        print(f"任务ID: {task_id}")
                        
                        # 查询任务状态
                        print(f"\n查询任务状态...")
                        status_url = f"{base_url}/tasks/{task_id}"
                        status_response = requests.get(status_url)
                        print(f"状态查询响应: {json.dumps(status_response.json(), indent=2, ensure_ascii=False)}")
                else:
                    print(f"\n文件上传失败!")
                    print(f"错误信息: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            except json.JSONDecodeError:
                print(f"响应内容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"错误: 无法连接到服务器，请确保服务器正在运行")
    except Exception as e:
        print(f"发生错误: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
    
    print("\n=== 测试完成 ===\n")

if __name__ == '__main__':
    test_upload() 