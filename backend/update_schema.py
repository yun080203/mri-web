#!/usr/bin/env python

"""
更新数据库schema，为image表添加task_id列
"""

import os
import sqlite3

# 获取数据库文件路径
db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brain_mri.db')

print(f"连接到数据库: {db_file}")
if not os.path.exists(db_file):
    print(f"错误: 数据库文件不存在 - {db_file}")
    exit(1)

try:
    # 创建数据库连接
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # 检查列是否已存在
    cursor.execute("PRAGMA table_info(image)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'task_id' in columns:
        print("列'task_id'已存在于image表中")
    else:
        # 添加task_id列
        cursor.execute('ALTER TABLE image ADD COLUMN task_id VARCHAR(255)')
        conn.commit()
        print("成功添加'task_id'列到image表")
    
    # 验证列已存在
    cursor.execute("PRAGMA table_info(image)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"image表中的列: {columns}")
    
    if 'task_id' in columns:
        print("验证成功：'task_id'列已在image表中")
    else:
        print("错误：无法验证'task_id'列")
        
    # 关闭连接
    cursor.close()
    conn.close()
    
    print("数据库更新完成")
except Exception as e:
    print(f"错误: {str(e)}")
    exit(1) 